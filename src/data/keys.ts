/** Query keys: realtime invalidates by prefix (e.g. ['requests']). */
export const qk = {
  tournaments: () => ['tournaments'] as const,
  tournament: (tid: string) => ['tournaments', tid] as const,
  periods: (tid: string) => ['periods', tid] as const,
  teams: (tid: string) => ['teams', tid] as const,
  matches: (tid: string) => ['matches', tid] as const,
  courts: () => ['courts'] as const,
  recurrences: () => ['recurrences'] as const,
  bookings: (from: string, to: string) => ['bookings', from, to] as const,
  requests: (scope: string, ...args: (string | undefined)[]) => ['requests', scope, ...args] as const,
  availability: (tid: string, uids: string[]) => ['availability', tid, ...uids] as const,
  profiles: () => ['profiles'] as const,
  names: () => ['names'] as const,
  me: (uid: string) => ['profiles', 'me', uid] as const,
  invite: (teamId: string) => ['invites', teamId] as const,
  auditLog: () => ['audit_log'] as const,
};

/** Table → prefixes to invalidate when a realtime event arrives. */
export const INVALIDATE_BY_TABLE: Record<string, (readonly string[])[]> = {
  requests: [['requests'], ['matches']],
  request_players: [['requests']],
  matches: [['matches']],
  bookings: [['bookings']],
  teams: [['teams']],
  availability: [['availability']],
};
