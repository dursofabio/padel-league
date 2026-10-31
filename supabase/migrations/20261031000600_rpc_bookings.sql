-- Court bookings: add/remove, close a day, materialise recurrences.

-- Adds a non-match booking. Raises OVERLAP on overlap with another booking.
-- Pending requests that overlap become 'conflict'. Takes the court/day lock itself.
create or replace function private.add_booking(
  p_court text, p_date date, p_start time, p_end time, p_type public.booking_type,
  p_note text, p_uid uuid, p_recurrence uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_overlap text;
  v_id uuid;
  v_conflicts int;
  v_end_txt text := case when p_end = '24:00' then '24:00' else to_char(p_end, 'HH24:MI') end;
begin
  if p_type is null or p_type = 'match' then
    perform private.fail('BAD_STATE', 'Le partite del campionato si programmano dalle richieste');
  end if;
  if p_date is null or p_start is null or p_end is null or p_end <= p_start then
    perform private.fail('BAD_STATE', 'L''orario di fine deve seguire quello di inizio');
  end if;
  if not exists (select 1 from public.courts where id = p_court) then
    perform private.fail('NOT_FOUND', 'Campo non trovato');
  end if;
  perform private.lock_slot(p_court, p_date);
  perform private.expire_requests(p_court, p_date, null);

  select string_agg(format('%s %s–%s%s', private.label_it(b.type::text), to_char(b.start_time, 'HH24:MI'),
           case when b.end_time = '24:00' then '24:00' else to_char(b.end_time, 'HH24:MI') end,
           case when coalesce(b.note, '') <> '' then ' (' || b.note || ')' else '' end), ', ' order by b.start_time)
    into v_overlap
  from public.bookings b
  where b.court_id = p_court and b.time_range && tsrange(p_date + p_start, p_date + p_end, '[)');
  if v_overlap is not null then
    perform private.fail('OVERLAP', 'Si sovrappone a: ' || v_overlap);
  end if;

  begin
    insert into public.bookings (court_id, date, start_time, end_time, type, note, recurrence_id, created_by)
    values (p_court, p_date, p_start, p_end, p_type, nullif(btrim(p_note), ''), p_recurrence, p_uid)
    returning id into v_id;
  exception when exclusion_violation then
    perform private.fail('OVERLAP', 'Si sovrappone a un''occupazione appena inserita');
  end;

  v_conflicts := private.mark_conflicting_requests(p_court, p_date, p_start, p_end, null,
    format('Campo occupato: %s %s–%s', private.label_it(p_type::text), to_char(p_start, 'HH24:MI'), v_end_txt), p_uid);
  return jsonb_build_object('id', v_id, 'conflicts', v_conflicts);
end
$$;

-- Materialises a recurrence from max(today, valid_from) to min(valid_to, today + days). Idempotent.
create or replace function private.materialize(p_recurrence uuid, p_days int, p_uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_r public.recurrences;
  v_d date;
  v_created int := 0;
  v_skipped text[] := '{}';
begin
  select * into v_r from public.recurrences where id = p_recurrence;
  if not found then
    perform private.fail('NOT_FOUND', 'Ricorrenza non trovata');
  end if;
  for v_d in
    select d::date from generate_series(greatest(v_r.valid_from, private.today()),
                                        least(v_r.valid_to, private.today() + greatest(coalesce(p_days, 60), 0)),
                                        interval '1 day') d
    where extract(dow from d)::smallint = v_r.weekday
  loop
    continue when exists (select 1 from public.bookings where recurrence_id = v_r.id and date = v_d);
    begin
      perform private.add_booking(v_r.court_id, v_d, v_r.start_time, v_r.end_time, v_r.type, v_r.note, p_uid, v_r.id);
      v_created := v_created + 1;
    exception when sqlstate 'P0001' then
      v_skipped := v_skipped || (to_char(v_d, 'YYYY-MM-DD') || ': ' || sqlerrm);
    end;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', to_jsonb(v_skipped));
end
$$;

create or replace function public.add_occupation(
  p_court text, p_date date, p_start time, p_end time, p_type public.booking_type, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('manager');
  v_res jsonb;
begin
  v_res := private.add_booking(p_court, p_date, p_start, p_end, p_type, p_note, v_uid, null);
  perform private.write_log('booking ' || p_type::text, v_res ->> 'id');
  return v_res;
end
$$;

create or replace function public.remove_occupation(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('manager');
  v_b public.bookings;
begin
  select * into v_b from public.bookings where id = p_id;
  if not found then
    perform private.fail('NOT_FOUND', 'Occupazione non trovata');
  end if;
  if v_b.type = 'match' then
    perform private.fail('BAD_STATE', 'È una partita del campionato: annullala dalla richiesta confermata');
  end if;
  perform private.lock_slot(v_b.court_id, v_b.date);
  delete from public.bookings where id = p_id;
  perform private.write_log('remove booking', p_id::text);
end
$$;

create or replace function public.close_day(p_date date, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('manager');
  v_c record;
  v_res jsonb;
  v_errors text[] := '{}';
  v_conflicts int := 0;
begin
  for v_c in select id, name from public.courts order by sort_order, id loop
    begin
      v_res := private.add_booking(v_c.id, p_date, '00:00', '24:00', 'closure', p_note, v_uid, null);
      v_conflicts := v_conflicts + (v_res ->> 'conflicts')::int;
    exception when sqlstate 'P0001' then
      v_errors := v_errors || (v_c.name || ': ' || sqlerrm);
    end;
  end loop;
  perform private.write_log('close day', p_date::text);
  return jsonb_build_object('errors', to_jsonb(v_errors), 'conflicts', v_conflicts);
end
$$;

create or replace function public.materialize_recurrence(p_recurrence uuid, p_days int default 60) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('manager');
  v_res jsonb;
begin
  v_res := private.materialize(p_recurrence, p_days, v_uid);
  perform private.write_log('materialize recurrence', p_recurrence::text);
  return v_res;
end
$$;

revoke all on function
  public.add_occupation(text, date, time, time, public.booking_type, text),
  public.remove_occupation(uuid),
  public.close_day(date, text),
  public.materialize_recurrence(uuid, int)
from public, anon;
grant execute on function
  public.add_occupation(text, date, time, time, public.booking_type, text),
  public.remove_occupation(uuid),
  public.close_day(date, text),
  public.materialize_recurrence(uuid, int)
to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role), private.is_match_player(uuid),
  private.is_trusted(), private.fail(text, text), private.config_default() to authenticated;
