-- Tables, constraints, indexes and views.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  telefono text,
  roles public.app_role[] not null default '{giocatore}',
  created_at timestamptz not null default now(),
  constraint profiles_roles_giocatore check (roles @> '{giocatore}')
);

create table public.tornei (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  stato public.stato_torneo not null default 'iscrizioni',
  config jsonb not null default private.config_default() check (jsonb_typeof(config) = 'object'),
  sorteggio jsonb not null default '{}' check (jsonb_typeof(sorteggio) = 'object'),
  fasi_generate text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.periodi (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references public.tornei (id) on delete cascade,
  fase text not null default 'gironi',
  turno int,
  inizio date not null,
  fine date not null,
  etichetta text not null default '',
  constraint periodi_date check (fine >= inizio)
);
create index periodi_torneo_idx on public.periodi (torneo_id);

create table public.squadre (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references public.tornei (id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  girone text,
  stato public.stato_squadra not null default 'in attesa partner',
  creato_da uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (id, torneo_id)
);
create index squadre_torneo_idx on public.squadre (torneo_id);

create table public.squadra_giocatori (
  squadra_id uuid not null,
  torneo_id uuid not null,
  user_id uuid not null references public.profiles (id),
  ordine smallint not null check (ordine in (1, 2)),
  primary key (squadra_id, user_id),
  unique (squadra_id, ordine),
  -- one team per player in a tournament
  unique (torneo_id, user_id),
  foreign key (squadra_id, torneo_id) references public.squadre (id, torneo_id) on delete cascade
);
create index squadra_giocatori_user_idx on public.squadra_giocatori (user_id);

create table public.inviti (
  token text primary key,
  squadra_id uuid not null,
  torneo_id uuid not null,
  creato_da uuid not null references public.profiles (id) on delete cascade,
  foreign key (squadra_id, torneo_id) references public.squadre (id, torneo_id) on delete cascade
);
create index inviti_squadra_idx on public.inviti (squadra_id);

create table public.campi (
  id text primary key check (id ~ '^[A-Za-z0-9_-]+$'),
  nome text not null,
  primo_slot time not null,
  ultimo_slot time not null,
  durata int not null check (durata between 15 and 600),
  giorni_attivi smallint[] not null default '{0,1,2,3,4,5,6}' check (giorni_attivi <@ '{0,1,2,3,4,5,6}'),
  eccezioni date[] not null default '{}',
  ordine int not null default 0,
  constraint campi_slot check (ultimo_slot >= primo_slot)
);

create table public.partite (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references public.tornei (id) on delete cascade,
  codice text not null,
  fase text not null,
  girone text,
  turno int,
  posizione int,
  prossima_codice text,
  lato text check (lato in ('A', 'B')),
  squadra_a uuid references public.squadre (id),
  squadra_b uuid references public.squadre (id),
  periodo_id uuid references public.periodi (id) on delete set null,
  stato public.stato_partita not null default 'da programmare',
  richiesta_id uuid, -- FK added after richieste
  set jsonb check (set is null or jsonb_typeof(set) = 'array'),
  inserito_da uuid references public.profiles (id) on delete set null,
  confermato_da uuid references public.profiles (id) on delete set null,
  contestato_da uuid references public.profiles (id) on delete set null,
  nota_risultato text,
  updated_at timestamptz not null default now(),
  unique (torneo_id, codice),
  constraint partite_squadre_diverse check (squadra_a is distinct from squadra_b or squadra_a is null)
);
create index partite_squadra_a_idx on public.partite (squadra_a);
create index partite_squadra_b_idx on public.partite (squadra_b);
create index partite_periodo_idx on public.partite (periodo_id);

create table public.ricorrenze (
  id uuid primary key default gen_random_uuid(),
  campo_id text not null references public.campi (id) on delete cascade on update cascade,
  giorno_settimana smallint not null check (giorno_settimana between 0 and 6),
  inizio time not null,
  fine time not null,
  tipo public.tipo_occupazione not null default 'lezione' check (tipo <> 'campionato'),
  nota text not null default '',
  dal date not null,
  al date not null,
  constraint ricorrenze_orari check (fine > inizio),
  constraint ricorrenze_date check (al >= dal)
);

create table public.richieste (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references public.tornei (id) on delete cascade,
  partita_id uuid not null references public.partite (id) on delete cascade,
  campo_id text not null references public.campi (id) on delete cascade on update cascade,
  data date not null,
  inizio time not null,
  fine time not null,
  periodo tsrange generated always as (tsrange(data + inizio, data + fine, '[)')) stored,
  fuori_griglia boolean not null default false,
  controproposta boolean not null default false,
  stato public.stato_richiesta not null default 'attesa',
  scadenza timestamptz not null,
  creato_da uuid not null references public.profiles (id),
  gestito_da uuid references public.profiles (id) on delete set null,
  nota text,
  created_at timestamptz not null default now(),
  constraint richieste_orari check (fine > inizio)
);
-- The lock on the slot and on the match: at most one pending request each.
create unique index richieste_slot_attesa on public.richieste (campo_id, data, inizio) where stato = 'attesa';
create unique index richieste_partita_attesa on public.richieste (partita_id) where stato = 'attesa';
create index richieste_campo_data_idx on public.richieste (campo_id, data);
create index richieste_partita_idx on public.richieste (partita_id);
create index richieste_scadenza_attesa_idx on public.richieste (scadenza) where stato = 'attesa';

alter table public.partite
  add constraint partite_richiesta_fk foreign key (richiesta_id) references public.richieste (id) on delete set null;

create table public.richiesta_giocatori (
  richiesta_id uuid not null references public.richieste (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  accettata_at timestamptz,
  primary key (richiesta_id, user_id)
);
create index richiesta_giocatori_user_idx on public.richiesta_giocatori (user_id);

create table public.occupazioni (
  id uuid primary key default gen_random_uuid(),
  campo_id text not null references public.campi (id) on delete cascade on update cascade,
  data date not null,
  inizio time not null,
  fine time not null,
  periodo tsrange generated always as (tsrange(data + inizio, data + fine, '[)')) stored,
  tipo public.tipo_occupazione not null,
  nota text,
  partita_id uuid references public.partite (id) on delete cascade,
  richiesta_id uuid unique references public.richieste (id) on delete cascade,
  torneo_id uuid references public.tornei (id) on delete cascade,
  ricorrenza_id uuid references public.ricorrenze (id) on delete set null,
  creato_da uuid references public.profiles (id) on delete set null,
  constraint occupazioni_orari check (fine > inizio),
  -- "The court is the truth": never two occupations overlapping on the same court.
  constraint occupazioni_no_overlap exclude using gist (campo_id with =, periodo with &&),
  -- idempotent materialisation of recurrences
  constraint occupazioni_ricorrenza_data unique (ricorrenza_id, data)
);
create index occupazioni_campo_data_idx on public.occupazioni (campo_id, data);

create table public.disponibilita (
  torneo_id uuid not null references public.tornei (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  fasce jsonb not null default '{}' check (jsonb_typeof(fasce) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (torneo_id, user_id)
);

create table public.log (
  id bigint generated always as identity primary key,
  chi uuid,
  cosa text not null,
  riferimento text not null default '',
  quando timestamptz not null default now()
);
create index log_quando_idx on public.log (quando desc);

-- updated_at
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger partite_touch before update on public.partite
  for each row execute function private.touch_updated_at();
create trigger disponibilita_touch before update on public.disponibilita
  for each row execute function private.touch_updated_at();

-- ------------------------------------------------------------------ views

-- Public names only (profiles is not readable by anon).
create view public.giocatori_pubblici as
  select id, nome from public.profiles;

-- Preferred read path for matches: players derived from the teams and the confirmed slot.
create view public.partite_v as
  select
    p.*,
    coalesce(ga.ids, '{}'::uuid[]) as giocatori_a,
    coalesce(gb.ids, '{}'::uuid[]) as giocatori_b,
    coalesce(ga.ids, '{}'::uuid[]) || coalesce(gb.ids, '{}'::uuid[]) as giocatori,
    r.campo_id as prog_campo_id,
    r.data as prog_data,
    r.inizio as prog_inizio,
    r.fine as prog_fine
  from public.partite p
  left join lateral (
    select array_agg(sg.user_id order by sg.ordine) as ids
    from public.squadra_giocatori sg where sg.squadra_id = p.squadra_a
  ) ga on true
  left join lateral (
    select array_agg(sg.user_id order by sg.ordine) as ids
    from public.squadra_giocatori sg where sg.squadra_id = p.squadra_b
  ) gb on true
  left join public.richieste r on r.id = p.richiesta_id and r.stato = 'confermata';
