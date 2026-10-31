-- Results: players submit/confirm/contest; organizer official result, forfeit, clear.

-- A request of the match still pending is cancelled once the match has a result.
create or replace function private.cancel_pending_request(p_match uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  update public.requests set status = 'cancelled', note = p_note
  where match_id = p_match and status = 'pending'
  returning id into v_id;
  if v_id is not null then
    update public.matches set request_id = null where id = p_match and request_id = v_id;
  end if;
end
$$;

-- Locks the match and checks it can take a (new) result.
create or replace function private.lock_match_for_result(p_match uuid) returns public.matches
language plpgsql security definer set search_path = '' as $$
declare
  v_m public.matches;
begin
  select * into v_m from public.matches where id = p_match for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Partita non trovata');
  end if;
  if v_m.team_a is null or v_m.team_b is null then
    perform private.fail('BAD_STATE', 'Le due coppie della partita non sono ancora note');
  end if;
  return v_m;
end
$$;

create or replace function private.validate_or_fail(p_tournament uuid, p_sets jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb := private.validate_result(p_sets, private.config(p_tournament) -> 'setFormat');
begin
  if not (v_check ->> 'ok')::boolean then
    perform private.fail('INVALID_SCORE', v_check ->> 'error');
  end if;
end
$$;

create or replace function public.submit_result(p_match uuid, p_sets jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_m public.matches;
  v_side text;
begin
  v_m := private.lock_match_for_result(p_match);
  v_side := private.player_side(p_match, v_uid);
  if v_side is null then
    perform private.fail('NOT_AUTHORIZED', 'Solo i giocatori della partita inseriscono il risultato');
  end if;
  if v_m.status in ('played', 'forfeit') then
    perform private.fail('ALREADY_CONFIRMED', 'Il risultato è già confermato: può modificarlo solo l''organizzatore');
  end if;
  if v_m.status = 'disputed' then
    perform private.fail('BAD_STATE', 'Il risultato è contestato: decide l''organizzatore');
  end if;
  -- before confirmation only the same pair can overwrite; the opponents confirm or contest
  if v_m.entered_by is not null and private.player_side(p_match, v_m.entered_by) is distinct from v_side then
    perform private.fail('NOT_AUTHORIZED', 'Il risultato è stato inserito dagli avversari: confermalo o contestalo');
  end if;
  perform private.validate_or_fail(v_m.tournament_id, p_sets);
  update public.matches
  set sets = p_sets, entered_by = v_uid, confirmed_by = null, disputed_by = null, result_note = null
  where id = p_match;
  perform private.write_log('submit result', p_match::text);
end
$$;

-- Common checks for confirm/contest: pending result, caller on the other side.
create or replace function private.match_to_confirm(p_match uuid, p_uid uuid) returns public.matches
language plpgsql security definer set search_path = '' as $$
declare
  v_m public.matches;
  v_side text;
begin
  v_m := private.lock_match_for_result(p_match);
  if v_m.status in ('played', 'forfeit') or v_m.confirmed_by is not null then
    perform private.fail('ALREADY_CONFIRMED', 'Il risultato è già confermato');
  end if;
  if v_m.status = 'disputed' then
    perform private.fail('BAD_STATE', 'Il risultato è già contestato');
  end if;
  if v_m.entered_by is null or v_m.sets is null then
    perform private.fail('BAD_STATE', 'Non c''è ancora un risultato da confermare');
  end if;
  v_side := private.player_side(p_match, p_uid);
  if v_side is null or v_side = private.player_side(p_match, v_m.entered_by) then
    perform private.fail('NOT_AUTHORIZED', 'Conferma o contesta solo un giocatore della coppia avversaria');
  end if;
  return v_m;
end
$$;

create or replace function public.confirm_result(p_match uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
begin
  perform private.match_to_confirm(p_match, v_uid);
  perform private.cancel_pending_request(p_match, 'Annullata: risultato confermato');
  update public.matches set status = 'played', confirmed_by = v_uid where id = p_match;
  perform private.write_log('confirm result', p_match::text);
end
$$;

create or replace function public.contest_result(p_match uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
begin
  perform private.match_to_confirm(p_match, v_uid);
  perform private.cancel_pending_request(p_match, 'Annullata: risultato contestato');
  update public.matches set status = 'disputed', disputed_by = v_uid, result_note = nullif(btrim(p_note), '')
  where id = p_match;
  perform private.write_log('contest result', p_match::text);
end
$$;

create or replace function public.set_official_result(p_match uuid, p_sets jsonb, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizer');
  v_m public.matches;
begin
  v_m := private.lock_match_for_result(p_match);
  perform private.validate_or_fail(v_m.tournament_id, p_sets);
  perform private.cancel_pending_request(p_match, 'Annullata: risultato ufficiale');
  update public.matches
  set sets = p_sets, entered_by = coalesce(entered_by, v_uid), confirmed_by = v_uid,
      result_note = nullif(btrim(p_note), ''), status = 'played'
  where id = p_match;
  perform private.write_log('set official result', p_match::text);
end
$$;

create or replace function public.assign_forfeit(p_match uuid, p_winner text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizer');
  v_m public.matches;
  v_n int;
  v_sets jsonb;
begin
  if p_winner is null or p_winner not in ('A', 'B') then
    perform private.fail('BAD_STATE', 'Indica la coppia vincente (A o B)');
  end if;
  v_m := private.lock_match_for_result(p_match);
  v_n := greatest(coalesce((private.config(v_m.tournament_id) #>> '{setFormat,setsToWin}')::int, 2), 1);
  select jsonb_agg(case when p_winner = 'A' then '{"a":6,"b":0}'::jsonb else '{"a":0,"b":6}'::jsonb end)
    into v_sets from generate_series(1, v_n);
  perform private.cancel_pending_request(p_match, 'Annullata: tavolino');
  update public.matches
  set sets = v_sets, entered_by = v_uid, confirmed_by = v_uid, disputed_by = null,
      result_note = coalesce(nullif(btrim(p_note), ''), 'Tavolino'), status = 'forfeit'
  where id = p_match;
  perform private.write_log('forfeit', p_match::text);
end
$$;

create or replace function public.clear_result(p_match uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizer');
  v_m public.matches;
  v_request_status public.request_status;
begin
  select * into v_m from public.matches where id = p_match for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Partita non trovata');
  end if;
  select status into v_request_status from public.requests where id = v_m.request_id;
  update public.matches
  set sets = null, entered_by = null, confirmed_by = null, disputed_by = null, result_note = null,
      status = case v_request_status when 'confirmed' then 'scheduled'::public.match_status
                                     when 'pending' then 'requested'::public.match_status
                                     else 'unscheduled'::public.match_status end,
      request_id = case when v_request_status in ('confirmed', 'pending') then request_id end
  where id = p_match;
  perform private.write_log('clear result', p_match::text);
end
$$;

revoke all on function
  public.submit_result(uuid, jsonb),
  public.confirm_result(uuid),
  public.contest_result(uuid, text),
  public.set_official_result(uuid, jsonb, text),
  public.assign_forfeit(uuid, text, text),
  public.clear_result(uuid)
from public, anon;
grant execute on function
  public.submit_result(uuid, jsonb),
  public.confirm_result(uuid),
  public.contest_result(uuid, text),
  public.set_official_result(uuid, jsonb, text),
  public.assign_forfeit(uuid, text, text),
  public.clear_result(uuid)
to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role), private.is_match_player(uuid),
  private.is_trusted(), private.fail(text, text), private.config_default() to authenticated;
