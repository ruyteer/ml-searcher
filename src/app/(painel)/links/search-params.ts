// Parsers compartilhados entre o cache de leitura do servidor
// (createSearchParamsCache) e os hooks do cliente (useQueryStates) — a
// mesma definição garante que os dois lados nunca saiam de sincronia.
import { parseAsString, parseAsStringEnum, createSearchParamsCache } from "nuqs/server";
import { LinkKind } from "@/lib/enums";
import { LINK_PERIOD_OPTIONS, LINK_SORT_OPTIONS } from "@/lib/link-filters";

export const LINK_KIND_FILTER_OPTIONS = ["all", ...Object.values(LinkKind)] as const;
export const LINK_ACTIVE_FILTER_OPTIONS = ["all", "active", "inactive"] as const;

export const linksSearchParams = {
  kind: parseAsStringEnum([...LINK_KIND_FILTER_OPTIONS]).withDefault("all"),
  active: parseAsStringEnum([...LINK_ACTIVE_FILTER_OPTIONS]).withDefault("all"),
  q: parseAsString.withDefault(""),
  period: parseAsStringEnum([...LINK_PERIOD_OPTIONS]).withDefault("all"),
  sort: parseAsStringEnum([...LINK_SORT_OPTIONS]).withDefault("clicks-desc"),
  linkId: parseAsString,
};

export const linksSearchParamsCache = createSearchParamsCache(linksSearchParams);
