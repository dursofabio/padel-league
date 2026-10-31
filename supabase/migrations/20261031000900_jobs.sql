-- Scheduled jobs (called by pg_cron) and the email reminder query (GitHub Actions).

-- Pending requests past their deadline become 'expired'; their match goes back to 'unscheduled'.
create or replace function private.job_expire_requests() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.requests
    set status = 'expired', note = coalesce(note || ' · ', '') || 'Nessuna risposta entro la scadenza'
    where status = 'pending' and expires_at <= now()
    returning id, match_id
  loop
    perform private.release_match(r.match_id, r.id);
    insert into public.audit_log (actor_id, action, target) values (null, 'request expired', r.id::text);
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Materialises every recurrence over the next `p_days` days. Returns bookings created.
create or replace function private.job_recurrences(p_days int default 28) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_res jsonb;
  n int := 0;
begin
  for v_id in select id from public.recurrences where valid_to >= private.today() order by id loop
    v_res := private.materialize(v_id, p_days, null);
    n := n + (v_res ->> 'created')::int;
    if jsonb_array_length(v_res -> 'skipped') > 0 then
      insert into public.audit_log (actor_id, action, target)
      values (null, 'recurrence: skipped days ' || (v_res -> 'skipped')::text, v_id::text);
    end if;
  end loop;
  return n;
end
$$;

-- Logs (once per period) the matches not played in periods already over.
create or replace function private.job_unplayed() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select t.id as tournament_id, t.name, pe.id as period_id, pe.label,
           string_agg(m.code, ', ' order by m.code) as codes, count(*) as how_many
    from public.tournaments t
    join public.periods pe on pe.tournament_id = t.id and pe.ends_on < private.today()
    join public.matches m on m.period_id = pe.id and m.status not in ('played', 'forfeit')
    where t.status in ('groups', 'finals')
    group by t.id, t.name, pe.id, pe.label
  loop
    continue when exists (
      select 1 from public.audit_log where action like 'unplayed matches%' and target = r.period_id::text
    );
    insert into public.audit_log (actor_id, action, target)
    values (null, format('unplayed matches (%s, %s): %s', r.name, r.label, r.codes), r.period_id::text);
    n := n + r.how_many;
  end loop;
  return n;
end
$$;

-- Reminder emails: [{email, name, lines: text[]}]. service_role only (GitHub Actions).
-- The lines are user-facing (Italian).
create or replace function public.reminder_emails() returns jsonb
language sql stable security definer set search_path = '' as $$
  with active as (
    select id, name from public.tournaments where status in ('groups', 'finals')
  ),
  lines as (
    -- 1. players of approved teams with no future availability
    select tp.user_id, 1 as sort_key,
           format('%s: non hai ancora indicato le tue disponibilità', t.name) as line
    from active t
    join public.teams tm on tm.tournament_id = t.id and tm.status = 'approved'
    join public.team_players tp on tp.team_id = tm.id
    left join public.availability av on av.tournament_id = t.id and av.user_id = tp.user_id
    where not exists (
      select 1 from jsonb_object_keys(coalesce(av.windows, '{}'::jsonb)) k
      where k >= to_char(private.today(), 'YYYY-MM-DD')
        and jsonb_typeof(av.windows -> k) = 'array' and jsonb_array_length(av.windows -> k) > 0
    )
    union all
    -- 2. matches not scheduled in periods ending within 3 days
    select pl, 2,
           format('%s: il periodo "%s" termina il %s e la partita %s non è ancora programmata',
                  t.name, pe.label, to_char(pe.ends_on, 'DD/MM/YYYY'), m.code)
    from active t
    join public.periods pe on pe.tournament_id = t.id and pe.ends_on between private.today() and private.today() + 3
    join public.matches m on m.period_id = pe.id and m.status in ('unscheduled', 'requested')
    cross join lateral unnest(private.match_players(m.id)) pl
    union all
    -- 3a. requests expiring within 12 hours: players who still have to accept
    select rp.user_id, 3,
           format('Richiesta del %s alle %s in scadenza: accettala', to_char(r.date, 'DD/MM/YYYY'), to_char(r.start_time, 'HH24:MI'))
    from public.requests r
    join public.request_players rp on rp.request_id = r.id and rp.accepted_at is null
    where r.status = 'pending' and r.expires_at > now() and r.expires_at <= now() + interval '12 hours'
    union all
    -- 3b. complete requests expiring within 12 hours: court managers
    select pr.id, 4,
           format('Richiesta del %s alle %s in scadenza: conferma o rifiuta', to_char(r.date, 'DD/MM/YYYY'), to_char(r.start_time, 'HH24:MI'))
    from public.requests r
    cross join public.profiles pr
    where r.status = 'pending' and r.expires_at > now() and r.expires_at <= now() + interval '12 hours'
      and not exists (select 1 from public.request_players rp where rp.request_id = r.id and rp.accepted_at is null)
      and (pr.roles && '{manager,admin}'::public.app_role[])
  ),
  distinct_lines as (
    select distinct user_id, sort_key, line from lines
  )
  select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'name', u.name, 'lines', u.lines) order by u.email), '[]'::jsonb)
  from (
    select pr.email, pr.name, array_agg(d.line order by d.sort_key, d.line) as lines
    from distinct_lines d
    join public.profiles pr on pr.id = d.user_id
    where coalesce(pr.email, '') <> ''
    group by pr.id, pr.email, pr.name
  ) u
$$;

revoke all on function public.reminder_emails() from public, anon, authenticated;
grant execute on function public.reminder_emails() to service_role;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role), private.is_match_player(uuid),
  private.is_trusted(), private.fail(text, text), private.config_default() to authenticated;
