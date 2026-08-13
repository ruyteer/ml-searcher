"use client";

import { useQueryStates } from "nuqs";
import { useMemo, useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconBuscar, IconCarregando, IconFechar, IconChevronBaixo, IconFiltrar } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

/// Alvo de toque de 44px no celular, tamanho compacto de volta no desktop.
/// `min-h` porque o `h-8` dos componentes base vem de seletor mais específico.
const TOUCH_FIELD = "min-h-11 sm:min-h-8";

export interface ProductsFiltersProps {
  watches: WatchOption[];
  /// true quando a tabela está sendo exibida (o usuário já escolheu o que ver).
  listing: boolean;
}

/// Barra de filtros de /produtos. A busca por nome fica sempre visível, mesmo
/// na tela de entrada: digitar um nome já vale como "sei o que quero ver" e
/// dispara a listagem sem precisar escolher categoria.
///
/// No celular o resto dos campos vai para um painel que sobe de baixo, com um
/// contador do que está ativo, para a lista começar logo abaixo da busca.
export function ProductsFilters({ watches, listing }: ProductsFiltersProps) {
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
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

  const activeCount =
    (filters.watchId ? 1 : 0) +
    (filters.priceMin !== null ? 1 : 0) +
    (filters.priceMax !== null ? 1 : 0) +
    (filters.blocked !== "unblocked" ? 1 : 0);

  const clearAll = () => {
    setSheetOpen(false);
    setFilters({
      search: null,
      watchId: null,
      priceMin: null,
      priceMax: null,
      blocked: null,
      page: 1,
      tudo: null,
    });
  };

  // null deixa o Select mostrar o placeholder "Escolher categoria" na tela de
  // entrada, em vez de fingir que já existe uma seleção.
  const categoryValue: string | null = filters.watchId ?? (filters.tudo ? "TODAS" : null);

  const categoryItems = useMemo<Record<string, string>>(
    () => ({ TODAS: "Todas as categorias", ...Object.fromEntries(watches.map((w) => [w.id, w.label])) }),
    [watches],
  );

  /// Os mesmos campos servem à linha do desktop e ao painel do celular.
  const fields = (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Categoria monitorada</label>
        <Select
          items={categoryItems}
          value={categoryValue}
          onValueChange={(v) =>
            setFilters(v === "TODAS" ? { watchId: null, tudo: true, page: 1 } : { watchId: v, tudo: null, page: 1 })
          }
        >
          <SelectTrigger className={`w-full sm:min-w-52 ${TOUCH_FIELD}`}>
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
          inputMode="decimal"
          min={0}
          value={filters.priceMin ?? ""}
          onChange={(e) => setFilters({ priceMin: e.target.value ? Number(e.target.value) : null, page: 1 })}
          className={`w-full sm:w-24 ${TOUCH_FIELD}`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Preço até</label>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          value={filters.priceMax ?? ""}
          onChange={(e) => setFilters({ priceMax: e.target.value ? Number(e.target.value) : null, page: 1 })}
          className={`w-full sm:w-24 ${TOUCH_FIELD}`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Mostrar</label>
        <Select
          items={DISPONIBILIDADE_ITEMS}
          value={filters.blocked}
          onValueChange={(v) => setFilters({ blocked: v as typeof filters.blocked, page: 1 })}
        >
          <SelectTrigger className={`w-full sm:w-40 ${TOUCH_FIELD}`}>
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
    </>
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Linha compacta: no celular é só isto que separa o topo da lista. */}
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
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
              className={`pl-7 ${TOUCH_FIELD}`}
            />
          </div>
        </div>

        <Button variant="outline" onClick={() => setSheetOpen(true)} className="h-11 shrink-0 gap-1.5 sm:hidden">
          <HugeiconsIcon icon={IconFiltrar} size={16} strokeWidth={1.5} />
          Filtros
          {activeCount > 0 && <Badge className="ml-0.5">{activeCount}</Badge>}
        </Button>

        {isPending && (
          <HugeiconsIcon
            icon={IconCarregando}
            size={16}
            strokeWidth={1.5}
            className="mb-2 hidden animate-spin text-muted-foreground sm:block"
          />
        )}
      </div>

      {/* Desktop: tudo aberto, como antes. */}
      <div className="hidden flex-wrap items-end gap-2 sm:flex">
        {fields}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <HugeiconsIcon icon={IconFechar} size={14} strokeWidth={1.5} /> Limpar filtros
          </Button>
        )}
      </div>

      {listing && (
        <div>
          <Button
            variant="ghost"
            size="xs"
            onClick={clearAll}
            className="h-11 text-muted-foreground sm:h-6"
          >
            <HugeiconsIcon icon={IconChevronBaixo} size={14} strokeWidth={1.5} className="rotate-90" />
            Voltar para a escolha de categoria
          </Button>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[88svh] rounded-t-xl sm:hidden">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>
              {activeCount === 0
                ? "Nenhum filtro ativo além da busca pelo nome."
                : `${activeCount} ${activeCount === 1 ? "filtro ativo" : "filtros ativos"} agora.`}
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">{fields}</div>

          {/* O recuo extra embaixo tira os botões de cima da faixa de gesto do
              aparelho. */}
          <SheetFooter className="flex-row gap-2 pb-[calc(var(--area-segura-baixo)+1rem)]">
            <Button variant="outline" className="h-11 flex-1" onClick={clearAll} disabled={!hasFilters}>
              <HugeiconsIcon icon={IconFechar} size={16} strokeWidth={1.5} /> Limpar
            </Button>
            <Button className="h-11 flex-1" onClick={() => setSheetOpen(false)}>
              {isPending ? (
                <HugeiconsIcon icon={IconCarregando} size={16} strokeWidth={1.5} className="animate-spin" />
              ) : null}
              Ver produtos
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
