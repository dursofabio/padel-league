-- Booking requests: create, accept, cancel, confirm, reject, cancel confirmed, counter-proposal.

-- Shared by create_request and counter_propose. Caller has already taken
-- private.lock_slot(p_court, p_date) and checked authorisation.
create or replace function private.new_request(
  p_match uuid, p_court text, p_date date, p_start time, p_note text, p_uid uuid, p_counter_proposal boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_m public.matches;
  v_c public.courts;
  v_cfg jsonb;
  v_players uuid[];
  v_active boolean;
  v_on_grid boolean;
  v_step int;
  v_start_min int;
  v_end_min int;
  v_end time;
  v_overlap text;
  v_id uuid;
begin
  perform private.expire_requests(p_court, p_date, p_match);

  select * into v_m from public.matches where id = p_match for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Partita non trovata');
  end if;
  if v_m.status not in ('unscheduled', 'requested') then
    perform private.fail('BAD_STATE', format('La partita è nello stato "%s"', private.label_it(v_m.status::text)));
  end if;
  if v_m.team_a is null or v_m.team_b is null then
    perform private.fail('BAD_STATE', 'Le due coppie della partita non sono ancora note');
  end if;
  if exists (select 1 from public.requests where match_id = p_match and status = 'pending') then
    perform private.fail('MATCH_HAS_REQUEST',
      'La partita ha già una richiesta in attesa: annullala prima di farne un''altra');
  end if;
  v_players := private.match_players(p_match);
  if cardinality(v_players) = 0 then
    perform private.fail('BAD_STATE', 'La partita non ha giocatori');
  end if;

  select * into v_c from public.courts where id = p_court;
  if not found then
    perform private.fail('NOT_FOUND', 'Campo non trovato');
  end if;
  if p_date is null or p_start is null then
    perform private.fail('BAD_STATE', 'Indica giorno e ora');
  end if;

  v_cfg := private.config(v_m.tournament_id);
  v_start_min := private.minutes(p_start);
  v_end_min := v_start_min + v_c.slot_minutes;
  v_active := extract(dow from p_date)::smallint = any (v_c.active_days) and not (p_date = any (v_c.closed_dates));
  if not v_active then
    perform private.fail('COURT_CLOSED', format('Il campo %s è chiuso il %s', v_c.name, to_char(p_date, 'DD/MM/YYYY')));
  end if;
  if v_end_min > 1440 or extract(second from p_start) <> 0 then
    perform private.fail('COURT_CLOSED', 'La partita deve finire entro le 24:00');
  end if;
  v_end := private.minutes_to_time(v_end_min);

  v_on_grid := p_start between v_c.first_slot and v_c.last_slot
    and (v_start_min - private.minutes(v_c.first_slot)) % v_c.slot_minutes = 0;
  if not v_on_grid then
    if not coalesce((v_cfg ->> 'allowOffGrid')::boolean, false) then
      perform private.fail('OFF_GRID_DISABLED', 'Questo torneo non consente richieste fuori griglia');
    end if;
    v_step := greatest(coalesce((v_cfg ->> 'offGridStep')::int, 30), 1);
    if v_start_min % v_step <> 0 then
      perform private.fail('BAD_STEP', format('Fuori griglia si parte ogni %s minuti', v_step));
    end if;
  end if;

  if (p_date + p_start) <= private.local_now() then
    perform private.fail('IN_PAST', 'L''orario è già passato');
  end if;

  select string_agg(format('%s %s–%s%s', private.label_it(b.type::text), to_char(b.start_time, 'HH24:MI'),
           case when b.end_time = '24:00' then '24:00' else to_char(b.end_time, 'HH24:MI') end,
           case when coalesce(b.note, '') <> '' then ' (' || b.note || ')' else '' end), ', ' order by b.start_time)
    into v_overlap
  from public.bookings b
  where b.court_id = p_court and b.time_range && tsrange(p_date + p_start, p_date + v_end, '[)');
  if v_overlap is not null then
    perform private.fail('OVERLAP', 'Il campo è occupato: ' || v_overlap);
  end if;

  -- grid requests never overlap a pending request; off-grid ones may (except the same start)
  if exists (
    select 1 from public.requests r
    where r.court_id = p_court and r.date = p_date and r.status = 'pending'
      and (r.start_time = p_start or (v_on_grid and r.time_range && tsrange(p_date + p_start, p_date + v_end, '[)')))
  ) then
    perform private.fail('SLOT_TAKEN', 'Lo slot è già stato richiesto da un''altra partita');
  end if;

  begin
    insert into public.requests (tournament_id, match_id, court_id, date, start_time, end_time, off_grid,
                                 counter_proposal, status, expires_at, created_by, note)
    values (v_m.tournament_id, p_match, p_court, p_date, p_start, v_end, not v_on_grid, p_counter_proposal,
            'pending', now() + make_interval(hours => greatest(coalesce((v_cfg ->> 'requestExpiryHours')::int, 48), 1)),
            p_uid, nullif(btrim(p_note), ''))
    returning id into v_id;
  exception when unique_violation then
    perform private.fail('SLOT_TAKEN', 'Lo slot è appena stato richiesto da un''altra partita');
  end;

  -- acceptances: the creator (if a player) and every player whose availability covers the slot
  insert into public.request_players (request_id, user_id, accepted_at)
  select v_id, pl,
         case when pl = p_uid or private.window_covers(av.windows, p_date, p_start, v_end) then now() end
  from unnest(v_players) as pl
  left join public.availability av on av.tournament_id = v_m.tournament_id and av.user_id = pl;

  update public.matches set status = 'requested', request_id = v_id where id = p_match;
  return v_id;
end
$$;

create or replace function public.create_request(
  p_match uuid, p_court text, p_date date, p_start time, p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_id uuid;
begin
  perform private.lock_slot(p_court, p_date);
  if not exists (select 1 from public.matches where id = p_match) then
    perform private.fail('NOT_FOUND', 'Partita non trovata');
  end if;
  if private.player_side(p_match, v_uid) is null then
    perform private.fail('NOT_AUTHORIZED', 'Solo i giocatori della partita possono richiedere uno slot');
  end if;
  v_id := private.new_request(p_match, p_court, p_date, p_start, p_note, v_uid, false);
  perform private.write_log('request', v_id::text);
  return v_id;
end
$$;

create or replace function public.accept_request(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_r public.requests;
begin
  select * into v_r from public.requests where id = p_request for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  if not exists (select 1 from public.request_players where request_id = p_request and user_id = v_uid) then
    perform private.fail('NOT_AUTHORIZED', 'Non sei tra i giocatori di questa richiesta');
  end if;
  if v_r.status <> 'pending' then
    perform private.fail('BAD_STATE', 'La richiesta non è più in attesa');
  end if;
  if v_r.expires_at <= now() then
    perform private.fail('EXPIRED', 'La richiesta è scaduta');
  end if;
  update public.request_players set accepted_at = coalesce(accepted_at, now())
  where request_id = p_request and user_id = v_uid;
end
$$;

create or replace function public.cancel_request(p_request uuid, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_r public.requests;
begin
  select * into v_r from public.requests where id = p_request for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  if not exists (select 1 from public.request_players where request_id = p_request and user_id = v_uid) then
    perform private.fail('NOT_AUTHORIZED', 'Non sei tra i giocatori di questa richiesta');
  end if;
  if v_r.status <> 'pending' then
    perform private.fail('BAD_STATE', 'La richiesta non è più in attesa');
  end if;
  update public.requests
  set status = 'cancelled', note = coalesce(nullif(btrim(p_note), ''), 'Annullata da un giocatore')
  where id = p_request;
  perform private.release_match(v_r.match_id, v_r.id);
  perform private.write_log('cancel request', p_request::text);
end
$$;

create or replace function public.confirm_request(p_request uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('manager');
  v_court text;
  v_date date;
  v_r public.requests;
  v_m public.matches;
  v_conflicts int;
begin
  select court_id, date into v_court, v_date from public.requests where id = p_request;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  perform private.lock_slot(v_court, v_date);

  select * into v_r from public.requests where id = p_request for update;
  if v_r.status = 'conflict' then
    -- overlapped meanwhile (e.g. another confirmation or a booking): never raise on overlap
    return jsonb_build_object('outcome', 'taken', 'conflicts', 0);
  end if;
  if v_r.status <> 'pending' then
    perform private.fail('BAD_STATE', format('La richiesta non è più in attesa (stato: %s)', private.label_it(v_r.status::text)));
  end if;
  if v_r.expires_at <= now() then
    update public.requests set status = 'expired', note = 'Nessuna risposta entro la scadenza' where id = p_request;
    perform private.release_match(v_r.match_id, v_r.id);
    return jsonb_build_object('outcome', 'expired', 'conflicts', 0);
  end if;

  select * into v_m from public.matches where id = v_r.match_id for update;
  if v_m.request_id is distinct from v_r.id or v_m.status <> 'requested' then
    perform private.fail('BAD_STATE', 'La partita non è collegata a questa richiesta');
  end if;
  -- 4/4 acceptances, from exactly the current players of the match
  if exists (select 1 from public.request_players where request_id = p_request and accepted_at is null)
     or (select coalesce(array_agg(user_id order by user_id), '{}') from public.request_players
         where request_id = p_request)
        is distinct from (select coalesce(array_agg(pl order by pl), '{}')
                          from unnest(private.match_players(v_r.match_id)) pl)
  then
    perform private.fail('NOT_ALL_ACCEPTED', 'Mancano delle accettazioni: si conferma solo con 4 su 4');
  end if;

  begin
    insert into public.bookings (court_id, date, start_time, end_time, type, match_id, request_id, tournament_id, created_by)
    values (v_r.court_id, v_r.date, v_r.start_time, v_r.end_time, 'match', v_r.match_id, v_r.id, v_r.tournament_id, v_uid);
  exception when exclusion_violation then
    update public.requests
    set status = 'conflict', note = 'Campo occupato al momento della conferma', handled_by = v_uid
    where id = p_request;
    perform private.release_match(v_r.match_id, v_r.id);
    perform private.write_log('confirm: court taken', p_request::text);
    return jsonb_build_object('outcome', 'taken', 'conflicts', 0);
  end;

  v_conflicts := private.mark_conflicting_requests(v_r.court_id, v_r.date, v_r.start_time, v_r.end_time, v_r.id,
    format('Sovrapposta a una partita confermata (%s–%s)', to_char(v_r.start_time, 'HH24:MI'), to_char(v_r.end_time, 'HH24:MI')),
    v_uid);
  update public.requests set status = 'confirmed', handled_by = v_uid where id = p_request;
  update public.matches set status = 'scheduled' where id = v_r.match_id;
  perform private.write_log('confirm request', p_request::text);
  return jsonb_build_object('outcome', 'ok', 'conflicts', v_conflicts);
end
$$;

create or replace function public.reject_request(p_request uuid, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('manager');
  v_r public.requests;
begin
  select * into v_r from public.requests where id = p_request for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  if v_r.status <> 'pending' then
    perform private.fail('BAD_STATE', 'La richiesta non è più in attesa');
  end if;
  update public.requests set status = 'rejected', note = nullif(btrim(p_note), ''), handled_by = v_uid
  where id = p_request;
  perform private.release_match(v_r.match_id, v_r.id);
  perform private.write_log('reject request', p_request::text);
end
$$;

-- Shared by cancel_confirmed (manager) and player_cancel_confirmed (a player of the match).
-- Frees the court, request -> 'cancelled', match -> 'unscheduled' (refused if it has a result).
-- p_min_hours: when not null, the start must be at least that many hours away (else TOO_LATE).
create or replace function private.cancel_confirmed_request(
  p_request uuid, p_note text, p_uid uuid, p_by_player boolean, p_min_hours numeric
) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  v_court text;
  v_date date;
  v_r public.requests;
  v_m public.matches;
  v_start timestamptz;
begin
  select court_id, date into v_court, v_date from public.requests where id = p_request;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  if p_by_player and private.player_side((select match_id from public.requests where id = p_request), p_uid) is null then
    perform private.fail('NOT_AUTHORIZED', 'Solo i giocatori della partita possono annullarla');
  end if;
  perform private.lock_slot(v_court, v_date);
  select * into v_r from public.requests where id = p_request for update;
  if v_r.status <> 'confirmed' then
    perform private.fail('BAD_STATE', 'La richiesta non è confermata');
  end if;
  select * into v_m from public.matches where id = v_r.match_id for update;
  if v_m.request_id = v_r.id and v_m.status in ('played', 'disputed', 'forfeit') then
    perform private.fail('BAD_STATE', 'La partita ha già un risultato: annullalo prima');
  end if;
  if p_min_hours is not null then
    -- date + start_time are Europe/Rome wall-clock values
    v_start := (v_r.date + v_r.start_time) at time zone 'Europe/Rome';
    if v_start < now() + make_interval(secs => p_min_hours * 3600) then
      perform private.fail('TOO_LATE', format(
        'Troppo tardi: si può annullare fino a %s ore prima dell''inizio. Contatta il gestore', p_min_hours));
    end if;
  end if;
  delete from public.bookings where request_id = p_request;
  update public.requests
  set status = 'cancelled', handled_by = p_uid,
      note = coalesce(nullif(btrim(p_note), ''),
                      case when p_by_player then 'Annullata da un giocatore' else 'Annullata dal gestore' end)
  where id = p_request
  returning * into v_r;
  update public.matches set status = 'unscheduled', request_id = null
  where id = v_r.match_id and request_id = v_r.id and status = 'scheduled';
  return v_r;
end
$$;

create or replace function public.cancel_confirmed(p_request uuid, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('manager');
begin
  perform private.cancel_confirmed_request(p_request, p_note, v_uid, false, null);
  perform private.write_log('cancel confirmed match', p_request::text);
end
$$;

-- A player cancels a confirmed match until config.playerCancelHours hours before the start.
create or replace function public.player_cancel_confirmed(p_request uuid, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_tournament uuid;
  v_hours numeric;
  v_r public.requests;
begin
  select tournament_id into v_tournament from public.requests where id = p_request;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  v_hours := greatest(coalesce((private.config(v_tournament) ->> 'playerCancelHours')::numeric, 24), 0);
  v_r := private.cancel_confirmed_request(p_request, p_note, v_uid, true, v_hours);
  perform private.write_log(
    format('player cancels confirmed match (%s %s %s)%s', v_r.court_id, to_char(v_r.date, 'DD/MM/YYYY'),
           to_char(v_r.start_time, 'HH24:MI'), coalesce(': ' || nullif(btrim(p_note), ''), '')),
    p_request::text);
end
$$;

create or replace function public.counter_propose(
  p_request uuid, p_court text, p_date date, p_start time, p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('manager');
  v_r public.requests;
  v_id uuid;
begin
  perform private.lock_slot(p_court, p_date);
  select * into v_r from public.requests where id = p_request for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  if v_r.status <> 'pending' then
    perform private.fail('BAD_STATE', 'La richiesta non è più in attesa');
  end if;
  update public.requests
  set status = 'rejected', handled_by = v_uid,
      note = format('Controproposta: %s %s', to_char(p_date, 'DD/MM/YYYY'), to_char(p_start, 'HH24:MI'))
  where id = p_request;
  perform private.release_match(v_r.match_id, v_r.id);
  v_id := private.new_request(v_r.match_id, p_court, p_date, p_start, p_note, v_uid, true);
  perform private.write_log('counter-proposal', v_id::text);
  return v_id;
end
$$;

revoke all on function
  public.create_request(uuid, text, date, time, text),
  public.accept_request(uuid),
  public.cancel_request(uuid, text),
  public.confirm_request(uuid),
  public.reject_request(uuid, text),
  public.cancel_confirmed(uuid, text),
  public.player_cancel_confirmed(uuid, text),
  public.counter_propose(uuid, text, date, time, text)
from public, anon;
grant execute on function
  public.create_request(uuid, text, date, time, text),
  public.accept_request(uuid),
  public.cancel_request(uuid, text),
  public.confirm_request(uuid),
  public.reject_request(uuid, text),
  public.cancel_confirmed(uuid, text),
  public.player_cancel_confirmed(uuid, text),
  public.counter_propose(uuid, text, date, time, text)
to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role), private.is_match_player(uuid),
  private.is_trusted(), private.fail(text, text), private.config_default() to authenticated;
