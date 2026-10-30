-- Court occupations: add/remove, close a day, materialise recurrences.

-- Adds a non-championship occupation. Raises OVERLAP on overlap with another occupation.
-- Pending requests that overlap become 'conflitto'. Takes the court/day lock itself.
create or replace function private.aggiungi_occupazione(
  p_campo text, p_data date, p_inizio time, p_fine time, p_tipo public.tipo_occupazione,
  p_nota text, p_uid uuid, p_ricorrenza uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_sovr text;
  v_id uuid;
  v_conflitti int;
  v_fine_txt text := case when p_fine = '24:00' then '24:00' else to_char(p_fine, 'HH24:MI') end;
begin
  if p_tipo is null or p_tipo = 'campionato' then
    perform private.fail('BAD_STATE', 'Le partite del campionato si programmano dalle richieste');
  end if;
  if p_data is null or p_inizio is null or p_fine is null or p_fine <= p_inizio then
    perform private.fail('BAD_STATE', 'L''orario di fine deve seguire quello di inizio');
  end if;
  if not exists (select 1 from public.campi where id = p_campo) then
    perform private.fail('NOT_FOUND', 'Campo non trovato');
  end if;
  perform private.lock_slot(p_campo, p_data);
  perform private.scadi_richieste(p_campo, p_data, null);

  select string_agg(format('%s %s–%s%s', o.tipo, to_char(o.inizio, 'HH24:MI'),
           case when o.fine = '24:00' then '24:00' else to_char(o.fine, 'HH24:MI') end,
           case when coalesce(o.nota, '') <> '' then ' (' || o.nota || ')' else '' end), ', ' order by o.inizio)
    into v_sovr
  from public.occupazioni o
  where o.campo_id = p_campo and o.periodo && tsrange(p_data + p_inizio, p_data + p_fine, '[)');
  if v_sovr is not null then
    perform private.fail('OVERLAP', 'Si sovrappone a: ' || v_sovr);
  end if;

  begin
    insert into public.occupazioni (campo_id, data, inizio, fine, tipo, nota, ricorrenza_id, creato_da)
    values (p_campo, p_data, p_inizio, p_fine, p_tipo, nullif(btrim(p_nota), ''), p_ricorrenza, p_uid)
    returning id into v_id;
  exception when exclusion_violation then
    perform private.fail('OVERLAP', 'Si sovrappone a un''occupazione appena inserita');
  end;

  v_conflitti := private.richieste_in_conflitto(p_campo, p_data, p_inizio, p_fine, null,
    format('Campo occupato: %s %s–%s', p_tipo, to_char(p_inizio, 'HH24:MI'), v_fine_txt), p_uid);
  return jsonb_build_object('id', v_id, 'conflitti', v_conflitti);
end
$$;

-- Materialises a recurrence from max(today, dal) to min(al, today + giorni). Idempotent.
create or replace function private.materializza(p_ricorrenza uuid, p_giorni int, p_uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_r public.ricorrenze;
  v_d date;
  v_creati int := 0;
  v_saltati text[] := '{}';
begin
  select * into v_r from public.ricorrenze where id = p_ricorrenza;
  if not found then
    perform private.fail('NOT_FOUND', 'Ricorrenza non trovata');
  end if;
  for v_d in
    select d::date from generate_series(greatest(v_r.dal, private.oggi()),
                                        least(v_r.al, private.oggi() + greatest(coalesce(p_giorni, 60), 0)),
                                        interval '1 day') d
    where extract(dow from d)::smallint = v_r.giorno_settimana
  loop
    continue when exists (select 1 from public.occupazioni where ricorrenza_id = v_r.id and data = v_d);
    begin
      perform private.aggiungi_occupazione(v_r.campo_id, v_d, v_r.inizio, v_r.fine, v_r.tipo, v_r.nota, p_uid, v_r.id);
      v_creati := v_creati + 1;
    exception when sqlstate 'P0001' then
      v_saltati := v_saltati || (to_char(v_d, 'YYYY-MM-DD') || ': ' || sqlerrm);
    end;
  end loop;
  return jsonb_build_object('creati', v_creati, 'saltati', to_jsonb(v_saltati));
end
$$;

create or replace function public.add_occupation(
  p_campo text, p_data date, p_inizio time, p_fine time, p_tipo public.tipo_occupazione, p_nota text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('gestore');
  v_res jsonb;
begin
  v_res := private.aggiungi_occupazione(p_campo, p_data, p_inizio, p_fine, p_tipo, p_nota, v_uid, null);
  perform private.scrivi_log('occupazione ' || p_tipo::text, v_res ->> 'id');
  return v_res;
end
$$;

create or replace function public.remove_occupation(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('gestore');
  v_o public.occupazioni;
begin
  select * into v_o from public.occupazioni where id = p_id;
  if not found then
    perform private.fail('NOT_FOUND', 'Occupazione non trovata');
  end if;
  if v_o.tipo = 'campionato' then
    perform private.fail('BAD_STATE', 'È una partita del campionato: annullala dalla richiesta confermata');
  end if;
  perform private.lock_slot(v_o.campo_id, v_o.data);
  delete from public.occupazioni where id = p_id;
  perform private.scrivi_log('libera occupazione', p_id::text);
end
$$;

create or replace function public.close_day(p_data date, p_nota text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('gestore');
  v_c record;
  v_res jsonb;
  v_errori text[] := '{}';
  v_conflitti int := 0;
begin
  for v_c in select id, nome from public.campi order by ordine, id loop
    begin
      v_res := private.aggiungi_occupazione(v_c.id, p_data, '00:00', '24:00', 'chiusura', p_nota, v_uid, null);
      v_conflitti := v_conflitti + (v_res ->> 'conflitti')::int;
    exception when sqlstate 'P0001' then
      v_errori := v_errori || (v_c.nome || ': ' || sqlerrm);
    end;
  end loop;
  perform private.scrivi_log('chiusura giornata', p_data::text);
  return jsonb_build_object('errori', to_jsonb(v_errori), 'conflitti', v_conflitti);
end
$$;

create or replace function public.materialize_recurrence(p_ricorrenza uuid, p_giorni int default 60) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('gestore');
  v_res jsonb;
begin
  v_res := private.materializza(p_ricorrenza, p_giorni, v_uid);
  perform private.scrivi_log('materializza ricorrenza', p_ricorrenza::text);
  return v_res;
end
$$;

revoke all on function
  public.add_occupation(text, date, time, time, public.tipo_occupazione, text),
  public.remove_occupation(uuid),
  public.close_day(date, text),
  public.materialize_recurrence(uuid, int)
from public, anon;
grant execute on function
  public.add_occupation(text, date, time, time, public.tipo_occupazione, text),
  public.remove_occupation(uuid),
  public.close_day(date, text),
  public.materialize_recurrence(uuid, int)
to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role), private.is_giocatore_partita(uuid),
  private.is_trusted(), private.fail(text, text), private.config_default() to authenticated;
