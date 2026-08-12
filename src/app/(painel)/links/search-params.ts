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
  // shallow: false força ida ao servidor a cada troca — o conteúdo da tabela
  // (ordenação) e do drawer de detalhe (linkId) são renderizados no Server
  // Component da página, então uma troca só no client (shallow) nunca chega
  // lá: a tabela não reordena e o drawer abre com o `children` antigo (que
  // era `null` na primeira carga), ou seja, vazio.
  sort: parseAsStringEnum([...LINK_SORT_OPTIONS]).withDefault("clicks-desc").withOptions({
    shallow: false,
  }),
  linkId: parseAsString.withOptions({ shallow: false }),
};

export const linksSearchParamsCache = createSearchParamsCache(linksSearchParams);
