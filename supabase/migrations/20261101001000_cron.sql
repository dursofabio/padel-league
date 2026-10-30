-- pg_cron schedules (only where the extension is available, e.g. hosted Supabase).
-- pg_cron runs in UTC. Re-running is safe: cron.schedule() upserts by job name.
do $do$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron non disponibile: job non schedulati';
    return;
  end if;
  begin
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('padel-scadenze', '*/15 * * * *', 'select private.job_scadenze()');
    perform cron.schedule('padel-ricorrenze', '7 * * * *', 'select private.job_ricorrenze(28)');
    perform cron.schedule('padel-non-giocate', '20 3 * * *', 'select private.job_non_giocate()');
  exception when others then
    raise warning 'pg_cron: job non schedulati (%). Abilita l''estensione pg_cron e riesegui questa migrazione.', sqlerrm;
  end;
end
$do$;
