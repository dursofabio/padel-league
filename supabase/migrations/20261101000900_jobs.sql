-- Scheduled jobs (called by pg_cron) and the email reminder query (GitHub Actions).

-- Pending requests past their deadline become 'scaduta'; their match goes back to 'da programmare'.
create or replace function private.job_scadenze() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.richieste
    set stato = 'scaduta', nota = coalesce(nota || ' · ', '') || 'Nessuna risposta entro la scadenza'
    where stato = 'attesa' and scadenza <= now()
    returning id, partita_id
  loop
    perform private.libera_partita(r.partita_id, r.id);
    insert into public.log (chi, cosa, riferimento) values (null, 'richiesta scaduta', r.id::text);
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Materialises every recurrence over the next `p_giorni` days. Returns occupations created.
create or replace function private.job_ricorrenze(p_giorni int default 28) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_res jsonb;
  n int := 0;
begin
  for v_id in select id from public.ricorrenze where al >= private.oggi() order by id loop
    v_res := private.materializza(v_id, p_giorni, null);
    n := n + (v_res ->> 'creati')::int;
    if jsonb_array_length(v_res -> 'saltati') > 0 then
      insert into public.log (chi, cosa, riferimento)
      values (null, 'ricorrenza: giorni saltati ' || (v_res -> 'saltati')::text, v_id::text);
    end if;
  end loop;
  return n;
end
$$;

-- Logs (once per period) the matches not played in periods already over.
create or replace function private.job_non_giocate() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select t.id as torneo_id, t.nome, pe.id as periodo_id, pe.etichetta,
           string_agg(p.codice, ', ' order by p.codice) as codici, count(*) as quante
    from public.tornei t
    join public.periodi pe on pe.torneo_id = t.id and pe.fine < private.oggi()
    join public.partite p on p.periodo_id = pe.id and p.stato not in ('giocata', 'tavolino')
    where t.stato in ('gironi', 'fasiFinali')
    group by t.id, t.nome, pe.id, pe.etichetta
  loop
    continue when exists (
      select 1 from public.log where cosa like 'partite non giocate%' and riferimento = r.periodo_id::text
    );
    insert into public.log (chi, cosa, riferimento)
    values (null, format('partite non giocate (%s, %s): %s', r.nome, r.etichetta, r.codici), r.periodo_id::text);
    n := n + r.quante;
  end loop;
  return n;
end
$$;

-- Reminder emails: [{email, nome, righe: text[]}]. service_role only (GitHub Actions).
create or replace function public.email_promemoria() returns jsonb
language sql stable security definer set search_path = '' as $$
  with attivi as (
    select id, nome from public.tornei where stato in ('gironi', 'fasiFinali')
  ),
  righe as (
    -- 1. players of approved teams with no future availability
    select sg.user_id, 1 as ordine,
           format('%s: non hai ancora indicato le tue disponibilità', t.nome) as riga
    from attivi t
    join public.squadre s on s.torneo_id = t.id and s.stato = 'approvata'
    join public.squadra_giocatori sg on sg.squadra_id = s.id
    left join public.disponibilita d on d.torneo_id = t.id and d.user_id = sg.user_id
    where not exists (
      select 1 from jsonb_object_keys(coalesce(d.fasce, '{}'::jsonb)) k
      where k >= to_char(private.oggi(), 'YYYY-MM-DD')
        and jsonb_typeof(d.fasce -> k) = 'array' and jsonb_array_length(d.fasce -> k) > 0
    )
    union all
    -- 2. matches not scheduled in periods ending within 3 days
    select g, 2,
           format('%s: il periodo "%s" termina il %s e la partita %s non è ancora programmata',
                  t.nome, pe.etichetta, to_char(pe.fine, 'DD/MM/YYYY'), p.codice)
    from attivi t
    join public.periodi pe on pe.torneo_id = t.id and pe.fine between private.oggi() and private.oggi() + 3
    join public.partite p on p.periodo_id = pe.id and p.stato in ('da programmare', 'richiesta')
    cross join lateral unnest(private.giocatori_partita(p.id)) g
    union all
    -- 3a. requests expiring within 12 hours: players who still have to accept
    select rg.user_id, 3,
           format('Richiesta del %s alle %s in scadenza: accettala', to_char(r.data, 'DD/MM/YYYY'), to_char(r.inizio, 'HH24:MI'))
    from public.richieste r
    join public.richiesta_giocatori rg on rg.richiesta_id = r.id and rg.accettata_at is null
    where r.stato = 'attesa' and r.scadenza > now() and r.scadenza <= now() + interval '12 hours'
    union all
    -- 3b. complete requests expiring within 12 hours: court managers
    select pr.id, 4,
           format('Richiesta del %s alle %s in scadenza: conferma o rifiuta', to_char(r.data, 'DD/MM/YYYY'), to_char(r.inizio, 'HH24:MI'))
    from public.richieste r
    cross join public.profiles pr
    where r.stato = 'attesa' and r.scadenza > now() and r.scadenza <= now() + interval '12 hours'
      and not exists (select 1 from public.richiesta_giocatori rg where rg.richiesta_id = r.id and rg.accettata_at is null)
      and (pr.roles && '{gestore,admin}'::public.app_role[])
  ),
  distinte as (
    select distinct user_id, ordine, riga from righe
  )
  select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'nome', u.nome, 'righe', u.righe) order by u.email), '[]'::jsonb)
  from (
    select pr.email, pr.nome, array_agg(d.riga order by d.ordine, d.riga) as righe
    from distinte d
    join public.profiles pr on pr.id = d.user_id
    where coalesce(pr.email, '') <> ''
    group by pr.id, pr.email, pr.nome
  ) u
$$;

revoke all on function public.email_promemoria() from public, anon, authenticated;
grant execute on function public.email_promemoria() to service_role;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(public.app_role), private.is_giocatore_partita(uuid),
  private.is_trusted(), private.fail(text, text), private.config_default() to authenticated;
