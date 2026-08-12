"use client";

import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { offersParsers } from "./params";
import type { WatchOption } from "@/lib/data/products";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "NEW", label: "Novas" },
  { value: "PUBLISHED", label: "Publicadas" },
  { value: "IGNORED", label: "Ignoradas" },
  { value: "ALL", label: "Todas" },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "score", label: "Score" },
  { value: "discount", label: "Maior desconto" },
  { value: "price", label: "Menor preço" },
  { value: "recent", label: "Mais recentes" },
];

export interface OffersFiltersProps {
  watches: WatchOption[];
}

/// Barra de filtros de /ofertas — cada campo escreve direto na URL via nuqs
/// (shallow: false, pra Next re-renderizar a lista no servidor). Um único
/// isPending cobre a troca de qualquer filtro, usado no skeleton da lista.
export function OffersFilters({ watches }: OffersFiltersProps) {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(offersParsers, {
    shallow: false,
    startTransition,
    // toda mudança de filtro reseta a paginação
    clearOnDefault: true,
  });

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <label className="text-xs text-muted-foreground">Buscar</label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value || null, page: 1 })}
            placeholder="Título do produto..."
            className="pl-7"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Status</label>
        <Select value={filters.status} onValueChange={(v) => setFilters({ status: v as typeof filters.status, page: 1 })}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Watch</label>
        <Select
          value={filters.watchId ?? "ALL"}
          onValueChange={(v) => setFilters({ watchId: v === "ALL" ? null : v, page: 1 })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as watches</SelectItem>
            {watches.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Desconto mín. %</label>
        <Input
          type="number"
          min={0}
          max={100}
          value={filters.minDiscount || ""}
          onChange={(e) => setFilters({ minDiscount: e.target.value ? Number(e.target.value) : 0, page: 1 })}
          className="w-24"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Preço min.</label>
        <Input
          type="number"
          min={0}
          value={filters.priceMin ?? ""}
          onChange={(e) => setFilters({ priceMin: e.target.value ? Number(e.target.value) : null, page: 1 })}
          className="w-24"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Preço máx.</label>
        <Input
          type="number"
          min={0}
          value={filters.priceMax ?? ""}
          onChange={(e) => setFilters({ priceMax: e.target.value ? Number(e.target.value) : null, page: 1 })}
          className="w-24"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Ordenar por</label>
        <Select value={filters.sort} onValueChange={(v) => setFilters({ sort: v as typeof filters.sort })}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(filters.search || filters.watchId || filters.minDiscount > 0 || filters.priceMin || filters.priceMax) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setFilters({ search: null, watchId: null, minDiscount: null, priceMin: null, priceMax: null, page: 1 })
          }
        >
          Limpar filtros
        </Button>
      )}

      {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
