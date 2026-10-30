-- Results: players submit/confirm/contest; organiser official result, forfeit, clear.

-- A request of the match still pending is cancelled once the match has a result.
create or replace function private.annulla_attesa_partita(p_partita uuid, p_nota text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  update public.richieste set stato = 'annullata', nota = p_nota
  where partita_id = p_partita and stato = 'attesa'
  returning id into v_id;
  if v_id is not null then
    update public.partite set richiesta_id = null where id = p_partita and richiesta_id = v_id;
  end if;
end
$$;

-- Locks the match and checks it can take a (new) result.
create or replace function private.partita_per_risultato(p_partita uuid) returns public.partite
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.partite;
begin
  select * into v_p from public.partite where id = p_partita for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Partita non trovata');
  end if;
  if v_p.squadra_a is null or v_p.squadra_b is null then
    perform private.fail('BAD_STATE', 'Le due coppie della partita non sono ancora note');
  end if;
  return v_p;
end
$$;

create or replace function private.valida_o_errore(p_torneo uuid, p_set jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_esito jsonb := private.valida_risultato(p_set, private.config(p_torneo) -> 'formatoSet');
begin
  if not (v_esito ->> 'ok')::boolean then
    perform private.fail('INVALID_SCORE', v_esito ->> 'errore');
  end if;
end
$$;

create or replace function public.submit_result(p_partita uuid, p_set jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_p public.partite;
  v_lato text;
begin
  v_p := private.partita_per_risultato(p_partita);
  v_lato := private.lato_giocatore(p_partita, v_uid);
  if v_lato is null then
    perform private.fail('NOT_AUTHORIZED', 'Solo i giocatori della partita inseriscono il risultato');
  end if;
  if v_p.stato in ('giocata', 'tavolino') then
    perform private.fail('ALREADY_CONFIRMED', 'Il risultato è già confermato: può modificarlo solo l''organizzatore');
  end if;
  if v_p.stato = 'contestata' then
    perform private.fail('BAD_STATE', 'Il risultato è contestato: decide l''organizzatore');
  end if;
  -- before confirmation only the same pair can overwrite; the opponents confirm or contest
  if v_p.inserito_da is not null and private.lato_giocatore(p_partita, v_p.inserito_da) is distinct from v_lato then
    perform private.fail('NOT_AUTHORIZED', 'Il risultato è stato inserito dagli avversari: confermalo o contestalo');
  end if;
  perform private.valida_o_errore(v_p.torneo_id, p_set);
  update public.partite
  set "set" = p_set, inserito_da = v_uid, confermato_da = null, contestato_da = null, nota_risultato = null
  where id = p_partita;
  perform private.scrivi_log('inserisce risultato', p_partita::text);
end
$$;

-- Common checks for confirm/contest: pending result, caller on the other side.
create or replace function private.partita_da_confermare(p_partita uuid, p_uid uuid) returns public.partite
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.partite;
  v_lato text;
begin
  v_p := private.partita_per_risultato(p_partita);
  if v_p.stato in ('giocata', 'tavolino') or v_p.confermato_da is not null then
    perform private.fail('ALREADY_CONFIRMED', 'Il risultato è già confermato');
  end if;
  if v_p.stato = 'contestata' then
    perform private.fail('BAD_STATE', 'Il risultato è già contestato');
  end if;
  if v_p.inserito_da is null or v_p."set" is null then
    perform private.fail('BAD_STATE', 'Non c''è ancora un risultato da confermare');
  end if;
  v_lato := private.lato_giocatore(p_partita, p_uid);
  if v_lato is null or v_lato = private.lato_giocatore(p_partita, v_p.inserito_da) then
    perform private.fail('NOT_AUTHORIZED', 'Conferma o contesta solo un giocatore della coppia avversaria');
  end if;
  return v_p;
end
$$;

create or replace function public.confirm_result(p_partita uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
begin
  perform private.partita_da_confermare(p_partita, v_uid);
  perform private.annulla_attesa_partita(p_partita, 'Annullata: risultato confermato');
  update public.partite set stato = 'giocata', confermato_da = v_uid where id = p_partita;
  perform private.scrivi_log('conferma risultato', p_partita::text);
end
$$;

create or replace function public.contest_result(p_partita uuid, p_nota text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
begin
  perform private.partita_da_confermare(p_partita, v_uid);
  perform private.annulla_attesa_partita(p_partita, 'Annullata: risultato contestato');
  update public.partite set stato = 'contestata', contestato_da = v_uid, nota_risultato = nullif(btrim(p_nota), '')
  where id = p_partita;
  perform private.scrivi_log('contesta risultato', p_partita::text);
end
$$;

create or replace function public.set_official_result(p_partita uuid, p_set jsonb, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizzatore');
  v_p public.partite;
begin
  v_p := private.partita_per_risultato(p_partita);
  perform private.valida_o_errore(v_p.torneo_id, p_set);
  perform private.annulla_attesa_partita(p_partita, 'Annullata: risultato ufficiale');
  update public.partite
  set "set" = p_set, inserito_da = coalesce(inserito_da, v_uid), confermato_da = v_uid,
      nota_risultato = nullif(btrim(p_nota), ''), stato = 'giocata'
  where id = p_partita;
  perform private.scrivi_log('imposta risultato', p_partita::text);
end
$$;

create or replace function public.assign_forfeit(p_partita uuid, p_vincente text, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizzatore');
  v_p public.partite;
  v_n int;
  v_set jsonb;
begin
  if p_vincente is null or p_vincente not in ('A', 'B') then
    perform private.fail('BAD_STATE', 'Indica la coppia vincente (A o B)');
  end if;
  v_p := private.partita_per_risultato(p_partita);
  v_n := greatest(coalesce((private.config(v_p.torneo_id) #>> '{formatoSet,setPerVincere}')::int, 2), 1);
  select jsonb_agg(case when p_vincente = 'A' then '{"a":6,"b":0}'::jsonb else '{"a":0,"b":6}'::jsonb end)
    into v_set from generate_series(1, v_n);
  perform private.annulla_attesa_partita(p_partita, 'Annullata: tavolino');
  update public.partite
  set "set" = v_set, inserito_da = v_uid, confermato_da = v_uid, contestato_da = null,
      nota_risultato = coalesce(nullif(btrim(p_nota), ''), 'Tavolino'), stato = 'tavolino'
  where id = p_partita;
  perform private.scrivi_log('tavolino', p_partita::text);
end
$$;

create or replace function public.clear_result(p_partita uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('organizzatore');
  v_p public.partite;
  v_stato_r public.stato_richiesta;
begin
  select * into v_p from public.partite where id = p_partita for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Partita non trovata');
  end if;
  select stato into v_stato_r from public.richieste where id = v_p.richiesta_id;
  update public.partite
  set "set" = null, inserito_da = null, confermato_da = null, contestato_da = null, nota_risultato = null,
      stato = case v_stato_r when 'confermata' then 'programmata'::public.stato_partita
                             when 'attesa' then 'richiesta'::public.stato_partita
                             else 'da programmare'::public.stato_partita end,
      richiesta_id = case when v_stato_r in ('confermata', 'attesa') then richiesta_id end
  where id = p_partita;
  perform private.scrivi_log('annulla risultato', p_partita::text);
end
$$;

revoke all on function
  public.submit_result(uuid, jsonb),
  public.confirm_result(uuid),
  public.contest_result(uuid, text),
  public.set_official_result(uuid, jsonb, text),
  public.assign_forfeit(uuid, text, text),
  public.clear_result(uuid)
from public, anon;
grant execute on function
  public.submit_result(uuid, jsonb),
  public.confirm_result(uuid),
  public.contest_result(uuid, text),
  public.set_official_result(uuid, jsonb, text),
  public.assign_forfeit(uuid, text, text),
  public.clear_result(uuid)
to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role), private.is_giocatore_partita(uuid),
  private.is_trusted(), private.fail(text, text) to authenticated;
