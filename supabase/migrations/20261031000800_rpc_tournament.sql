-- Teams and invites, schedule and final phases, roles.

create or replace function public.create_team(p_tournament uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_status public.tournament_status;
  v_id uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  select status into v_status from public.tournaments where id = p_tournament for share;
  if not found then
    perform private.fail('NOT_FOUND', 'Torneo non trovato');
  end if;
  if v_status <> 'registration' then
    perform private.fail('REGISTRATION_CLOSED', 'Le iscrizioni sono chiuse');
  end if;
  if coalesce(btrim(p_name), '') = '' then
    perform private.fail('BAD_STATE', 'Dai un nome alla coppia');
  end if;
  if exists (select 1 from public.team_players where tournament_id = p_tournament and user_id = v_uid) then
    perform private.fail('ALREADY_IN_TEAM', 'Fai già parte di una coppia in questo torneo');
  end if;
  insert into public.teams (tournament_id, name, created_by) values (p_tournament, btrim(p_name), v_uid)
  returning id into v_id;
  insert into public.team_players (team_id, tournament_id, user_id, position) values (v_id, p_tournament, v_uid, 1);
  insert into public.invites (token, team_id, tournament_id, created_by) values (v_token, v_id, p_tournament, v_uid);
  perform private.write_log('create team', v_id::text);
  return jsonb_build_object('team_id', v_id, 'token', v_token);
end
$$;

create or replace function public.get_invite(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_res jsonb;
begin
  perform private.require_uid();
  select jsonb_build_object(
           'team_id', t.id, 'tournament_id', t.tournament_id, 'name', t.name,
           'creator_name', coalesce(pr.name, ''), 'status', t.status,
           'players', (select count(*) from public.team_players tp where tp.team_id = t.id))
    into v_res
  from public.invites i
  join public.teams t on t.id = i.team_id
  left join public.profiles pr on pr.id = t.created_by
  where i.token = p_token;
  return v_res;
end
$$;

create or replace function public.join_team(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_i public.invites;
  v_t public.teams;
begin
  select * into v_i from public.invites where token = p_token;
  if not found then
    perform private.fail('BAD_TOKEN', 'Link d''invito non valido');
  end if;
  select * into v_t from public.teams where id = v_i.team_id for update;
  if exists (select 1 from public.team_players where team_id = v_t.id and user_id = v_uid) then
    perform private.fail('ALREADY_IN_TEAM', 'Fai già parte di questa coppia');
  end if;
  if (select status from public.tournaments where id = v_t.tournament_id) <> 'registration' then
    perform private.fail('REGISTRATION_CLOSED', 'Le iscrizioni sono chiuse');
  end if;
  if v_t.status <> 'awaiting_partner'
     or (select count(*) from public.team_players where team_id = v_t.id) >= 2 then
    perform private.fail('TEAM_FULL', 'La coppia è già completa');
  end if;
  if exists (select 1 from public.team_players where tournament_id = v_t.tournament_id and user_id = v_uid) then
    perform private.fail('ALREADY_IN_TEAM', 'Fai già parte di un''altra coppia in questo torneo');
  end if;
  insert into public.team_players (team_id, tournament_id, user_id, position) values (v_t.id, v_t.tournament_id, v_uid, 2);
  update public.teams set status = 'pending_approval' where id = v_t.id;
  perform private.write_log('join team', v_t.id::text);
  return v_t.id;
end
$$;

create or replace function public.my_invite_token(p_team uuid) returns text
language sql stable security definer set search_path = '' as $$
  select token from public.invites
  where team_id = p_team and created_by = auth.uid()
  order by token limit 1
$$;

-- ------------------------------------------------------------------ schedule

create or replace function public.generate_calendar(p_tournament uuid, p_matches jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizer');
  v_n int;
  v_err text;
  v_status public.tournament_status;
begin
  select status into v_status from public.tournaments where id = p_tournament for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Torneo non trovato');
  end if;
  if exists (select 1 from public.matches where tournament_id = p_tournament and phase = 'groups') then
    perform private.fail('CALENDAR_EXISTS', 'Il calendario dei gironi è già stato generato');
  end if;
  if v_status <> 'registration' then
    perform private.fail('BAD_STATE', 'Il calendario si genera durante le iscrizioni');
  end if;
  if p_matches is null or jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) = 0 then
    perform private.fail('BAD_CALENDAR', 'Calendario vuoto');
  end if;

  begin
    with x as (
      select * from jsonb_to_recordset(p_matches)
        as t(code text, group_name text, round int, position int, team_a uuid, team_b uuid, period_id uuid)
    ),
    -- approved teams per group
    tm as (
      select id, group_name from public.teams
      where tournament_id = p_tournament and status = 'approved' and group_name is not null
    ),
    pairs as (
      select group_name, least(team_a, team_b) as t1, greatest(team_a, team_b) as t2 from x
    )
    select case
      when exists (select 1 from x where coalesce(btrim(code), '') = '' or group_name is null
                                    or team_a is null or team_b is null or team_a = team_b)
        then 'ogni partita deve avere codice, girone e due coppie diverse'
      when (select count(distinct code) from x) <> (select count(*) from x)
        then 'codici duplicati'
      when exists (select 1 from x where not exists (select 1 from tm where tm.id = x.team_a and tm.group_name = x.group_name)
                                      or not exists (select 1 from tm where tm.id = x.team_b and tm.group_name = x.group_name))
        then 'ci sono coppie non approvate o di un altro girone'
      when exists (select 1 from x where period_id is not null
                     and not exists (select 1 from public.periods p where p.id = x.period_id and p.tournament_id = p_tournament))
        then 'periodo non valido'
      when exists (select 1 from pairs group by group_name, t1, t2 having count(*) > 1)
        then 'una coppia di squadre si incontra più di una volta'
      when exists (select 1 from (select distinct group_name from tm) g
                   where (select count(*) from pairs pr where pr.group_name = g.group_name)
                         <> (select count(*) * (count(*) - 1) / 2 from tm where tm.group_name = g.group_name))
        then 'girone all''italiana incompleto'
      when exists (select 1 from tm group by group_name having count(*) < 2)
        then 'servono almeno due coppie per girone'
    end into v_err;
  exception when others then
    v_err := 'formato non valido (' || sqlerrm || ')';
  end;
  if v_err is not null then
    perform private.fail('BAD_CALENDAR', 'Calendario non valido: ' || v_err);
  end if;

  insert into public.matches (tournament_id, code, phase, group_name, round, position, team_a, team_b, period_id, status)
  select p_tournament, btrim(t.code), 'groups', t.group_name, t.round, t.position, t.team_a, t.team_b, t.period_id, 'unscheduled'
  from jsonb_to_recordset(p_matches)
    as t(code text, group_name text, round int, position int, team_a uuid, team_b uuid, period_id uuid);
  get diagnostics v_n = row_count;

  update public.tournaments set status = 'groups' where id = p_tournament;
  perform private.write_log('generate calendar', p_tournament::text);
  return v_n;
exception when unique_violation then
  perform private.fail('BAD_CALENDAR', 'Calendario non valido: codice già esistente');
end
$$;

-- ------------------------------------------------------------------ final phases

create or replace function public.generate_finals(p_tournament uuid, p_phase text, p_matches jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizer');
  v_phase text := lower(btrim(coalesce(p_phase, '')));
  v_generated text[];
  v_status public.tournament_status;
  v_n int;
  v_err text;
begin
  select generated_phases, status into v_generated, v_status from public.tournaments where id = p_tournament for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Torneo non trovato');
  end if;
  if v_status not in ('groups', 'finals') then
    perform private.fail('BAD_STATE', 'Le fasi finali si generano dopo i gironi');
  end if;
  if v_phase = '' or v_phase = 'groups' then
    perform private.fail('BAD_BRACKET', 'Nome della fase non valido');
  end if;
  if v_phase = any (v_generated) or exists (select 1 from public.matches where tournament_id = p_tournament and phase = v_phase) then
    perform private.fail('PHASE_EXISTS', format('La fase %s è già stata generata', p_phase));
  end if;
  if p_matches is null or jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) = 0 then
    perform private.fail('BAD_BRACKET', 'Tabellone vuoto');
  end if;

  begin
    with x as (
      select * from jsonb_to_recordset(p_matches)
        as t(code text, round int, position int, next_code text, side text,
             team_a uuid, team_b uuid, period_id uuid)
    ),
    tm as (select id from public.teams where tournament_id = p_tournament and status = 'approved'),
    entrants as (select team_a as e from x where team_a is not null
                 union all select team_b from x where team_b is not null)
    select case
      when exists (select 1 from x where coalesce(btrim(code), '') = '' or round is null or round < 1)
        then 'ogni partita deve avere codice e turno'
      when (select count(distinct code) from x) <> (select count(*) from x)
        then 'codici duplicati'
      when exists (select 1 from x join public.matches m on m.tournament_id = p_tournament and m.code = x.code)
        then 'codice già esistente'
      when (select count(*) from x where next_code is null) <> 1
        then 'serve una sola finale'
      when exists (select 1 from x where (next_code is null) <> (side is null)
                                      or (side is not null and side not in ('A', 'B')))
        then 'lato mancante o non valido'
      when exists (select 1 from x where next_code is not null
                     and not exists (select 1 from x y where y.code = x.next_code and y.round = x.round + 1))
        then 'collegamento al turno successivo non valido'
      when exists (select 1 from x where next_code is not null group by next_code, side having count(*) > 1)
        then 'due partite alimentano lo stesso lato'
      when exists (select 1 from x where team_a is not null and team_a = team_b)
        then 'una coppia contro se stessa'
      when exists (select 1 from entrants where e not in (select id from tm))
        then 'ci sono coppie non approvate'
      when exists (select 1 from entrants group by e having count(*) > 1)
        then 'una coppia compare più volte'
      when exists (select 1 from x where period_id is not null
                     and not exists (select 1 from public.periods p where p.id = x.period_id and p.tournament_id = p_tournament))
        then 'periodo non valido'
    end into v_err;
  exception when others then
    v_err := 'formato non valido (' || sqlerrm || ')';
  end;
  if v_err is not null then
    perform private.fail('BAD_BRACKET', 'Tabellone non valido: ' || v_err);
  end if;

  insert into public.matches (tournament_id, code, phase, round, position, next_code, side,
                              team_a, team_b, period_id, status)
  select p_tournament, btrim(t.code), v_phase, t.round, t.position, t.next_code, t.side, t.team_a, t.team_b, t.period_id,
         'unscheduled'
  from jsonb_to_recordset(p_matches)
    as t(code text, round int, position int, next_code text, side text,
         team_a uuid, team_b uuid, period_id uuid);
  get diagnostics v_n = row_count;

  update public.tournaments set status = 'finals', generated_phases = array_append(generated_phases, v_phase)
  where id = p_tournament;
  perform private.write_log('generate phase ' || v_phase, p_tournament::text);
  return v_n;
end
$$;

create or replace function public.sync_bracket(p_tournament uuid, p_updates jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizer');
  v_u record;
  v_m public.matches;
  v_n int := 0;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    perform private.fail('BAD_BRACKET', 'Aggiornamenti non validi');
  end if;
  for v_u in
    select * from jsonb_to_recordset(p_updates) as t(code text, team_a uuid, team_b uuid)
  loop
    select * into v_m from public.matches where tournament_id = p_tournament and code = v_u.code for update;
    if not found or v_m.phase = 'groups' then
      perform private.fail('BAD_BRACKET', format('Partita %s non trovata nel tabellone', v_u.code));
    end if;
    if exists (select 1 from unnest(array[v_u.team_a, v_u.team_b]) s
               where s is not null and not exists (
                 select 1 from public.teams q where q.id = s and q.tournament_id = p_tournament and q.status = 'approved'))
       or (v_u.team_a is not null and v_u.team_a = v_u.team_b) then
      perform private.fail('BAD_BRACKET', format('Coppie non valide per la partita %s', v_u.code));
    end if;
    continue when v_m.status <> 'unscheduled'
      or (v_m.team_a is not distinct from v_u.team_a and v_m.team_b is not distinct from v_u.team_b);
    update public.matches set team_a = v_u.team_a, team_b = v_u.team_b where id = v_m.id;
    v_n := v_n + 1;
  end loop;
  if v_n > 0 then
    perform private.write_log('sync bracket', p_tournament::text);
  end if;
  return v_n;
end
$$;

-- ------------------------------------------------------------------ tournament status

-- registration→groups happens only in generate_calendar, groups→finals only in generate_finals.
-- Here: any→completed; completed→previous status (computed); groups→registration without group matches.
create or replace function public.set_tournament_state(p_tournament uuid, p_status public.tournament_status) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizer');
  v_t public.tournaments;
  v_has_groups boolean;
  v_prev public.tournament_status;
begin
  select * into v_t from public.tournaments where id = p_tournament for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Torneo non trovato');
  end if;
  if p_status is null then
    perform private.fail('BAD_STATE', 'Stato non valido');
  end if;
  v_has_groups := exists (select 1 from public.matches where tournament_id = p_tournament and phase = 'groups');
  v_prev := case when cardinality(v_t.generated_phases) > 0 then 'finals'
                 when v_has_groups then 'groups' else 'registration' end::public.tournament_status;
  if p_status = v_t.status then
    return;
  elsif p_status = 'completed' then
    null;
  elsif v_t.status = 'completed' then
    if p_status <> v_prev then
      perform private.fail('BAD_STATE', format('Il torneo si riapre solo nello stato "%s"', private.label_it(v_prev::text)));
    end if;
  elsif v_t.status = 'groups' and p_status = 'registration' then
    if v_has_groups then
      perform private.fail('BAD_STATE', 'Il calendario dei gironi esiste già: non si torna alle iscrizioni');
    end if;
  else
    perform private.fail('BAD_STATE',
      format('Passaggio da "%s" a "%s" non consentito (usa la generazione del calendario o delle fasi finali)',
             private.label_it(v_t.status::text), private.label_it(p_status::text)));
  end if;
  update public.tournaments set status = p_status where id = p_tournament;
  perform private.write_log('tournament status ' || p_status::text, p_tournament::text);
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
  from (select distinct r from unnest(coalesce(p_roles, '{}') || '{player}'::public.app_role[]) r where r is not null) x;
  if not ('admin' = any (v_roles))
     and not exists (select 1 from public.profiles where id <> p_user and 'admin' = any (roles)) then
    perform private.fail('BAD_STATE', 'Deve restare almeno un amministratore');
  end if;
  update public.profiles set roles = v_roles where id = p_user;
  perform private.write_log('roles ' || array_to_string(v_roles, ','), p_user::text);
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
  public.set_tournament_state(uuid, public.tournament_status)
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
  public.set_tournament_state(uuid, public.tournament_status)
to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role), private.is_match_player(uuid),
  private.is_trusted(), private.fail(text, text), private.config_default() to authenticated;
