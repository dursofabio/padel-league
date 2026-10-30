/** Error → Italian message, by RPC code (hint), Postgres code, or auth/network error. */
const PER_HINT: Record<string, string> = {
  NOT_AUTHORIZED: 'Non hai i permessi per questa operazione.',
  NOT_FOUND: 'Non trovato: forse è stato appena eliminato.',
  BAD_STATE: 'Operazione non più possibile: lo stato è cambiato nel frattempo.',
  SLOT_TAKEN: 'Questo slot è stato appena richiesto da un’altra partita. Scegline un altro.',
  MATCH_HAS_REQUEST: 'La partita ha già una richiesta in attesa: annullala prima di farne un’altra.',
  OVERLAP: 'Il campo è occupato in quell’orario.',
  NOT_ALL_ACCEPTED: 'Si può confermare solo quando hanno accettato tutti e 4.',
  EXPIRED: 'La richiesta è scaduta: scegline un’altra.',
  OFF_GRID_DISABLED: 'In questo torneo non si possono proporre orari fuori griglia.',
  BAD_STEP: 'L’orario non rispetta il passo consentito.',
  COURT_CLOSED: 'Il campo è chiuso in quel giorno o orario.',
  IN_PAST: 'L’orario è già passato.',
  INVALID_SCORE: 'Il punteggio non è valido.',
  ALREADY_CONFIRMED: 'Il risultato è già stato confermato.',
  TOO_LATE: 'È troppo tardi per annullare dall’app: scrivi al gestore del campo.',
  TEAM_FULL: 'La coppia è già completa.',
  ALREADY_IN_TEAM: 'Fai già parte di una coppia in questo torneo.',
  BAD_TOKEN: 'Il link d’invito non è valido o è scaduto.',
  REGISTRATION_CLOSED: 'Le iscrizioni sono chiuse.',
  CALENDAR_EXISTS: 'Il calendario dei gironi è già stato generato.',
  BAD_CALENDAR: 'Il calendario non è completo: rigeneralo.',
  PHASE_EXISTS: 'Questa fase finale è già stata generata.',
  BAD_BRACKET: 'Il tabellone non è coerente: rigeneralo.',
};

const PER_PG: Record<string, string> = {
  '23505': 'Esiste già: qualcuno l’ha appena creato.',
  '23P01': 'Il campo è già occupato in quell’orario.',
  '42501': 'Non hai i permessi per questa operazione.',
  PGRST116: 'Non trovato.',
};

const PER_AUTH: Record<string, string> = {
  invalid_credentials: 'Email o password non corretti.',
  email_not_confirmed: 'Conferma prima la tua email: controlla la posta.',
  user_already_exists: 'Esiste già un account con questa email.',
  email_exists: 'Esiste già un account con questa email.',
  weak_password: 'Password troppo debole: usa almeno 8 caratteri.',
  over_email_send_rate_limit: 'Troppe email inviate: riprova tra qualche minuto.',
};

interface ErrLike {
  code?: string;
  hint?: string;
  message?: string;
  name?: string;
}

export function messaggioErrore(e: unknown): string {
  const err = (e ?? {}) as ErrLike;
  if (err.hint && PER_HINT[err.hint]) {
    // For OVERLAP and INVALID_SCORE the server explains the reason in Italian: show it.
    if ((err.hint === 'OVERLAP' || err.hint === 'INVALID_SCORE') && err.message) return err.message;
    return PER_HINT[err.hint];
  }
  if (err.code && PER_AUTH[err.code]) return PER_AUTH[err.code];
  if (err.code && PER_PG[err.code]) return PER_PG[err.code];
  if (err.code === 'P0001' && err.message) return err.message;
  if (err.name === 'TypeError' || /fetch|network/i.test(err.message ?? ''))
    return 'Sei offline o il server non risponde. Riprova tra poco.';
  console.error(e);
  return 'Qualcosa non ha funzionato. Riprova.';
}
