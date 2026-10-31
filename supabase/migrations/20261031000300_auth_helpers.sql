-- Auth triggers (profiles), role helpers, shared private helpers.

-- ------------------------------------------------------------------ profiles from auth.users

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, email)
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
    perform private.fail('NOT_AUTHORIZED', 'Permessi insufficienti: serve il ruolo ' || private.label_it(r::text));
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

-- Teams: only the organizer changes group and status.
create or replace function private.guard_teams() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.group_name is distinct from old.group_name or new.status is distinct from old.status
      or new.tournament_id is distinct from old.tournament_id or new.created_by is distinct from old.created_by)
     and not private.is_trusted() and not private.has_role('organizer') then
    perform private.fail('NOT_AUTHORIZED', 'Solo l''organizzatore può cambiare girone e stato della coppia');
  end if;
  return new;
end
$$;

create trigger teams_guard before update on public.teams
  for each row execute function private.guard_teams();

-- ------------------------------------------------------------------ matches

-- Players of a match, team A then team B, by `position`.
create or replace function private.match_players(p_match uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(tp.user_id order by (tp.team_id = m.team_b), tp.position), '{}')
  from public.matches m
  join public.team_players tp on tp.team_id in (m.team_a, m.team_b)
  where m.id = p_match
$$;

-- 'A' / 'B' / null: side of a user in a match.
create or replace function private.player_side(p_match uuid, p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when tp.team_id = m.team_a then 'A' else 'B' end
  from public.matches m
  join public.team_players tp on tp.team_id in (m.team_a, m.team_b)
  where m.id = p_match and tp.user_id = p_user
  limit 1
$$;

create or replace function private.is_match_player(p_match uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.player_side(p_match, auth.uid()) is not null
$$;

-- ------------------------------------------------------------------ shared helpers

create or replace function private.write_log(p_action text, p_target text) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, action, target) values (auth.uid(), p_action, coalesce(p_target, ''));
$$;

-- Effective tournament config: defaults overlaid with the stored config.
create or replace function private.config(p_tournament uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.config_default() || coalesce((select config from public.tournaments where id = p_tournament), '{}'::jsonb)
$$;

-- Serialises every change to a court's day timeline (bookings, confirmations, requests).
-- Always taken before row locks, so lock order is consistent across RPCs.
create or replace function private.lock_slot(p_court text, p_date date) returns void
language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('padel:' || p_court || ':' || p_date::text, 0));
$$;

-- windowCovers(): some "hh:mm-hh:mm" window of that day covers [start, end].
-- Malformed entries are ignored instead of raising.
create or replace function private.window_covers(p_windows jsonb, p_date date, p_start time, p_end time)
returns boolean
language sql immutable set search_path = '' as $$
  select coalesce((
    select bool_or(
      (split_part(split_part(w, '-', 1), ':', 1)::int * 60 + split_part(split_part(w, '-', 1), ':', 2)::int)
        <= private.minutes(p_start)
      and private.minutes(p_end)
        <= (split_part(split_part(w, '-', 2), ':', 1)::int * 60 + split_part(split_part(w, '-', 2), ':', 2)::int)
    )
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_windows -> p_date::text) = 'array' then p_windows -> p_date::text else '[]'::jsonb end
    ) as w
    where w ~ '^\d{1,2}:\d{2}-\d{1,2}:\d{2}$'
  ), false)
$$;

-- Match back to 'unscheduled' if it still points at that request.
create or replace function private.release_match(p_match uuid, p_request uuid) returns void
language sql security definer set search_path = '' as $$
  update public.matches
  set status = 'unscheduled', request_id = null
  where id = p_match and request_id = p_request and status = 'requested';
$$;

-- Lazy expiry: expired pending requests on a court/day and/or a match become 'expired'.
create or replace function private.expire_requests(p_court text, p_date date, p_match uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.requests
    set status = 'expired', note = coalesce(note || ' · ', '') || 'Nessuna risposta entro la scadenza'
    where status = 'pending' and expires_at <= now()
      and ((court_id = p_court and date = p_date) or match_id = p_match)
    returning id, match_id
  loop
    perform private.release_match(r.match_id, r.id);
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Pending requests on a court overlapping an interval become 'conflict' (match freed).
create or replace function private.mark_conflicting_requests(
  p_court text, p_date date, p_start time, p_end time, p_exclude uuid, p_note text, p_uid uuid
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.requests
    set status = 'conflict', note = p_note, handled_by = p_uid
    where status = 'pending' and court_id = p_court and date = p_date
      and time_range && tsrange(p_date + p_start, p_date + p_end, '[)')
      and id is distinct from p_exclude
    returning id, match_id
  loop
    perform private.release_match(r.match_id, r.id);
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Port of validateResult() (src/lib/results.ts): {ok, error?, winner?}.
create or replace function private.validate_result(p_sets jsonb, p_format jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  to_win int := coalesce((p_format ->> 'setsToWin')::int, 2);
  stb_enabled boolean := coalesce((p_format ->> 'superTieBreak')::boolean, true);
  max_sets int := to_win * 2 - 1;
  n int;
  wa int := 0;
  wb int := 0;
  i int;
  s jsonb;
  a numeric;
  b numeric;
  hi numeric;
  lo numeric;
  stb boolean;
  valid boolean;
begin
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Inserisci almeno un set');
  end if;
  n := jsonb_array_length(p_sets);
  if n > max_sets then
    return jsonb_build_object('ok', false, 'error', format('Al massimo %s set', max_sets));
  end if;
  for i in 0 .. n - 1 loop
    s := p_sets -> i;
    if jsonb_typeof(s) <> 'object' or jsonb_typeof(s -> 'a') is distinct from 'number'
       or jsonb_typeof(s -> 'b') is distinct from 'number' then
      return jsonb_build_object('ok', false, 'error', format('Set %s: punteggio non valido', i + 1));
    end if;
    a := (s ->> 'a')::numeric;
    b := (s ->> 'b')::numeric;
    if a <> trunc(a) or b <> trunc(b) or a < 0 or b < 0 then
      return jsonb_build_object('ok', false, 'error', format('Set %s: punteggio non valido', i + 1));
    end if;
    if wa = to_win or wb = to_win then
      return jsonb_build_object('ok', false, 'error', 'La partita era già finita prima di questo set');
    end if;
    stb := stb_enabled and i = to_win * 2 - 2;
    hi := greatest(a, b);
    lo := least(a, b);
    if stb then
      valid := hi >= 10 and hi - lo >= 2 and (hi = 10 or hi - lo = 2);
    else
      valid := (hi = 6 and lo <= 4) or (hi = 7 and lo in (5, 6));
    end if;
    if not valid then
      return jsonb_build_object('ok', false, 'error',
        case when stb
          then format('Set %s: super tie-break non valido (a 10, con 2 punti di scarto)', i + 1)
          else format('Set %s: punteggio non valido (6-0…6-4, 7-5, 7-6)', i + 1)
        end);
    end if;
    if a > b then wa := wa + 1; else wb := wb + 1; end if;
  end loop;
  if wa < to_win and wb < to_win then
    return jsonb_build_object('ok', false, 'error', 'La partita non è conclusa');
  end if;
  return jsonb_build_object('ok', true, 'winner', case when wa > wb then 'A' else 'B' end);
end
$$;

-- Execute privileges: helpers used inside RLS policies are callable by authenticated.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.is_match_player(uuid) to authenticated;
grant execute on function private.is_trusted() to authenticated;
grant execute on function private.fail(text, text) to authenticated;
-- column default of tournaments.config (admins insert tournaments directly)
grant execute on function private.config_default() to authenticated;
