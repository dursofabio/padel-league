-- Row Level Security and explicit grants (revoke-by-default).
-- Writes that need integrity go only through the SECURITY DEFINER RPCs.

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.periods enable row level security;
alter table public.teams enable row level security;
alter table public.team_players enable row level security;
alter table public.invites enable row level security;
alter table public.matches enable row level security;
alter table public.courts enable row level security;
alter table public.recurrences enable row level security;
alter table public.bookings enable row level security;
alter table public.requests enable row level security;
alter table public.request_players enable row level security;
alter table public.availability enable row level security;
alter table public.audit_log enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
-- The service role (server scripts, seed) bypasses RLS.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ------------------------------------------------------------------ profiles
grant select on public.profiles to authenticated;
grant update (name, phone) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select on public.public_players to anon, authenticated;

-- ------------------------------------------------------------------ tournaments
grant select on public.tournaments to anon, authenticated;
grant insert (name, config, draw), delete on public.tournaments to authenticated;
grant update (name, config, draw) on public.tournaments to authenticated;
create policy tournaments_select on public.tournaments for select to anon, authenticated using (true);
create policy tournaments_insert on public.tournaments for insert to authenticated with check (private.has_role('admin'));
create policy tournaments_delete on public.tournaments for delete to authenticated using (private.has_role('admin'));
create policy tournaments_update on public.tournaments for update to authenticated
  using (private.has_role('organizer')) with check (private.has_role('organizer'));

-- ------------------------------------------------------------------ periods
grant select on public.periods to anon, authenticated;
grant insert (id, tournament_id, phase, round, starts_on, ends_on, label), delete on public.periods to authenticated;
grant update (phase, round, starts_on, ends_on, label) on public.periods to authenticated;
create policy periods_select on public.periods for select to anon, authenticated using (true);
create policy periods_insert on public.periods for insert to authenticated with check (private.has_role('organizer'));
create policy periods_update on public.periods for update to authenticated
  using (private.has_role('organizer')) with check (private.has_role('organizer'));
create policy periods_delete on public.periods for delete to authenticated using (private.has_role('organizer'));

-- ------------------------------------------------------------------ teams
grant select on public.teams to anon, authenticated;
grant update (name, group_name, status), delete on public.teams to authenticated;
create policy teams_select on public.teams for select to anon, authenticated using (true);
-- group_name/status are further restricted to the organizer by the teams_guard trigger
create policy teams_update on public.teams for update to authenticated
  using (private.has_role('organizer')
         or (created_by = auth.uid() and status in ('awaiting_partner', 'pending_approval')))
  with check (private.has_role('organizer')
         or (created_by = auth.uid() and status in ('awaiting_partner', 'pending_approval')));
create policy teams_delete on public.teams for delete to authenticated
  using (private.has_role('organizer') or (created_by = auth.uid() and status = 'awaiting_partner'));

grant select on public.team_players to anon, authenticated;
create policy team_players_select on public.team_players for select to anon, authenticated using (true);

-- ------------------------------------------------------------------ invites
grant select, delete on public.invites to authenticated;
create policy invites_select on public.invites for select to authenticated
  using (created_by = auth.uid() or private.has_role('organizer'));
create policy invites_delete on public.invites for delete to authenticated using (private.has_role('organizer'));

-- ------------------------------------------------------------------ matches
grant select on public.matches to anon, authenticated;
create policy matches_select on public.matches for select to anon, authenticated using (true);
grant select on public.matches_v to anon, authenticated;

-- ------------------------------------------------------------------ courts, recurrences
grant select on public.courts to anon, authenticated;
grant insert, update, delete on public.courts to authenticated;
create policy courts_select on public.courts for select to anon, authenticated using (true);
create policy courts_insert on public.courts for insert to authenticated with check (private.has_role('manager'));
create policy courts_update on public.courts for update to authenticated
  using (private.has_role('manager')) with check (private.has_role('manager'));
create policy courts_delete on public.courts for delete to authenticated using (private.has_role('manager'));

grant select, insert, update, delete on public.recurrences to authenticated;
create policy recurrences_select on public.recurrences for select to authenticated using (true);
create policy recurrences_insert on public.recurrences for insert to authenticated with check (private.has_role('manager'));
create policy recurrences_update on public.recurrences for update to authenticated
  using (private.has_role('manager')) with check (private.has_role('manager'));
create policy recurrences_delete on public.recurrences for delete to authenticated using (private.has_role('manager'));

-- ------------------------------------------------------------------ bookings, requests (RPC only)
grant select on public.bookings to authenticated;
create policy bookings_select on public.bookings for select to authenticated using (true);

grant select on public.requests to authenticated;
create policy requests_select on public.requests for select to authenticated using (true);

grant select on public.request_players to authenticated;
create policy request_players_select on public.request_players for select to authenticated using (true);

-- ------------------------------------------------------------------ availability
grant select, delete on public.availability to authenticated;
-- insert + update on all written columns so PostgREST upsert (ON CONFLICT DO UPDATE) works
grant insert (tournament_id, user_id, windows), update (tournament_id, user_id, windows) on public.availability to authenticated;
create policy availability_select on public.availability for select to authenticated using (true);
create policy availability_insert on public.availability for insert to authenticated with check (user_id = auth.uid());
create policy availability_update on public.availability for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy availability_delete on public.availability for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------------ audit_log
grant select on public.audit_log to authenticated;
create policy audit_log_select on public.audit_log for select to authenticated
  using (private.has_role('organizer') or private.has_role('manager'));
