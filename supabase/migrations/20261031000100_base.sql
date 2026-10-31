-- Base: extensions, private schema, enums, default privileges, time helpers.
-- Contract: docs/api-contract.md

create schema if not exists extensions;
-- EXCLUDE (court_id with =, time_range with &&) needs the btree gist operator classes for text.
create extension if not exists btree_gist with schema extensions;

-- Revoke-by-default: nothing created by our migrations is reachable by the API roles
-- unless a later migration grants it explicitly.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;

-- Internal helpers, triggers and jobs. Not exposed by PostgREST.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public;

create type public.app_role as enum ('admin', 'organizer', 'manager', 'player');
create type public.tournament_status as enum ('registration', 'groups', 'finals', 'completed');
create type public.team_status as enum ('awaiting_partner', 'pending_approval', 'approved', 'withdrawn');
create type public.match_status as enum ('unscheduled', 'requested', 'scheduled', 'played', 'disputed', 'forfeit');
create type public.request_status as enum ('pending', 'confirmed', 'rejected', 'cancelled', 'conflict', 'expired');
create type public.booking_type as enum ('external', 'lesson', 'closure', 'match');

-- Local wall clock of the club (dates and times in the tables are Europe/Rome).
create or replace function private.local_now() returns timestamp
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Rome')
$$;

create or replace function private.today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Rome')::date
$$;

-- Minutes since midnight; '24:00' -> 1440.
create or replace function private.minutes(t time) returns int
language sql immutable set search_path = '' as $$
  select (extract(epoch from t) / 60)::int
$$;

-- Inverse of minutes(): 1440 -> '24:00'.
create or replace function private.minutes_to_time(m int) returns time
language sql immutable set search_path = '' as $$
  select case when m >= 1440 then '24:00'::time else make_time(m / 60, m % 60, 0) end
$$;

-- Raise a contract error: P0001 with an Italian message and the code in HINT.
create or replace function private.fail(p_code text, p_message text) returns void
language plpgsql volatile set search_path = '' as $$
begin
  raise exception '%', p_message using errcode = 'P0001', hint = p_code;
end
$$;

-- Italian label of an enum value, for user-facing error messages and notes.
-- Enum values are unique across all our enums, so one map covers them all.
create or replace function private.label_it(p_value text) returns text
language sql immutable set search_path = '' as $$
  select case p_value
    when 'organizer' then 'organizzatore'
    when 'manager' then 'gestore'
    when 'player' then 'giocatore'
    when 'registration' then 'iscrizioni'
    when 'groups' then 'gironi'
    when 'finals' then 'fasi finali'
    when 'completed' then 'concluso'
    when 'awaiting_partner' then 'in attesa partner'
    when 'pending_approval' then 'da approvare'
    when 'approved' then 'approvata'
    when 'withdrawn' then 'ritirata'
    when 'unscheduled' then 'da programmare'
    when 'requested' then 'richiesta'
    when 'scheduled' then 'programmata'
    when 'played' then 'giocata'
    when 'disputed' then 'contestata'
    when 'forfeit' then 'tavolino'
    when 'pending' then 'in attesa'
    when 'confirmed' then 'confermata'
    when 'rejected' then 'rifiutata'
    when 'cancelled' then 'annullata'
    when 'conflict' then 'conflitto'
    when 'expired' then 'scaduta'
    when 'external' then 'esterno'
    when 'lesson' then 'lezione'
    when 'closure' then 'chiusura'
    when 'match' then 'campionato'
    else p_value
  end
$$;

-- Default TournamentConfig (camelCase keys, same as src/types.ts and the client default).
create or replace function private.config_default() returns jsonb
language sql immutable set search_path = '' as $$
  select '{
    "pointsWin": 3,
    "pointsLoss": 0,
    "pointsLossDecidingSet": 1,
    "setFormat": {"setsToWin": 2, "superTieBreak": true},
    "tiebreakers": ["points", "headToHead", "setDiff", "gameDiff", "draw"],
    "qualificationRule": "byPosition",
    "finals": [{"name": "Gold", "spots": 8}, {"name": "Silver", "spots": 8}],
    "allowOffGrid": true,
    "offGridStep": 30,
    "requestExpiryHours": 48,
    "playerCancelHours": 24
  }'::jsonb
$$;
