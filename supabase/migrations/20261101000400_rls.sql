-- Row Level Security and explicit grants (revoke-by-default).
-- Writes that need integrity go only through the SECURITY DEFINER RPCs.

alter table public.profiles enable row level security;
alter table public.tornei enable row level security;
alter table public.periodi enable row level security;
alter table public.squadre enable row level security;
alter table public.squadra_giocatori enable row level security;
alter table public.inviti enable row level security;
alter table public.partite enable row level security;
alter table public.campi enable row level security;
alter table public.ricorrenze enable row level security;
alter table public.occupazioni enable row level security;
alter table public.richieste enable row level security;
alter table public.richiesta_giocatori enable row level security;
alter table public.disponibilita enable row level security;
alter table public.log enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
-- The service role (server scripts, seed) bypasses RLS.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ------------------------------------------------------------------ profiles
grant select on public.profiles to authenticated;
grant update (nome, telefono) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select on public.giocatori_pubblici to anon, authenticated;

-- ------------------------------------------------------------------ tornei
grant select on public.tornei to anon, authenticated;
grant insert (nome, config, sorteggio), delete on public.tornei to authenticated;
grant update (nome, config, sorteggio) on public.tornei to authenticated;
create policy tornei_select on public.tornei for select to anon, authenticated using (true);
create policy tornei_insert on public.tornei for insert to authenticated with check (private.has_role('admin'));
create policy tornei_delete on public.tornei for delete to authenticated using (private.has_role('admin'));
create policy tornei_update on public.tornei for update to authenticated
  using (private.has_role('organizzatore')) with check (private.has_role('organizzatore'));

-- ------------------------------------------------------------------ periodi
grant select on public.periodi to anon, authenticated;
grant insert (id, torneo_id, fase, turno, inizio, fine, etichetta), delete on public.periodi to authenticated;
grant update (fase, turno, inizio, fine, etichetta) on public.periodi to authenticated;
create policy periodi_select on public.periodi for select to anon, authenticated using (true);
create policy periodi_insert on public.periodi for insert to authenticated with check (private.has_role('organizzatore'));
create policy periodi_update on public.periodi for update to authenticated
  using (private.has_role('organizzatore')) with check (private.has_role('organizzatore'));
create policy periodi_delete on public.periodi for delete to authenticated using (private.has_role('organizzatore'));

-- ------------------------------------------------------------------ squadre
grant select on public.squadre to anon, authenticated;
grant update (nome, girone, stato), delete on public.squadre to authenticated;
create policy squadre_select on public.squadre for select to anon, authenticated using (true);
-- girone/stato are further restricted to the organiser by the squadre_guard trigger
create policy squadre_update on public.squadre for update to authenticated
  using (private.has_role('organizzatore')
         or (creato_da = auth.uid() and stato in ('in attesa partner', 'da approvare')))
  with check (private.has_role('organizzatore')
         or (creato_da = auth.uid() and stato in ('in attesa partner', 'da approvare')));
create policy squadre_delete on public.squadre for delete to authenticated
  using (private.has_role('organizzatore') or (creato_da = auth.uid() and stato = 'in attesa partner'));

grant select on public.squadra_giocatori to anon, authenticated;
create policy squadra_giocatori_select on public.squadra_giocatori for select to anon, authenticated using (true);

-- ------------------------------------------------------------------ inviti
grant select, delete on public.inviti to authenticated;
create policy inviti_select on public.inviti for select to authenticated
  using (creato_da = auth.uid() or private.has_role('organizzatore'));
create policy inviti_delete on public.inviti for delete to authenticated using (private.has_role('organizzatore'));

-- ------------------------------------------------------------------ partite
grant select on public.partite to anon, authenticated;
create policy partite_select on public.partite for select to anon, authenticated using (true);
grant select on public.partite_v to anon, authenticated;

-- ------------------------------------------------------------------ campi, ricorrenze
grant select on public.campi to anon, authenticated;
grant insert, update, delete on public.campi to authenticated;
create policy campi_select on public.campi for select to anon, authenticated using (true);
create policy campi_insert on public.campi for insert to authenticated with check (private.has_role('gestore'));
create policy campi_update on public.campi for update to authenticated
  using (private.has_role('gestore')) with check (private.has_role('gestore'));
create policy campi_delete on public.campi for delete to authenticated using (private.has_role('gestore'));

grant select, insert, update, delete on public.ricorrenze to authenticated;
create policy ricorrenze_select on public.ricorrenze for select to authenticated using (true);
create policy ricorrenze_insert on public.ricorrenze for insert to authenticated with check (private.has_role('gestore'));
create policy ricorrenze_update on public.ricorrenze for update to authenticated
  using (private.has_role('gestore')) with check (private.has_role('gestore'));
create policy ricorrenze_delete on public.ricorrenze for delete to authenticated using (private.has_role('gestore'));

-- ------------------------------------------------------------------ occupazioni, richieste (RPC only)
grant select on public.occupazioni to authenticated;
create policy occupazioni_select on public.occupazioni for select to authenticated using (true);

grant select on public.richieste to authenticated;
create policy richieste_select on public.richieste for select to authenticated using (true);

grant select on public.richiesta_giocatori to authenticated;
create policy richiesta_giocatori_select on public.richiesta_giocatori for select to authenticated using (true);

-- ------------------------------------------------------------------ disponibilita
grant select, delete on public.disponibilita to authenticated;
-- insert + update on all written columns so PostgREST upsert (ON CONFLICT DO UPDATE) works
grant insert (torneo_id, user_id, fasce), update (torneo_id, user_id, fasce) on public.disponibilita to authenticated;
create policy disponibilita_select on public.disponibilita for select to authenticated using (true);
create policy disponibilita_insert on public.disponibilita for insert to authenticated with check (user_id = auth.uid());
create policy disponibilita_update on public.disponibilita for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy disponibilita_delete on public.disponibilita for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------------ log
grant select on public.log to authenticated;
create policy log_select on public.log for select to authenticated using (private.has_role('organizzatore') or private.has_role('gestore'));
