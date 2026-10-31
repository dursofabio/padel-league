-- A pending request can never expire after the time it asks for: its deadline is capped at
-- the slot's start (Europe/Rome local time). Past the start, lazy expiry and job_expire_requests
-- mark it 'expired' and free the match; confirm_request already rejects expired requests.
create or replace function private.cap_expiry() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'pending' then
    new.expires_at := least(new.expires_at, (new.date + new.start_time) at time zone 'Europe/Rome');
  end if;
  return new;
end
$$;

drop trigger if exists requests_cap_expiry on public.requests;
create trigger requests_cap_expiry
  before insert or update of expires_at, date, start_time, status on public.requests
  for each row execute function private.cap_expiry();
