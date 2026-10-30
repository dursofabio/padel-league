-- Auth triggers (profiles), role helpers, shared private helpers.

-- ------------------------------------------------------------------ profiles from auth.users

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      ''
    ),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end
$$;

create trigger on_auth_user_email
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email();

-- ------------------------------------------------------------------ roles

-- Admin implies every role.
create or replace function private.has_role(r public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (r = any (roles) or 'admin' = any (roles))
  )
$$;

-- Trusted callers: migrations, service role, SECURITY DEFINER functions (owned by postgres).
create or replace function private.is_trusted() returns boolean
language sql stable set search_path = '' as $$
  select current_user not in ('anon', 'authenticated')
$$;

create or replace function private.require_uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  u uuid := auth.uid();
begin
  if u is null then
    perform private.fail('NOT_AUTHORIZED', 'Devi accedere per questa operazione');
  end if;
  return u;
end
$$;

create or replace function private.require_role(r public.app_role) returns uuid
language plpgsql stable set search_path = '' as $$
declare
  u uuid := private.require_uid();
begin
  if not private.has_role(r) then
    perform private.fail('NOT_AUTHORIZED', 'Permessi insufficienti: serve il ruolo ' || r::text);
  end if;
  return u;
end
$$;

-- Roles change only through set_roles (admin) or trusted callers.
create or replace function private.guard_profile_roles() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.roles is distinct from old.roles or new.id is distinct from old.id or new.email is distinct from old.email)
     and not private.is_trusted() and not private.has_role('admin') then
    perform private.fail('NOT_AUTHORIZED', 'Solo l''amministratore può cambiare i ruoli');
  end if;
  return new;
end
$$;

create trigger profiles_guard_roles before update on public.profiles
  for each row execute function private.guard_profile_roles();

-- Teams: only the organiser changes group and state.
create or replace function private.guard_squadre() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.girone is distinct from old.girone or new.stato is distinct from old.stato
      or new.torneo_id is distinct from old.torneo_id or new.creato_da is distinct from old.creato_da)
     and not private.is_trusted() and not private.has_role('organizzatore') then
    perform private.fail('NOT_AUTHORIZED', 'Solo l''organizzatore può cambiare girone e stato della coppia');
  end if;
  return new;
end
$$;

create trigger squadre_guard before update on public.squadre
  for each row execute function private.guard_squadre();

-- ------------------------------------------------------------------ matches

-- Players of a match, team A then team B, by `ordine`.
create or replace function private.giocatori_partita(p_partita uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(sg.user_id order by (sg.squadra_id = p.squadra_b), sg.ordine), '{}')
  from public.partite p
  join public.squadra_giocatori sg on sg.squadra_id in (p.squadra_a, p.squadra_b)
  where p.id = p_partita
$$;

-- 'A' / 'B' / null: side of a user in a match.
create or replace function private.lato_giocatore(p_partita uuid, p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when sg.squadra_id = p.squadra_a then 'A' else 'B' end
  from public.partite p
  join public.squadra_giocatori sg on sg.squadra_id in (p.squadra_a, p.squadra_b)
  where p.id = p_partita and sg.user_id = p_user
  limit 1
$$;

create or replace function private.is_giocatore_partita(p_partita uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.lato_giocatore(p_partita, auth.uid()) is not null
$$;

-- ------------------------------------------------------------------ shared helpers

create or replace function private.scrivi_log(p_cosa text, p_riferimento text) returns void
language sql security definer set search_path = '' as $$
  insert into public.log (chi, cosa, riferimento) values (auth.uid(), p_cosa, coalesce(p_riferimento, ''));
$$;

-- Effective tournament config: defaults overlaid with the stored config.
create or replace function private.config(p_torneo uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.config_default() || coalesce((select config from public.tornei where id = p_torneo), '{}'::jsonb)
$$;

-- Serialises every change to a court's day timeline (occupations, confirmations, requests).
-- Always taken before row locks, so lock order is consistent across RPCs.
create or replace function private.lock_slot(p_campo text, p_data date) returns void
language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('padel:' || p_campo || ':' || p_data::text, 0));
$$;

-- fasciaCopre(): some "hh:mm-hh:mm" window of that day covers [inizio, fine].
-- Malformed entries are ignored instead of raising.
create or replace function private.fascia_copre(p_fasce jsonb, p_data date, p_inizio time, p_fine time)
returns boolean
language sql immutable set search_path = '' as $$
  select coalesce((
    select bool_or(
      (split_part(split_part(f, '-', 1), ':', 1)::int * 60 + split_part(split_part(f, '-', 1), ':', 2)::int)
        <= private.minuti(p_inizio)
      and private.minuti(p_fine)
        <= (split_part(split_part(f, '-', 2), ':', 1)::int * 60 + split_part(split_part(f, '-', 2), ':', 2)::int)
    )
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_fasce -> p_data::text) = 'array' then p_fasce -> p_data::text else '[]'::jsonb end
    ) as f
    where f ~ '^\d{1,2}:\d{2}-\d{1,2}:\d{2}$'
  ), false)
