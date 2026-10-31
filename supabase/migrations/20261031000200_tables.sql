-- Tables, constraints, indexes and views.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  phone text,
  roles public.app_role[] not null default '{player}',
  created_at timestamptz not null default now(),
  constraint profiles_roles_player check (roles @> '{player}')
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  status public.tournament_status not null default 'registration',
  config jsonb not null default private.config_default() check (jsonb_typeof(config) = 'object'),
  draw jsonb not null default '{}' check (jsonb_typeof(draw) = 'object'),
  generated_phases text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  phase text not null default 'groups',
  round int,
  starts_on date not null,
  ends_on date not null,
  label text not null default '',
  constraint periods_dates check (ends_on >= starts_on)
);
create index periods_tournament_idx on public.periods (tournament_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  group_name text,
  status public.team_status not null default 'awaiting_partner',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (id, tournament_id)
);
create index teams_tournament_idx on public.teams (tournament_id);

create table public.team_players (
  team_id uuid not null,
  tournament_id uuid not null,
  user_id uuid not null references public.profiles (id),
  position smallint not null check (position in (1, 2)),
  primary key (team_id, user_id),
  unique (team_id, position),
  -- one team per player in a tournament
  unique (tournament_id, user_id),
  foreign key (team_id, tournament_id) references public.teams (id, tournament_id) on delete cascade
);
create index team_players_user_idx on public.team_players (user_id);

create table public.invites (
  token text primary key,
  team_id uuid not null,
  tournament_id uuid not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  foreign key (team_id, tournament_id) references public.teams (id, tournament_id) on delete cascade
);
create index invites_team_idx on public.invites (team_id);

create table public.courts (
  id text primary key check (id ~ '^[A-Za-z0-9_-]+$'),
  name text not null,
  first_slot time not null,
  last_slot time not null,
  slot_minutes int not null check (slot_minutes between 15 and 600),
  active_days smallint[] not null default '{0,1,2,3,4,5,6}' check (active_days <@ '{0,1,2,3,4,5,6}'),
  closed_dates date[] not null default '{}',
  sort_order int not null default 0,
  constraint courts_slots check (last_slot >= first_slot)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  code text not null,
  phase text not null,
  group_name text,
  round int,
  position int,
  next_code text,
  side text check (side in ('A', 'B')),
  team_a uuid references public.teams (id),
  team_b uuid references public.teams (id),
  period_id uuid references public.periods (id) on delete set null,
  status public.match_status not null default 'unscheduled',
  request_id uuid, -- FK added after requests
  sets jsonb check (sets is null or jsonb_typeof(sets) = 'array'),
  entered_by uuid references public.profiles (id) on delete set null,
  confirmed_by uuid references public.profiles (id) on delete set null,
  disputed_by uuid references public.profiles (id) on delete set null,
  result_note text,
  updated_at timestamptz not null default now(),
  unique (tournament_id, code),
  constraint matches_distinct_teams check (team_a is distinct from team_b or team_a is null)
);
create index matches_team_a_idx on public.matches (team_a);
create index matches_team_b_idx on public.matches (team_b);
create index matches_period_idx on public.matches (period_id);

create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  court_id text not null references public.courts (id) on delete cascade on update cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  type public.booking_type not null default 'lesson' check (type <> 'match'),
  note text not null default '',
  valid_from date not null,
  valid_to date not null,
  constraint recurrences_times check (end_time > start_time),
  constraint recurrences_dates check (valid_to >= valid_from)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  court_id text not null references public.courts (id) on delete cascade on update cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  time_range tsrange generated always as (tsrange(date + start_time, date + end_time, '[)')) stored,
  off_grid boolean not null default false,
  counter_proposal boolean not null default false,
  status public.request_status not null default 'pending',
  expires_at timestamptz not null,
  created_by uuid not null references public.profiles (id),
  handled_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint requests_times check (end_time > start_time)
);
-- The lock on the slot and on the match: at most one pending request each.
create unique index requests_pending_slot on public.requests (court_id, date, start_time) where status = 'pending';
create unique index requests_pending_match on public.requests (match_id) where status = 'pending';
create index requests_court_date_idx on public.requests (court_id, date);
create index requests_match_idx on public.requests (match_id);
create index requests_pending_expiry_idx on public.requests (expires_at) where status = 'pending';

alter table public.matches
  add constraint matches_request_fk foreign key (request_id) references public.requests (id) on delete set null;

create table public.request_players (
  request_id uuid not null references public.requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  accepted_at timestamptz,
  primary key (request_id, user_id)
);
create index request_players_user_idx on public.request_players (user_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  court_id text not null references public.courts (id) on delete cascade on update cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  time_range tsrange generated always as (tsrange(date + start_time, date + end_time, '[)')) stored,
  type public.booking_type not null,
  note text,
  match_id uuid references public.matches (id) on delete cascade,
  request_id uuid unique references public.requests (id) on delete cascade,
  tournament_id uuid references public.tournaments (id) on delete cascade,
  recurrence_id uuid references public.recurrences (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  constraint bookings_times check (end_time > start_time),
  -- "The court is the truth": never two bookings overlapping on the same court.
  constraint bookings_no_overlap exclude using gist (court_id with =, time_range with &&),
  -- idempotent materialisation of recurrences
  constraint bookings_recurrence_date unique (recurrence_id, date)
);
create index bookings_court_date_idx on public.bookings (court_id, date);

create table public.availability (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  windows jsonb not null default '{}' check (jsonb_typeof(windows) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target text not null default '',
  created_at timestamptz not null default now()
);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- updated_at
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger matches_touch before update on public.matches
  for each row execute function private.touch_updated_at();
create trigger availability_touch before update on public.availability
  for each row execute function private.touch_updated_at();

-- ------------------------------------------------------------------ views

-- Public names only (profiles is not readable by anon).
create view public.public_players as
  select id, name from public.profiles;

-- Preferred read path for matches: players derived from the teams and the confirmed slot.
create view public.matches_v as
  select
    m.*,
    coalesce(pa.ids, '{}'::uuid[]) as players_a,
    coalesce(pb.ids, '{}'::uuid[]) as players_b,
    coalesce(pa.ids, '{}'::uuid[]) || coalesce(pb.ids, '{}'::uuid[]) as players,
    r.court_id as sched_court_id,
    r.date as sched_date,
    r.start_time as sched_start,
    r.end_time as sched_end
  from public.matches m
  left join lateral (
    select array_agg(tp.user_id order by tp.position) as ids
    from public.team_players tp where tp.team_id = m.team_a
  ) pa on true
  left join lateral (
    select array_agg(tp.user_id order by tp.position) as ids
    from public.team_players tp where tp.team_id = m.team_b
  ) pb on true
  left join public.requests r on r.id = m.request_id and r.status = 'confirmed';
