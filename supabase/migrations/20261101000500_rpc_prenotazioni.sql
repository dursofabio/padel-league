-- Booking requests: create, accept, cancel, confirm, reject, cancel confirmed, counter-proposal.

-- Shared by create_request and counter_propose. Caller has already taken
-- private.lock_slot(p_campo, p_data) and checked authorisation.
create or replace function private.crea_richiesta(
  p_partita uuid, p_campo text, p_data date, p_inizio time, p_nota text, p_uid uuid, p_controproposta boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.partite;
  v_c public.campi;
  v_cfg jsonb;
  v_giocatori uuid[];
  v_attivo boolean;
  v_griglia boolean;
  v_passo int;
  v_ini int;
  v_fine_min int;
  v_fine time;
  v_sovr text;
  v_id uuid;
begin
  perform private.scadi_richieste(p_campo, p_data, p_partita);

  select * into v_p from public.partite where id = p_partita for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Partita non trovata');
  end if;
  if v_p.stato not in ('da programmare', 'richiesta') then
    perform private.fail('BAD_STATE', format('La partita è nello stato "%s"', v_p.stato));
  end if;
  if v_p.squadra_a is null or v_p.squadra_b is null then
    perform private.fail('BAD_STATE', 'Le due coppie della partita non sono ancora note');
  end if;
  if exists (select 1 from public.richieste where partita_id = p_partita and stato = 'attesa') then
    perform private.fail('MATCH_HAS_REQUEST',
      'La partita ha già una richiesta in attesa: annullala prima di farne un''altra');
  end if;
  v_giocatori := private.giocatori_partita(p_partita);
  if cardinality(v_giocatori) = 0 then
    perform private.fail('BAD_STATE', 'La partita non ha giocatori');
  end if;

  select * into v_c from public.campi where id = p_campo;
  if not found then
    perform private.fail('NOT_FOUND', 'Campo non trovato');
  end if;
  if p_data is null or p_inizio is null then
    perform private.fail('BAD_STATE', 'Indica giorno e ora');
  end if;

  v_cfg := private.config(v_p.torneo_id);
  v_ini := private.minuti(p_inizio);
  v_fine_min := v_ini + v_c.durata;
  v_attivo := extract(dow from p_data)::smallint = any (v_c.giorni_attivi) and not (p_data = any (v_c.eccezioni));
  if not v_attivo then
    perform private.fail('COURT_CLOSED', format('Il campo %s è chiuso il %s', v_c.nome, to_char(p_data, 'DD/MM/YYYY')));
  end if;
  if v_fine_min > 1440 or extract(second from p_inizio) <> 0 then
    perform private.fail('COURT_CLOSED', 'La partita deve finire entro le 24:00');
  end if;
  v_fine := private.ora(v_fine_min);

  v_griglia := p_inizio between v_c.primo_slot and v_c.ultimo_slot
    and (v_ini - private.minuti(v_c.primo_slot)) % v_c.durata = 0;
  if not v_griglia then
    if not coalesce((v_cfg ->> 'consentiFuoriGriglia')::boolean, false) then
      perform private.fail('OFF_GRID_DISABLED', 'Questo torneo non consente richieste fuori griglia');
    end if;
    v_passo := greatest(coalesce((v_cfg ->> 'passoFuoriGriglia')::int, 30), 1);
    if v_ini % v_passo <> 0 then
      perform private.fail('BAD_STEP', format('Fuori griglia si parte ogni %s minuti', v_passo));
    end if;
  end if;

  if (p_data + p_inizio) <= private.ora_locale() then
    perform private.fail('IN_PAST', 'L''orario è già passato');
  end if;

  select string_agg(format('%s %s–%s%s', o.tipo, to_char(o.inizio, 'HH24:MI'),
           case when o.fine = '24:00' then '24:00' else to_char(o.fine, 'HH24:MI') end,
           case when coalesce(o.nota, '') <> '' then ' (' || o.nota || ')' else '' end), ', ' order by o.inizio)
    into v_sovr
  from public.occupazioni o
  where o.campo_id = p_campo and o.periodo && tsrange(p_data + p_inizio, p_data + v_fine, '[)');
  if v_sovr is not null then
    perform private.fail('OVERLAP', 'Il campo è occupato: ' || v_sovr);
  end if;

  -- grid requests never overlap a pending request; off-grid ones may (except the same start)
  if exists (
    select 1 from public.richieste r
    where r.campo_id = p_campo and r.data = p_data and r.stato = 'attesa'
      and (r.inizio = p_inizio or (v_griglia and r.periodo && tsrange(p_data + p_inizio, p_data + v_fine, '[)')))
  ) then
    perform private.fail('SLOT_TAKEN', 'Lo slot è già stato richiesto da un''altra partita');
  end if;

  begin
    insert into public.richieste (torneo_id, partita_id, campo_id, data, inizio, fine, fuori_griglia,
                                  controproposta, stato, scadenza, creato_da, nota)
    values (v_p.torneo_id, p_partita, p_campo, p_data, p_inizio, v_fine, not v_griglia, p_controproposta,
            'attesa', now() + make_interval(hours => greatest(coalesce((v_cfg ->> 'scadenzaRichiesteOre')::int, 48), 1)),
            p_uid, nullif(btrim(p_nota), ''))
    returning id into v_id;
  exception when unique_violation then
    perform private.fail('SLOT_TAKEN', 'Lo slot è appena stato richiesto da un''altra partita');
  end;

  -- acceptances: the creator (if a player) and every player whose availability covers the slot
  insert into public.richiesta_giocatori (richiesta_id, user_id, accettata_at)
  select v_id, g,
         case when g = p_uid or private.fascia_copre(d.fasce, p_data, p_inizio, v_fine) then now() end
  from unnest(v_giocatori) as g
  left join public.disponibilita d on d.torneo_id = v_p.torneo_id and d.user_id = g;

  update public.partite set stato = 'richiesta', richiesta_id = v_id where id = p_partita;
  return v_id;
end
$$;

create or replace function public.create_request(
  p_partita uuid, p_campo text, p_data date, p_inizio time, p_nota text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_id uuid;
begin
  perform private.lock_slot(p_campo, p_data);
  if not exists (select 1 from public.partite where id = p_partita) then
    perform private.fail('NOT_FOUND', 'Partita non trovata');
  end if;
  if private.lato_giocatore(p_partita, v_uid) is null then
    perform private.fail('NOT_AUTHORIZED', 'Solo i giocatori della partita possono richiedere uno slot');
  end if;
  v_id := private.crea_richiesta(p_partita, p_campo, p_data, p_inizio, p_nota, v_uid, false);
  perform private.scrivi_log('richiesta', v_id::text);
  return v_id;
end
$$;

create or replace function public.accept_request(p_richiesta uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_r public.richieste;
begin
  select * into v_r from public.richieste where id = p_richiesta for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  if not exists (select 1 from public.richiesta_giocatori where richiesta_id = p_richiesta and user_id = v_uid) then
    perform private.fail('NOT_AUTHORIZED', 'Non sei tra i giocatori di questa richiesta');
  end if;
  if v_r.stato <> 'attesa' then
    perform private.fail('BAD_STATE', 'La richiesta non è più in attesa');
  end if;
  if v_r.scadenza <= now() then
    perform private.fail('EXPIRED', 'La richiesta è scaduta');
  end if;
  update public.richiesta_giocatori set accettata_at = coalesce(accettata_at, now())
  where richiesta_id = p_richiesta and user_id = v_uid;
end
$$;

create or replace function public.cancel_request(p_richiesta uuid, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_r public.richieste;
begin
  select * into v_r from public.richieste where id = p_richiesta for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  if not exists (select 1 from public.richiesta_giocatori where richiesta_id = p_richiesta and user_id = v_uid) then
    perform private.fail('NOT_AUTHORIZED', 'Non sei tra i giocatori di questa richiesta');
  end if;
  if v_r.stato <> 'attesa' then
    perform private.fail('BAD_STATE', 'La richiesta non è più in attesa');
  end if;
  update public.richieste
  set stato = 'annullata', nota = coalesce(nullif(btrim(p_nota), ''), 'Annullata da un giocatore')
  where id = p_richiesta;
  perform private.libera_partita(v_r.partita_id, v_r.id);
  perform private.scrivi_log('annulla richiesta', p_richiesta::text);
end
$$;

create or replace function public.confirm_request(p_richiesta uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('gestore');
  v_campo text;
  v_data date;
  v_r public.richieste;
  v_p public.partite;
  v_conflitti int;
begin
  select campo_id, data into v_campo, v_data from public.richieste where id = p_richiesta;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  perform private.lock_slot(v_campo, v_data);

  select * into v_r from public.richieste where id = p_richiesta for update;
  if v_r.stato = 'conflitto' then
    -- overlapped meanwhile (e.g. another confirmation or an occupation): never raise on overlap
    return jsonb_build_object('esito', 'occupato', 'conflitti', 0);
  end if;
  if v_r.stato <> 'attesa' then
    perform private.fail('BAD_STATE', format('La richiesta non è più in attesa (stato: %s)', v_r.stato));
  end if;
  if v_r.scadenza <= now() then
    update public.richieste set stato = 'scaduta', nota = 'Nessuna risposta entro la scadenza' where id = p_richiesta;
    perform private.libera_partita(v_r.partita_id, v_r.id);
    return jsonb_build_object('esito', 'scaduta', 'conflitti', 0);
  end if;

  select * into v_p from public.partite where id = v_r.partita_id for update;
  if v_p.richiesta_id is distinct from v_r.id or v_p.stato <> 'richiesta' then
    perform private.fail('BAD_STATE', 'La partita non è collegata a questa richiesta');
  end if;
  -- 4/4 acceptances, from exactly the current players of the match
  if exists (select 1 from public.richiesta_giocatori where richiesta_id = p_richiesta and accettata_at is null)
     or (select coalesce(array_agg(user_id order by user_id), '{}') from public.richiesta_giocatori
         where richiesta_id = p_richiesta)
        is distinct from (select coalesce(array_agg(g order by g), '{}')
                          from unnest(private.giocatori_partita(v_r.partita_id)) g)
  then
    perform private.fail('NOT_ALL_ACCEPTED', 'Mancano delle accettazioni: si conferma solo con 4 su 4');
  end if;

  begin
    insert into public.occupazioni (campo_id, data, inizio, fine, tipo, partita_id, richiesta_id, torneo_id, creato_da)
    values (v_r.campo_id, v_r.data, v_r.inizio, v_r.fine, 'campionato', v_r.partita_id, v_r.id, v_r.torneo_id, v_uid);
  exception when exclusion_violation then
    update public.richieste
    set stato = 'conflitto', nota = 'Campo occupato al momento della conferma', gestito_da = v_uid
    where id = p_richiesta;
    perform private.libera_partita(v_r.partita_id, v_r.id);
    perform private.scrivi_log('conferma: campo occupato', p_richiesta::text);
    return jsonb_build_object('esito', 'occupato', 'conflitti', 0);
  end;

  v_conflitti := private.richieste_in_conflitto(v_r.campo_id, v_r.data, v_r.inizio, v_r.fine, v_r.id,
    format('Sovrapposta a una partita confermata (%s–%s)', to_char(v_r.inizio, 'HH24:MI'), to_char(v_r.fine, 'HH24:MI')),
    v_uid);
  update public.richieste set stato = 'confermata', gestito_da = v_uid where id = p_richiesta;
  update public.partite set stato = 'programmata' where id = v_r.partita_id;
  perform private.scrivi_log('conferma richiesta', p_richiesta::text);
  return jsonb_build_object('esito', 'ok', 'conflitti', v_conflitti);
end
$$;

create or replace function public.reject_request(p_richiesta uuid, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('gestore');
  v_r public.richieste;
begin
  select * into v_r from public.richieste where id = p_richiesta for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  if v_r.stato <> 'attesa' then
    perform private.fail('BAD_STATE', 'La richiesta non è più in attesa');
  end if;
  update public.richieste set stato = 'rifiutata', nota = nullif(btrim(p_nota), ''), gestito_da = v_uid
  where id = p_richiesta;
  perform private.libera_partita(v_r.partita_id, v_r.id);
  perform private.scrivi_log('rifiuta richiesta', p_richiesta::text);
end
$$;

-- Shared by cancel_confirmed (gestore) and player_cancel_confirmed (a player of the match).
-- Frees the court, request -> 'annullata', match -> 'da programmare' (refused if it has a result).
-- p_minimo_ore: when not null, the start must be at least that many hours away (else TOO_LATE).
create or replace function private.annulla_confermata(
  p_richiesta uuid, p_nota text, p_uid uuid, p_giocatore boolean, p_minimo_ore numeric
) returns public.richieste
language plpgsql security definer set search_path = '' as $$
declare
  v_campo text;
  v_data date;
  v_r public.richieste;
  v_p public.partite;
  v_inizio timestamptz;
begin
  select campo_id, data into v_campo, v_data from public.richieste where id = p_richiesta;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  if p_giocatore and private.lato_giocatore((select partita_id from public.richieste where id = p_richiesta), p_uid) is null then
    perform private.fail('NOT_AUTHORIZED', 'Solo i giocatori della partita possono annullarla');
  end if;
  perform private.lock_slot(v_campo, v_data);
  select * into v_r from public.richieste where id = p_richiesta for update;
  if v_r.stato <> 'confermata' then
    perform private.fail('BAD_STATE', 'La richiesta non è confermata');
  end if;
  select * into v_p from public.partite where id = v_r.partita_id for update;
  if v_p.richiesta_id = v_r.id and v_p.stato in ('giocata', 'contestata', 'tavolino') then
    perform private.fail('BAD_STATE', 'La partita ha già un risultato: annullalo prima');
  end if;
  if p_minimo_ore is not null then
    -- data + inizio are Europe/Rome wall-clock values
    v_inizio := (v_r.data + v_r.inizio) at time zone 'Europe/Rome';
    if v_inizio < now() + make_interval(secs => p_minimo_ore * 3600) then
      perform private.fail('TOO_LATE', format(
        'Troppo tardi: si può annullare fino a %s ore prima dell''inizio. Contatta il gestore', p_minimo_ore));
    end if;
  end if;
  delete from public.occupazioni where richiesta_id = p_richiesta;
  update public.richieste
  set stato = 'annullata', gestito_da = p_uid,
      nota = coalesce(nullif(btrim(p_nota), ''),
                      case when p_giocatore then 'Annullata da un giocatore' else 'Annullata dal gestore' end)
  where id = p_richiesta
  returning * into v_r;
  update public.partite set stato = 'da programmare', richiesta_id = null
  where id = v_r.partita_id and richiesta_id = v_r.id and stato = 'programmata';
  return v_r;
end
$$;

create or replace function public.cancel_confirmed(p_richiesta uuid, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('gestore');
begin
  perform private.annulla_confermata(p_richiesta, p_nota, v_uid, false, null);
  perform private.scrivi_log('annulla partita confermata', p_richiesta::text);
end
$$;

-- A player cancels a confirmed match until config.annullamentoGiocatoreOre hours before the start.
create or replace function public.player_cancel_confirmed(p_richiesta uuid, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_torneo uuid;
  v_ore numeric;
  v_r public.richieste;
begin
  select torneo_id into v_torneo from public.richieste where id = p_richiesta;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  v_ore := greatest(coalesce((private.config(v_torneo) ->> 'annullamentoGiocatoreOre')::numeric, 24), 0);
  v_r := private.annulla_confermata(p_richiesta, p_nota, v_uid, true, v_ore);
  perform private.scrivi_log(
    format('giocatore annulla partita confermata (%s %s %s)%s', v_r.campo_id, to_char(v_r.data, 'DD/MM/YYYY'),
           to_char(v_r.inizio, 'HH24:MI'), coalesce(': ' || nullif(btrim(p_nota), ''), '')),
    p_richiesta::text);
end
$$;

create or replace function public.counter_propose(
  p_richiesta uuid, p_campo text, p_data date, p_inizio time, p_nota text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role('gestore');
  v_r public.richieste;
  v_id uuid;
begin
  perform private.lock_slot(p_campo, p_data);
  select * into v_r from public.richieste where id = p_richiesta for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Richiesta non trovata');
  end if;
  if v_r.stato <> 'attesa' then
    perform private.fail('BAD_STATE', 'La richiesta non è più in attesa');
  end if;
  update public.richieste
  set stato = 'rifiutata', gestito_da = v_uid,
      nota = format('Controproposta: %s %s', to_char(p_data, 'DD/MM/YYYY'), to_char(p_inizio, 'HH24:MI'))
  where id = p_richiesta;
  perform private.libera_partita(v_r.partita_id, v_r.id);
  v_id := private.crea_richiesta(v_r.partita_id, p_campo, p_data, p_inizio, p_nota, v_uid, true);
  perform private.scrivi_log('controproposta', v_id::text);
  return v_id;
end
$$;

revoke all on function
  public.create_request(uuid, text, date, time, text),
  public.accept_request(uuid),
  public.cancel_request(uuid, text),
  public.confirm_request(uuid),
  public.reject_request(uuid, text),
  public.cancel_confirmed(uuid, text),
  public.player_cancel_confirmed(uuid, text),
  public.counter_propose(uuid, text, date, time, text)
from public, anon;
grant execute on function
  public.create_request(uuid, text, date, time, text),
  public.accept_request(uuid),
  public.cancel_request(uuid, text),
  public.confirm_request(uuid),
  public.reject_request(uuid, text),
  public.cancel_confirmed(uuid, text),
  public.player_cancel_confirmed(uuid, text),
  public.counter_propose(uuid, text, date, time, text)
to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role), private.is_giocatore_partita(uuid),
  private.is_trusted(), private.fail(text, text), private.config_default() to authenticated;
