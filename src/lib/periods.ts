/// Períodos de análise. Fica fora de src/lib/data/ de propósito: os módulos
/// de dados são `server-only`, e componentes de cliente (seletor de período)
/// precisam destes valores sem arrastar o Prisma para o bundle do navegador.

export type Period = "7d" | "30d" | "90d";

export const PERIODS = ["7d", "30d", "90d"] as const;

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
];

export function periodDays(period: Period): number {
  return period === "7d" ? 7 : period === "30d" ? 30 : 90;
}
