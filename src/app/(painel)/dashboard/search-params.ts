import { createLoader, parseAsStringLiteral } from "nuqs/server";
import type { Period } from "@/lib/periods";

const PERIODS = ["7d", "30d", "90d"] as const satisfies readonly Period[];

/// Parser único, compartilhado entre o client (useQueryState no seletor) e o
/// server (loadDashboardSearchParams na página) — mesma fonte da verdade.
/// shallow: false força uma ida ao servidor a cada troca de período, já que
/// os dados do dashboard são todos buscados em Server Components.
export const periodParser = parseAsStringLiteral(PERIODS).withDefault("30d").withOptions({
  shallow: false,
});

export const dashboardSearchParams = { period: periodParser };

export const loadDashboardSearchParams = createLoader(dashboardSearchParams);
