-- A pending request can never expire after the time it asks for: its deadline is capped at
-- the slot's start (Europe/Rome local time). Past the start, lazy expiry and job_scadenze
-- mark it 'scaduta' and free the match; confirm_request already rejects expired requests.
create or replace function private.limita_scadenza() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.stato = 'attesa' then
    new.scadenza := least(new.scadenza, (new.data + new.inizio) at time zone 'Europe/Rome');
  end if;
  return new;
end
$$;

drop trigger if exists richieste_limita_scadenza on public.richieste;
create trigger richieste_limita_scadenza
  before insert or update of scadenza, data, inizio, stato on public.richieste
  for each row execute function private.limita_scadenza();
