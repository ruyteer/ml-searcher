"use client";

import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { productsParsers } from "./params";
import type { WatchOption } from "@/lib/data/products";

const BLOCKED_OPTIONS = [
  { value: "unblocked", label: "Esconder bloqueados" },
  { value: "blocked", label: "Só bloqueados" },
  { value: "all", label: "Todos" },
];

export interface ProductsFiltersProps {
  watches: WatchOption[];
}

/// Barra de filtros de /produtos — mesmo padrão de /ofertas/filters.tsx.
export function ProductsFilters({ watches }: ProductsFiltersProps) {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(productsParsers, {
    shallow: false,
    startTransition,
    clearOnDefault: true,
  });

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <label className="text-xs text-muted-foreground">Buscar</label>
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            strokeWidth={1.5}
            className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value || null, page: 1 })}
            placeholder="Título do produto..."
            className="pl-7"
          />
        </div>
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
        <label className="text-xs text-muted-foreground">Bloqueados</label>
        <Select value={filters.blocked} onValueChange={(v) => setFilters({ blocked: v as typeof filters.blocked, page: 1 })}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOCKED_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(filters.search || filters.watchId || filters.priceMin || filters.priceMax) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({ search: null, watchId: null, priceMin: null, priceMax: null, page: 1 })}
        >
          Limpar filtros
        </Button>
      )}

      {isPending && <HugeiconsIcon icon={Loading03Icon} size={16} strokeWidth={1.5} className="animate-spin text-muted-foreground" />}
    </div>
  );
}
