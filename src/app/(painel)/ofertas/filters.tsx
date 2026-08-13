"use client";

import { useQueryStates } from "nuqs";
import { useMemo, useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconBuscar, IconCarregando, IconFechar, IconFiltrar } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

/// Alvo de toque de 44px no celular; no desktop os campos voltam ao tamanho
/// compacto de antes. `min-h` em vez de `h` porque o `h-8` do componente base
/// vem com seletor mais específico e ganharia de um `h-11` solto.
const TOUCH_FIELD = "min-h-11 sm:min-h-8";

export interface OffersFiltersProps {
  watches: WatchOption[];
}

/// Barra de filtros de /ofertas. Cada campo escreve direto na URL via nuqs
/// (shallow: false, pra Next re-renderizar a lista no servidor). Um único
/// isPending cobre a troca de qualquer filtro, usado no skeleton da lista.
///
/// No celular a barra inteira empurrava a primeira oferta para fora da tela.
/// Agora só a busca e um botão "Filtros" ficam visíveis; o resto vai para um
/// painel que sobe de baixo, com um contador de quantos filtros estão ativos.
///
/// Vocabulário: nada de "watch", "status", "score" ou "all" na tela. O valor
/// gravado na URL continua igual, só o rótulo muda.
export function OffersFilters({ watches }: OffersFiltersProps) {
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
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

  /// Quantos recortes estão ativos além da busca, que já fica visível. É esse
  /// número que aparece no botão "Filtros" no celular.
  const activeCount =
    (filters.status !== "NEW" ? 1 : 0) +
    (filters.watchId ? 1 : 0) +
    (filters.minDiscount > 0 ? 1 : 0) +
    (filters.priceMin !== null ? 1 : 0) +
    (filters.priceMax !== null ? 1 : 0) +
    (filters.sort !== "score" ? 1 : 0);

  const categoryItems = useMemo<Record<string, string>>(
    () => ({ ALL: "Todas as categorias", ...Object.fromEntries(watches.map((w) => [w.id, w.label])) }),
    [watches],
  );

  const clearAll = () =>
    setFilters({
      search: null,
      watchId: null,
      minDiscount: null,
      priceMin: null,
      priceMax: null,
      status: null,
      sort: null,
      page: 1,
    });

  /// Os mesmos campos servem à linha do desktop e ao painel do celular. No
  /// celular cada campo ocupa a largura toda; no desktop eles voltam a caber
  /// lado a lado.
  const fields = (
    <>
      <div className="flex flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground">Situação</label>
        <Select
          items={SITUACAO_ITEMS}
          value={filters.status}
          onValueChange={(v) => setFilters({ status: v as typeof filters.status, page: 1 })}
        >
          <SelectTrigger className={`w-full sm:w-44 ${TOUCH_FIELD}`}>
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
          <SelectTrigger className={`w-full sm:min-w-52 ${TOUCH_FIELD}`}>
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
          inputMode="numeric"
          min={0}
          max={100}
          value={filters.minDiscount || ""}
          onChange={(e) => setFilters({ minDiscount: e.target.value ? Number(e.target.value) : 0, page: 1 })}
          className={`w-full sm:w-24 ${TOUCH_FIELD}`}
        />
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
        <label className="text-xs text-muted-foreground">Ordenar por</label>
        <Select
          items={SORT_ITEMS}
          value={filters.sort}
          onValueChange={(v) => setFilters({ sort: v as typeof filters.sort })}
        >
          <SelectTrigger className={`w-full sm:w-60 ${TOUCH_FIELD}`}>
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
    </>
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Linha compacta: no celular é só isto que fica entre o topo e a
          primeira oferta. */}
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
              placeholder="Nome do produto..."
              className={`pl-7 ${TOUCH_FIELD}`}
            />
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => setSheetOpen(true)}
          className="h-11 shrink-0 gap-1.5 sm:hidden"
        >
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

      {/* Celular: painel de filtros que sobe de baixo, alcançável com o polegar. */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[88svh] rounded-t-xl sm:hidden">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>
              {activeCount === 0
                ? "Nenhum filtro ativo, você está vendo as ofertas novas."
                : `${activeCount} ${activeCount === 1 ? "filtro ativo" : "filtros ativos"} agora.`}
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">{fields}</div>

          {/* O recuo extra embaixo tira os botões de cima da faixa de gesto do
              aparelho. */}
          <SheetFooter className="flex-row gap-2 pb-[calc(var(--area-segura-baixo)+1rem)]">
            <Button variant="outline" className="h-11 flex-1" onClick={clearAll} disabled={!hasFilters && activeCount === 0}>
              <HugeiconsIcon icon={IconFechar} size={16} strokeWidth={1.5} /> Limpar
            </Button>
            <Button className="h-11 flex-1" onClick={() => setSheetOpen(false)}>
              {isPending ? (
                <HugeiconsIcon icon={IconCarregando} size={16} strokeWidth={1.5} className="animate-spin" />
              ) : null}
              Ver ofertas
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
