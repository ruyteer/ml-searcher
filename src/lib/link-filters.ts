/// Opções de filtro da página de links. Fica fora de src/lib/data/ de
/// propósito: aquele módulo é `server-only`, e os parsers de querystring
/// (nuqs) rodam também no cliente.

export const LINK_PERIOD_OPTIONS = ["all", "7d", "30d", "90d"] as const;
export type LinkPeriod = (typeof LINK_PERIOD_OPTIONS)[number];

export const LINK_SORT_OPTIONS = [
  "clicks-desc",
  "clicks-asc",
  "createdAt-desc",
  "createdAt-asc",
] as const;
export type LinkSort = (typeof LINK_SORT_OPTIONS)[number];
