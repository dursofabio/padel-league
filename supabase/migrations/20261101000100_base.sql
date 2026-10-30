-- Base: extensions, private schema, enums, default privileges, time helpers.
-- Contract: docs/contratto-api.md

create schema if not exists extensions;
-- EXCLUDE (campo_id with =, periodo with &&) needs the btree gist operator classes for text.
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

create type public.app_role as enum ('admin', 'organizzatore', 'gestore', 'giocatore');
create type public.stato_torneo as enum ('iscrizioni', 'gironi', 'fasiFinali', 'concluso');
create type public.stato_squadra as enum ('in attesa partner', 'da approvare', 'approvata', 'ritirata');
create type public.stato_partita as enum ('da programmare', 'richiesta', 'programmata', 'giocata', 'contestata', 'tavolino');
create type public.stato_richiesta as enum ('attesa', 'confermata', 'rifiutata', 'annullata', 'conflitto', 'scaduta');
create type public.tipo_occupazione as enum ('esterno', 'lezione', 'chiusura', 'campionato');

-- Local wall clock of the club (dates and times in the tables are Europe/Rome).
create or replace function private.ora_locale() returns timestamp
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Rome')
$$;

create or replace function private.oggi() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Rome')::date
$$;

-- Minutes since midnight; '24:00' -> 1440.
create or replace function private.minuti(t time) returns int
language sql immutable set search_path = '' as $$
  select (extract(epoch from t) / 60)::int
$$;

-- Inverse of minuti(): 1440 -> '24:00'.
create or replace function private.ora(m int) returns time
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

-- Default TorneoConfig (camelCase keys, same as src/types.ts and CONFIG_DEFAULT on the client).
create or replace function private.config_default() returns jsonb
language sql immutable set search_path = '' as $$
  select '{
    "puntiVittoria": 3,
    "puntiSconfitta": 0,
    "puntiSconfittaSetDecisivo": 1,
    "formatoSet": {"setPerVincere": 2, "superTieBreak": true},
    "spareggi": ["punti", "scontroDiretto", "diffSet", "diffGame", "sorteggio"],
    "criterioQualificazione": "perPosizione",
    "fasiFinali": [{"nome": "Gold", "posti": 8}, {"nome": "Silver", "posti": 8}],
    "consentiFuoriGriglia": true,
    "passoFuoriGriglia": 30,
    "scadenzaRichiesteOre": 48,
    "annullamentoGiocatoreOre": 24
  }'::jsonb
$$;
