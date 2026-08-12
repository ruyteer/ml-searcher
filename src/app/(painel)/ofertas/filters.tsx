"use client";

import { useQueryStates } from "nuqs";
import { useMemo, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconBuscar, IconCarregando, IconFechar } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { offersParsers } from "./params";
import type { WatchOption } from "@/lib/data/products";

/// Os valores continuam sendo NEW/PUBLISHED/IGNORED/ALL na URL e no banco.
/// Só o texto muda.
const SITUACAO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "NEW", label: "Novas" },
  { value: "PUBLISHED", label: "Já publicadas" },
  { value: "IGNORED", label: "Ignoradas" },
  { value: "ALL", label: "Todas" },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "score", label: "Melhores oportunidades" },
  { value: "discount", label: "Maior desconto" },
  { value: "price", label: "Menor preço" },
  { value: "recent", label: "Mais recentes" },
];

/// O Base UI só descobre o rótulo do item selecionado depois que o popup abre
/// pelo menos uma vez. Sem este mapa o gatilho mostra o valor cru ("NEW",
/// "score") até o usuário abrir a lista. `items` no Select.Root resolve.
const SITUACAO_ITEMS: Record<string, string> = Object.fromEntries(
  SITUACAO_OPTIONS.map((o) => [o.value, o.label]),
);
const SORT_ITEMS: Record<string, string> = Object.fromEntries(SORT_OPTIONS.map((o) => [o.value, o.label]));

export interface OffersFiltersProps {
  watches: WatchOption[];
}

/// Barra de filtros de /ofertas. Cada campo escreve direto na URL via nuqs
/// (shallow: false, pra Next re-renderizar a lista no servidor). Um único
/// isPending cobre a troca de qualquer filtro, usado no skeleton da lista.
///
/// Vocabulário: nada de "watch", "status", "score" ou "all" na tela. O valor
/// gravado na URL continua igual, só o rótulo muda.
export function OffersFilters({ watches }: OffersFiltersProps) {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(offersParsers, {
    shallow: false,
    startTransition,
    // toda mudança de filtro reseta a paginação
    clearOnDefault: true,
  });

  const hasFilters =
    Boolean(filters.search) ||
    Boolean(filters.watchId) ||
    filters.minDiscount > 0 ||
    filters.priceMin !== null ||
    filters.priceMax !== null;

  const categoryItems = useMemo<Record<string, string>>(
    () => ({ ALL: "Todas as categorias", ...Object.fromEntries(watches.map((w) => [w.id, w.label])) }),
    [watches],
  );

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <label className="text-xs text-muted-foreground">Buscar pelo nome</label>
        <div className="relative">
          <HugeiconsIcon
            icon={IconBuscar}
            size={14}
            strokeWidth={1.5}
            className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value || null, page: 1 })}
            placeholder="Nome do produto..."
            className="pl-7"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Situação</label>
        <Select
          items={SITUACAO_ITEMS}
          value={filters.status}
          onValueChange={(v) => setFilters({ status: v as typeof filters.status, page: 1 })}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SITUACAO_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Categoria monitorada</label>
        <Select
          items={categoryItems}
          value={filters.watchId ?? "ALL"}
          onValueChange={(v) => setFilters({ watchId: v === "ALL" ? null : v, page: 1 })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as categorias</SelectItem>
            {watches.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Desconto mínimo %</label>
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
        <label className="text-xs text-muted-foreground">Preço de</label>
        <Input
          type="number"
          min={0}
          value={filters.priceMin ?? ""}
          onChange={(e) => setFilters({ priceMin: e.target.value ? Number(e.target.value) : null, page: 1 })}
          className="w-24"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Preço até</label>
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
        <Select
          items={SORT_ITEMS}
          value={filters.sort}
          onValueChange={(v) => setFilters({ sort: v as typeof filters.sort })}
        >
          <SelectTrigger className="w-48">
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

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setFilters({ search: null, watchId: null, minDiscount: null, priceMin: null, priceMax: null, page: 1 })
          }
        >
          <HugeiconsIcon icon={IconFechar} size={14} strokeWidth={1.5} /> Limpar filtros
        </Button>
      )}

      {isPending && (
        <HugeiconsIcon icon={IconCarregando} size={16} strokeWidth={1.5} className="animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
