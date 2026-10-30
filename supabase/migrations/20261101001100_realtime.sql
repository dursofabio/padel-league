-- Realtime: the client only invalidates its caches on these events.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'publication supabase_realtime assente: realtime non configurato';
    return;
  end if;
  foreach t in array array['richieste', 'richiesta_giocatori', 'partite', 'occupazioni', 'squadre', 'disponibilita'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
