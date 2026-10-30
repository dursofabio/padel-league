-- Teams and invites, calendar and final phases, roles.

create or replace function public.create_team(p_torneo uuid, p_nome text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_stato public.stato_torneo;
  v_id uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  select stato into v_stato from public.tornei where id = p_torneo for share;
  if not found then
    perform private.fail('NOT_FOUND', 'Torneo non trovato');
  end if;
  if v_stato <> 'iscrizioni' then
    perform private.fail('REGISTRATION_CLOSED', 'Le iscrizioni sono chiuse');
  end if;
  if coalesce(btrim(p_nome), '') = '' then
    perform private.fail('BAD_STATE', 'Dai un nome alla coppia');
  end if;
  if exists (select 1 from public.squadra_giocatori where torneo_id = p_torneo and user_id = v_uid) then
    perform private.fail('ALREADY_IN_TEAM', 'Fai già parte di una coppia in questo torneo');
  end if;
  insert into public.squadre (torneo_id, nome, creato_da) values (p_torneo, btrim(p_nome), v_uid)
  returning id into v_id;
  insert into public.squadra_giocatori (squadra_id, torneo_id, user_id, ordine) values (v_id, p_torneo, v_uid, 1);
  insert into public.inviti (token, squadra_id, torneo_id, creato_da) values (v_token, v_id, p_torneo, v_uid);
  perform private.scrivi_log('crea squadra', v_id::text);
  return jsonb_build_object('squadra_id', v_id, 'token', v_token);
end
$$;

create or replace function public.get_invite(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_res jsonb;
begin
  perform private.require_uid();
  select jsonb_build_object(
           'squadra_id', s.id, 'torneo_id', s.torneo_id, 'nome', s.nome,
           'creatore_nome', coalesce(pr.nome, ''), 'stato', s.stato,
           'giocatori', (select count(*) from public.squadra_giocatori sg where sg.squadra_id = s.id))
    into v_res
  from public.inviti i
  join public.squadre s on s.id = i.squadra_id
  left join public.profiles pr on pr.id = s.creato_da
  where i.token = p_token;
  return v_res;
end
$$;

create or replace function public.join_team(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_i public.inviti;
  v_s public.squadre;
begin
  select * into v_i from public.inviti where token = p_token;
  if not found then
    perform private.fail('BAD_TOKEN', 'Link d''invito non valido');
  end if;
  select * into v_s from public.squadre where id = v_i.squadra_id for update;
  if exists (select 1 from public.squadra_giocatori where squadra_id = v_s.id and user_id = v_uid) then
    perform private.fail('ALREADY_IN_TEAM', 'Fai già parte di questa coppia');
  end if;
  if (select stato from public.tornei where id = v_s.torneo_id) <> 'iscrizioni' then
    perform private.fail('REGISTRATION_CLOSED', 'Le iscrizioni sono chiuse');
  end if;
  if v_s.stato <> 'in attesa partner'
     or (select count(*) from public.squadra_giocatori where squadra_id = v_s.id) >= 2 then
    perform private.fail('TEAM_FULL', 'La coppia è già completa');
  end if;
  if exists (select 1 from public.squadra_giocatori where torneo_id = v_s.torneo_id and user_id = v_uid) then
    perform private.fail('ALREADY_IN_TEAM', 'Fai già parte di un''altra coppia in questo torneo');
  end if;
  insert into public.squadra_giocatori (squadra_id, torneo_id, user_id, ordine) values (v_s.id, v_s.torneo_id, v_uid, 2);
  update public.squadre set stato = 'da approvare' where id = v_s.id;
  perform private.scrivi_log('entra in squadra', v_s.id::text);
  return v_s.id;
end
$$;

create or replace function public.my_invite_token(p_squadra uuid) returns text
language sql stable security definer set search_path = '' as $$
  select token from public.inviti
  where squadra_id = p_squadra and creato_da = auth.uid()
  order by token limit 1
$$;

-- ------------------------------------------------------------------ calendar

create or replace function public.generate_calendar(p_torneo uuid, p_partite jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizzatore');
  v_n int;
  v_err text;
  v_stato public.stato_torneo;
begin
  select stato into v_stato from public.tornei where id = p_torneo for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Torneo non trovato');
  end if;
  if exists (select 1 from public.partite where torneo_id = p_torneo and fase = 'gironi') then
    perform private.fail('CALENDAR_EXISTS', 'Il calendario dei gironi è già stato generato');
  end if;
  if v_stato <> 'iscrizioni' then
    perform private.fail('BAD_STATE', 'Il calendario si genera durante le iscrizioni');
  end if;
  if p_partite is null or jsonb_typeof(p_partite) <> 'array' or jsonb_array_length(p_partite) = 0 then
    perform private.fail('BAD_CALENDAR', 'Calendario vuoto');
  end if;

  begin
    with x as (
      select * from jsonb_to_recordset(p_partite)
        as t(codice text, girone text, turno int, posizione int, squadra_a uuid, squadra_b uuid, periodo_id uuid)
    ),
    -- approved teams per group
    sq as (
      select id, girone from public.squadre
      where torneo_id = p_torneo and stato = 'approvata' and girone is not null
    ),
    coppie as (
      select girone, least(squadra_a, squadra_b) as s1, greatest(squadra_a, squadra_b) as s2 from x
    )
    select case
      when exists (select 1 from x where coalesce(btrim(codice), '') = '' or girone is null
                                    or squadra_a is null or squadra_b is null or squadra_a = squadra_b)
        then 'ogni partita deve avere codice, girone e due coppie diverse'
      when (select count(distinct codice) from x) <> (select count(*) from x)
        then 'codici duplicati'
      when exists (select 1 from x where not exists (select 1 from sq where sq.id = x.squadra_a and sq.girone = x.girone)
                                      or not exists (select 1 from sq where sq.id = x.squadra_b and sq.girone = x.girone))
        then 'ci sono coppie non approvate o di un altro girone'
      when exists (select 1 from x where periodo_id is not null
                     and not exists (select 1 from public.periodi p where p.id = x.periodo_id and p.torneo_id = p_torneo))
        then 'periodo non valido'
      when exists (select 1 from coppie group by girone, s1, s2 having count(*) > 1)
        then 'una coppia di squadre si incontra più di una volta'
      when exists (select 1 from (select distinct girone from sq) g
                   where (select count(*) from coppie c where c.girone = g.girone)
                         <> (select count(*) * (count(*) - 1) / 2 from sq where sq.girone = g.girone))
        then 'girone all''italiana incompleto'
      when exists (select 1 from sq group by girone having count(*) < 2)
        then 'servono almeno due coppie per girone'
    end into v_err;
  exception when others then
    v_err := 'formato non valido (' || sqlerrm || ')';
  end;
  if v_err is not null then
    perform private.fail('BAD_CALENDAR', 'Calendario non valido: ' || v_err);
  end if;

  insert into public.partite (torneo_id, codice, fase, girone, turno, posizione, squadra_a, squadra_b, periodo_id, stato)
  select p_torneo, btrim(codice), 'gironi', girone, turno, posizione, squadra_a, squadra_b, periodo_id, 'da programmare'
  from jsonb_to_recordset(p_partite)
    as t(codice text, girone text, turno int, posizione int, squadra_a uuid, squadra_b uuid, periodo_id uuid);
  get diagnostics v_n = row_count;

  update public.tornei set stato = 'gironi' where id = p_torneo;
  perform private.scrivi_log('genera calendario', p_torneo::text);
  return v_n;
exception when unique_violation then
  perform private.fail('BAD_CALENDAR', 'Calendario non valido: codice già esistente');
end
$$;

-- ------------------------------------------------------------------ final phases

create or replace function public.generate_finals(p_torneo uuid, p_fase text, p_partite jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizzatore');
  v_fase text := lower(btrim(coalesce(p_fase, '')));
  v_generate text[];
  v_stato public.stato_torneo;
  v_n int;
  v_err text;
begin
  select fasi_generate, stato into v_generate, v_stato from public.tornei where id = p_torneo for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Torneo non trovato');
  end if;
  if v_stato not in ('gironi', 'fasiFinali') then
    perform private.fail('BAD_STATE', 'Le fasi finali si generano dopo i gironi');
  end if;
  if v_fase = '' or v_fase = 'gironi' then
    perform private.fail('BAD_BRACKET', 'Nome della fase non valido');
  end if;
  if v_fase = any (v_generate) or exists (select 1 from public.partite where torneo_id = p_torneo and fase = v_fase) then
    perform private.fail('PHASE_EXISTS', format('La fase %s è già stata generata', p_fase));
  end if;
  if p_partite is null or jsonb_typeof(p_partite) <> 'array' or jsonb_array_length(p_partite) = 0 then
    perform private.fail('BAD_BRACKET', 'Tabellone vuoto');
  end if;

  begin
    with x as (
      select * from jsonb_to_recordset(p_partite)
        as t(codice text, turno int, posizione int, prossima_codice text, lato text,
             squadra_a uuid, squadra_b uuid, periodo_id uuid)
    ),
    sq as (select id from public.squadre where torneo_id = p_torneo and stato = 'approvata'),
    team as (select squadra_a as s from x where squadra_a is not null
             union all select squadra_b from x where squadra_b is not null)
    select case
      when exists (select 1 from x where coalesce(btrim(codice), '') = '' or turno is null or turno < 1)
        then 'ogni partita deve avere codice e turno'
      when (select count(distinct codice) from x) <> (select count(*) from x)
        then 'codici duplicati'
      when exists (select 1 from x join public.partite p on p.torneo_id = p_torneo and p.codice = x.codice)
        then 'codice già esistente'
      when (select count(*) from x where prossima_codice is null) <> 1
        then 'serve una sola finale'
      when exists (select 1 from x where (prossima_codice is null) <> (lato is null)
                                      or (lato is not null and lato not in ('A', 'B')))
        then 'lato mancante o non valido'
      when exists (select 1 from x where prossima_codice is not null
                     and not exists (select 1 from x y where y.codice = x.prossima_codice and y.turno = x.turno + 1))
        then 'collegamento al turno successivo non valido'
      when exists (select 1 from x where prossima_codice is not null group by prossima_codice, lato having count(*) > 1)
        then 'due partite alimentano lo stesso lato'
      when exists (select 1 from x where squadra_a is not null and squadra_a = squadra_b)
        then 'una coppia contro se stessa'
      when exists (select 1 from team where s not in (select id from sq))
        then 'ci sono coppie non approvate'
      when exists (select 1 from team group by s having count(*) > 1)
        then 'una coppia compare più volte'
      when exists (select 1 from x where periodo_id is not null
                     and not exists (select 1 from public.periodi p where p.id = x.periodo_id and p.torneo_id = p_torneo))
        then 'periodo non valido'
    end into v_err;
  exception when others then
    v_err := 'formato non valido (' || sqlerrm || ')';
  end;
  if v_err is not null then
    perform private.fail('BAD_BRACKET', 'Tabellone non valido: ' || v_err);
  end if;

  insert into public.partite (torneo_id, codice, fase, turno, posizione, prossima_codice, lato,
                              squadra_a, squadra_b, periodo_id, stato)
  select p_torneo, btrim(codice), v_fase, turno, posizione, prossima_codice, lato, squadra_a, squadra_b, periodo_id,
         'da programmare'
  from jsonb_to_recordset(p_partite)
    as t(codice text, turno int, posizione int, prossima_codice text, lato text,
         squadra_a uuid, squadra_b uuid, periodo_id uuid);
  get diagnostics v_n = row_count;

  update public.tornei set stato = 'fasiFinali', fasi_generate = array_append(fasi_generate, v_fase)
  where id = p_torneo;
  perform private.scrivi_log('genera fase ' || v_fase, p_torneo::text);
  return v_n;
end
$$;

create or replace function public.sync_bracket(p_torneo uuid, p_updates jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizzatore');
  v_u record;
  v_p public.partite;
  v_n int := 0;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    perform private.fail('BAD_BRACKET', 'Aggiornamenti non validi');
  end if;
  for v_u in
    select * from jsonb_to_recordset(p_updates) as t(codice text, squadra_a uuid, squadra_b uuid)
  loop
    select * into v_p from public.partite where torneo_id = p_torneo and codice = v_u.codice for update;
    if not found or v_p.fase = 'gironi' then
      perform private.fail('BAD_BRACKET', format('Partita %s non trovata nel tabellone', v_u.codice));
    end if;
    if exists (select 1 from unnest(array[v_u.squadra_a, v_u.squadra_b]) s
               where s is not null and not exists (
                 select 1 from public.squadre q where q.id = s and q.torneo_id = p_torneo and q.stato = 'approvata'))
       or (v_u.squadra_a is not null and v_u.squadra_a = v_u.squadra_b) then
      perform private.fail('BAD_BRACKET', format('Coppie non valide per la partita %s', v_u.codice));
    end if;
    continue when v_p.stato <> 'da programmare'
      or (v_p.squadra_a is not distinct from v_u.squadra_a and v_p.squadra_b is not distinct from v_u.squadra_b);
    update public.partite set squadra_a = v_u.squadra_a, squadra_b = v_u.squadra_b where id = v_p.id;
    v_n := v_n + 1;
  end loop;
  if v_n > 0 then
    perform private.scrivi_log('sincronizza tabellone', p_torneo::text);
  end if;
  return v_n;
end
$$;

-- ------------------------------------------------------------------ tournament state

-- iscrizioni→gironi happens only in generate_calendar, gironi→fasiFinali only in generate_finals.
-- Here: any→concluso; concluso→previous state (computed); gironi→iscrizioni without group matches.
create or replace function public.set_tournament_state(p_torneo uuid, p_stato public.stato_torneo) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizzatore');
  v_t public.tornei;
  v_gironi boolean;
  v_prec public.stato_torneo;
begin
  select * into v_t from public.tornei where id = p_torneo for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Torneo non trovato');
  end if;
  if p_stato is null then
    perform private.fail('BAD_STATE', 'Stato non valido');
  end if;
  v_gironi := exists (select 1 from public.partite where torneo_id = p_torneo and fase = 'gironi');
  v_prec := case when cardinality(v_t.fasi_generate) > 0 then 'fasiFinali'
                 when v_gironi then 'gironi' else 'iscrizioni' end::public.stato_torneo;
  if p_stato = v_t.stato then
    return;
  elsif p_stato = 'concluso' then
    null;
  elsif v_t.stato = 'concluso' then
    if p_stato <> v_prec then
      perform private.fail('BAD_STATE', format('Il torneo si riapre solo nello stato "%s"', v_prec));
    end if;
  elsif v_t.stato = 'gironi' and p_stato = 'iscrizioni' then
    if v_gironi then
      perform private.fail('BAD_STATE', 'Il calendario dei gironi esiste già: non si torna alle iscrizioni');
    end if;
  else
    perform private.fail('BAD_STATE',
      format('Passaggio da "%s" a "%s" non consentito (usa la generazione del calendario o delle fasi finali)', v_t.stato, p_stato));
  end if;
  update public.tornei set stato = p_stato where id = p_torneo;
  perform private.scrivi_log('stato torneo ' || p_stato::text, p_torneo::text);
end
$$;

-- ------------------------------------------------------------------ roles

create or replace function public.set_roles(p_user uuid, p_roles public.app_role[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('admin');
  v_roles public.app_role[];
begin
  if not exists (select 1 from public.profiles where id = p_user) then
    perform private.fail('NOT_FOUND', 'Utente non trovato');
  end if;
  select array_agg(r order by r) into v_roles
  from (select distinct r from unnest(coalesce(p_roles, '{}') || '{giocatore}'::public.app_role[]) r where r is not null) x;
  if not ('admin' = any (v_roles))
     and not exists (select 1 from public.profiles where id <> p_user and 'admin' = any (roles)) then
    perform private.fail('BAD_STATE', 'Deve restare almeno un amministratore');
  end if;
  update public.profiles set roles = v_roles where id = p_user;
  perform private.scrivi_log('ruoli ' || array_to_string(v_roles, ','), p_user::text);
end
$$;

revoke all on function
  public.create_team(uuid, text),
  public.get_invite(text),
  public.join_team(text),
  public.my_invite_token(uuid),
  public.generate_calendar(uuid, jsonb),
  public.generate_finals(uuid, text, jsonb),
  public.sync_bracket(uuid, jsonb),
  public.set_roles(uuid, public.app_role[]),
  public.set_tournament_state(uuid, public.stato_torneo)
from public, anon;
grant execute on function
  public.create_team(uuid, text),
  public.get_invite(text),
  public.join_team(text),
  public.my_invite_token(uuid),
  public.generate_calendar(uuid, jsonb),
  public.generate_finals(uuid, text, jsonb),
  public.sync_bracket(uuid, jsonb),
  public.set_roles(uuid, public.app_role[]),
  public.set_tournament_state(uuid, public.stato_torneo)
to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role), private.is_giocatore_partita(uuid),
  private.is_trusted(), private.fail(text, text) to authenticated;
