-- Courts of the club (applied by `supabase db reset` and by scripts/db-test.sh).
insert into public.courts (id, name, first_slot, last_slot, slot_minutes, active_days, closed_dates, sort_order) values
  ('c1', 'Campo 1', '13:30', '21:00', 90, '{0,1,2,3,4,5,6}', '{}', 1),
  ('c2', 'Campo 2', '14:00', '20:00', 90, '{0,1,2,3,4,5,6}', '{}', 2)
on conflict (id) do nothing;
