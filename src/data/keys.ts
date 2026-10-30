/** Query keys: realtime invalidates by prefix (e.g. ['richieste']). */
export const qk = {
  tornei: () => ['tornei'] as const,
  torneo: (tid: string) => ['tornei', tid] as const,
  periodi: (tid: string) => ['periodi', tid] as const,
  squadre: (tid: string) => ['squadre', tid] as const,
  partite: (tid: string) => ['partite', tid] as const,
  campi: () => ['campi'] as const,
  ricorrenze: () => ['ricorrenze'] as const,
  occupazioni: (from: string, to: string) => ['occupazioni', from, to] as const,
  richieste: (scope: string, ...args: (string | undefined)[]) => ['richieste', scope, ...args] as const,
  disponibilita: (tid: string, uids: string[]) => ['disponibilita', tid, ...uids] as const,
  profili: () => ['profili'] as const,
  nomi: () => ['nomi'] as const,
  me: (uid: string) => ['profili', 'me', uid] as const,
  invito: (squadraId: string) => ['inviti', squadraId] as const,
  log: () => ['log'] as const,
};

/** Table → prefixes to invalidate when a realtime event arrives. */
export const INVALIDA_PER_TABELLA: Record<string, (readonly string[])[]> = {
  richieste: [['richieste'], ['partite']],
  richiesta_giocatori: [['richieste']],
  partite: [['partite']],
  occupazioni: [['occupazioni']],
  squadre: [['squadre']],
  disponibilita: [['disponibilita']],
};
