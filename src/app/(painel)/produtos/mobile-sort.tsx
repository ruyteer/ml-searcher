"use client";

import { useTransition } from "react";
import { useQueryStates } from "nuqs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productsParsers } from "./params";
import type { ProductSort, SortDir } from "@/lib/data/products";

/// Cada opção junta coluna + direção numa frase só: no celular não existe
/// "clicar no cabeçalho da coluna para inverter a ordem".
const OPTIONS: Array<{ value: string; label: string; sort: ProductSort; dir: SortDir }> = [
  { value: "lastSeen:desc", label: "Vistos por último", sort: "lastSeen", dir: "desc" },
  { value: "price:asc", label: "Mais baratos primeiro", sort: "price", dir: "asc" },
  { value: "price:desc", label: "Mais caros primeiro", sort: "price", dir: "desc" },
  { value: "sold:desc", label: "Mais vendidos", sort: "sold", dir: "desc" },
  { value: "title:asc", label: "Nome de A a Z", sort: "title", dir: "asc" },
];

const ITEMS: Record<string, string> = Object.fromEntries(OPTIONS.map((o) => [o.value, o.label]));

/// Ordenação da lista de produtos no celular. Escreve nos mesmos parâmetros de
/// URL que os cabeçalhos da tabela usam no desktop.
export function MobileSort() {
  const [, startTransition] = useTransition();
  const [{ sort, sortDir }, setFilters] = useQueryStates(
    { sort: productsParsers.sort, sortDir: productsParsers.sortDir },
    { shallow: false, startTransition, clearOnDefault: true },
  );

  const current = `${sort}:${sortDir}`;
  const value = ITEMS[current] ? current : "lastSeen:desc";

  return (
    <div className="flex items-center gap-2">
      <label className="shrink-0 text-xs text-muted-foreground">Ordenar por</label>
      <Select
        items={ITEMS}
        value={value}
        onValueChange={(v) => {
          const option = OPTIONS.find((o) => o.value === v);
          if (!option) return;
          setFilters({ sort: option.sort, sortDir: option.dir });
        }}
      >
        <SelectTrigger className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