$$;

-- Match back to "da programmare" if it still points at that request.
create or replace function private.libera_partita(p_partita uuid, p_richiesta uuid) returns void
language sql security definer set search_path = '' as $$
  update public.partite
  set stato = 'da programmare', richiesta_id = null
  where id = p_partita and richiesta_id = p_richiesta and stato = 'richiesta';
$$;

-- Lazy expiry: expired pending requests on a court/day and/or a match become 'scaduta'.
create or replace function private.scadi_richieste(p_campo text, p_data date, p_partita uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.richieste
    set stato = 'scaduta', nota = coalesce(nota || ' · ', '') || 'Nessuna risposta entro la scadenza'
    where stato = 'attesa' and scadenza <= now()
      and ((campo_id = p_campo and data = p_data) or partita_id = p_partita)
    returning id, partita_id
  loop
    perform private.libera_partita(r.partita_id, r.id);
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Pending requests on a court overlapping an interval become 'conflitto' (match freed).
create or replace function private.richieste_in_conflitto(
  p_campo text, p_data date, p_inizio time, p_fine time, p_escludi uuid, p_nota text, p_uid uuid
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.richieste
    set stato = 'conflitto', nota = p_nota, gestito_da = p_uid
    where stato = 'attesa' and campo_id = p_campo and data = p_data
      and periodo && tsrange(p_data + p_inizio, p_data + p_fine, '[)')
      and id is distinct from p_escludi
    returning id, partita_id
  loop
    perform private.libera_partita(r.partita_id, r.id);
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Port of validaRisultato() (src/lib/results.ts): {ok, errore?, vincitore?}.
create or replace function private.valida_risultato(p_set jsonb, p_formato jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  per_vincere int := coalesce((p_formato ->> 'setPerVincere')::int, 2);
  stb_attivo boolean := coalesce((p_formato ->> 'superTieBreak')::boolean, true);
  max_set int := per_vincere * 2 - 1;
  n int;
  va int := 0;
  vb int := 0;
  i int;
  s jsonb;
  a numeric;
  b numeric;
  hi numeric;
  lo numeric;
  stb boolean;
  valido boolean;
begin
  if p_set is null or jsonb_typeof(p_set) <> 'array' or jsonb_array_length(p_set) = 0 then
    return jsonb_build_object('ok', false, 'errore', 'Inserisci almeno un set');
  end if;
  n := jsonb_array_length(p_set);
  if n > max_set then
    return jsonb_build_object('ok', false, 'errore', format('Al massimo %s set', max_set));
  end if;
  for i in 0 .. n - 1 loop
    s := p_set -> i;
    if jsonb_typeof(s) <> 'object' or jsonb_typeof(s -> 'a') is distinct from 'number'
       or jsonb_typeof(s -> 'b') is distinct from 'number' then
      return jsonb_build_object('ok', false, 'errore', format('Set %s: punteggio non valido', i + 1));
    end if;
    a := (s ->> 'a')::numeric;
    b := (s ->> 'b')::numeric;
    if a <> trunc(a) or b <> trunc(b) or a < 0 or b < 0 then
      return jsonb_build_object('ok', false, 'errore', format('Set %s: punteggio non valido', i + 1));
    end if;
    if va = per_vincere or vb = per_vincere then
      return jsonb_build_object('ok', false, 'errore', 'La partita era già finita prima di questo set');
    end if;
    stb := stb_attivo and i = per_vincere * 2 - 2;
    hi := greatest(a, b);
    lo := least(a, b);
    if stb then
      valido := hi >= 10 and hi - lo >= 2 and (hi = 10 or hi - lo = 2);
    else
      valido := (hi = 6 and lo <= 4) or (hi = 7 and lo in (5, 6));
    end if;
    if not valido then
      return jsonb_build_object('ok', false, 'errore',
        case when stb
          then format('Set %s: super tie-break non valido (a 10, con 2 punti di scarto)', i + 1)
          else format('Set %s: punteggio non valido (6-0…6-4, 7-5, 7-6)', i + 1)
        end);
    end if;
    if a > b then va := va + 1; else vb := vb + 1; end if;
  end loop;
  if va < per_vincere and vb < per_vincere then
    return jsonb_build_object('ok', false, 'errore', 'La partita non è conclusa');
  end if;
  return jsonb_build_object('ok', true, 'vincitore', case when va > vb then 'A' else 'B' end);
end
$$;

-- Execute privileges: helpers used inside RLS policies are callable by authenticated.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.is_giocatore_partita(uuid) to authenticated;
grant execute on function private.is_trusted() to authenticated;
grant execute on function private.fail(text, text) to authenticated;
-- column default of tornei.config (admins insert tournaments directly)
grant execute on function private.config_default() to authenticated;
