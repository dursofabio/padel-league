-- pg_cron schedules (only where the extension is available, e.g. hosted Supabase).
-- pg_cron runs in UTC. Re-running is safe: cron.schedule() upserts by job name.
do $do$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available: jobs not scheduled';
    return;
  end if;
  begin
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('padel-expire-requests', '*/15 * * * *', 'select private.job_expire_requests()');
    perform cron.schedule('padel-recurrences', '7 * * * *', 'select private.job_recurrences(28)');
    perform cron.schedule('padel-unplayed', '20 3 * * *', 'select private.job_unplayed()');
  exception when others then
    raise warning 'pg_cron: jobs not scheduled (%). Enable the pg_cron extension and re-run this migration.', sqlerrm;
  end;
end
$do$;
