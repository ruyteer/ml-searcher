"use client";

import { useQueryStates } from "nuqs";
import { useMemo, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconBuscar, IconCarregando, IconFechar, IconChevronBaixo } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { productsParsers } from "./params";
import type { WatchOption } from "@/lib/data/products";

/// BlockedFilter: os valores all/blocked/unblocked continuam na URL, só o
/// rótulo muda.
const DISPONIBILIDADE_OPTIONS = [
  { value: "unblocked", label: "Disponíveis" },
  { value: "blocked", label: "Bloqueados" },
  { value: "all", label: "Todos" },
];

/// O Base UI só descobre o rótulo do item selecionado depois que o popup abre
/// pelo menos uma vez. Sem este mapa o gatilho mostra o valor cru do banco
/// ("unblocked") até o usuário abrir a lista. Passar `items` no Select.Root
/// resolve: o rótulo certo aparece já na primeira renderização.
const DISPONIBILIDADE_ITEMS: Record<string, string> = Object.fromEntries(
  DISPONIBILIDADE_OPTIONS.map((o) => [o.value, o.label]),
);

export interface ProductsFiltersProps {
  watches: WatchOption[];
  /// true quando a tabela está sendo exibida (o usuário já escolheu o que ver).
  listing: boolean;
}

/// Barra de filtros de /produtos. A busca por nome fica sempre visível, mesmo
/// na tela de entrada: digitar um nome já vale como "sei o que quero ver" e
/// dispara a listagem sem precisar escolher categoria.
export function ProductsFilters({ watches, listing }: ProductsFiltersProps) {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(productsParsers, {
    shallow: false,
    startTransition,
    clearOnDefault: true,
  });

  const hasFilters =
    Boolean(filters.search) ||
    Boolean(filters.watchId) ||
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.blocked !== "unblocked" ||
    filters.tudo;

  const clearAll = () =>
    setFilters({
      search: null,
      watchId: null,
      priceMin: null,
      priceMax: null,
      blocked: null,
      page: 1,
      tudo: null,
    });

  // null deixa o Select mostrar o placeholder "Escolher categoria" na tela de
  // entrada, em vez de fingir que já existe uma seleção.
  const categoryValue: string | null = filters.watchId ?? (filters.tudo ? "TODAS" : null);

  const categoryItems = useMemo<Record<string, string>>(
    () => ({ TODAS: "Todas as categorias", ...Object.fromEntries(watches.map((w) => [w.id, w.label])) }),
    [watches],
  );

  return (
    <div className="flex flex-col gap-2">
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
              placeholder="Digite parte do nome do produto..."
              className="pl-7"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Categoria monitorada</label>
          <Select
            items={categoryItems}
            value={categoryValue}
            onValueChange={(v) =>
              setFilters(
                v === "TODAS"
                  ? { watchId: null, tudo: true, page: 1 }
                  : { watchId: v, tudo: null, page: 1 },
              )
            }
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Escolher categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas as categorias</SelectItem>
              {watches.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <label className="text-xs text-muted-foreground">Mostrar</label>
          <Select
            items={DISPONIBILIDADE_ITEMS}
            value={filters.blocked}
            onValueChange={(v) => setFilters({ blocked: v as typeof filters.blocked, page: 1 })}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISPONIBILIDADE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <HugeiconsIcon icon={IconFechar} size={14} strokeWidth={1.5} /> Limpar filtros
          </Button>
        )}

        {isPending && (
          <HugeiconsIcon
            icon={IconCarregando}
            size={16}
            strokeWidth={1.5}
            className="animate-spin text-muted-foreground"
          />
        )}
      </div>

      {listing && (
        <div>
          <Button variant="ghost" size="xs" onClick={clearAll} className="text-muted-foreground">
            <HugeiconsIcon icon={IconChevronBaixo} size={13} strokeWidth={1.5} className="rotate-90" />
            Voltar para a escolha de categoria
          </Button>
        </div>
      )}
    </div>
  );
}
