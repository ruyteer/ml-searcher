/// Dinheiro trafega em centavos no banco inteiro. Estas são as únicas
/// funções que devem converter entre centavos e reais.

export function toCents(value: number | string): number {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(cents: number): string {
  return BRL.format(fromCents(cents));
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n);
}

export function discountPct(price: number, reference: number): number {
  if (reference <= 0 || price >= reference) return 0;
  return Math.round(((reference - price) / reference) * 100);
}

export function formatDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(d));
}
