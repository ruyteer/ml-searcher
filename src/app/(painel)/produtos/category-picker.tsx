"use client";

import { useTransition } from "react";
import { useQueryStates } from "nuqs";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconProdutos, IconOfertas, IconCarregando, IconNadaAqui } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { productsParsers } from "./params";
import type { CategorySummary } from "./data";

export interface CategoryPickerProps {
  categories: CategorySummary[];
  totalProducts: number;
  uncategorized: number;
  recentDays: number;
}

/// Tela de entrada de /produtos. O catálogo tem dezenas de milhares de itens e
/// ninguém rola isso: em vez de despejar a lista, a página pergunta primeiro o
/// que o usuário quer ver. As categorias vêm ordenadas por quantidade de
/// ofertas recentes, que é onde há mais chance de achar algo pra divulgar hoje.
///
/// A busca por nome fica sempre visível acima (filters.tsx) e funciona sem
/// escolher categoria nenhuma. Quem quiser mesmo o catálogo inteiro tem o
/// botão do rodapé, que grava `tudo=true` na URL.
export function CategoryPicker({ categories, totalProducts, uncategorized, recentDays }: CategoryPickerProps) {
  const [isPending, startTransition] = useTransition();
  const [, setParams] = useQueryStates(productsParsers, {
    shallow: false,
    startTransition,
    clearOnDefault: true,
  });

  const pick = (watchId: string) => setParams({ watchId, page: 1, tudo: null });
  const showAll = () => setParams({ tudo: true, page: 1 });

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <HugeiconsIcon icon={IconNadaAqui} size={20} strokeWidth={1.6} aria-hidden="true" />
        </div>
        <p className="font-heading text-sm font-medium text-foreground">Nenhuma categoria com produtos ainda</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Dispare uma varredura em Ofertas para o painel começar a preencher o catálogo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-sm font-medium text-foreground">
            Escolha uma categoria para ver os produtos
          </h2>
          <p className="text-sm text-muted-foreground">
            São {totalProducts.toLocaleString("pt-BR")} produtos no total, muito para olhar de uma vez.
            As categorias com mais ofertas nos últimos {recentDays} dias aparecem primeiro.
          </p>
        </div>
        {isPending && (
          <HugeiconsIcon
            icon={IconCarregando}
            size={16}
            strokeWidth={1.5}
            className="animate-spin text-muted-foreground"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((category) => (
          <Card key={category.id} className="p-0">
            <button
              type="button"
              disabled={isPending}
              onClick={() => pick(category.id)}
              className={cn(
                "flex w-full flex-col items-start gap-2 rounded-xl p-3 text-left transition-colors",
                "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-60",
              )}
            >
              <span className="line-clamp-2 text-sm font-medium text-foreground">{category.label}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <HugeiconsIcon icon={IconProdutos} size={13} strokeWidth={1.5} />
                  {category.productCount.toLocaleString("pt-BR")}{" "}
                  {category.productCount === 1 ? "produto" : "produtos"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    category.recentOfferCount > 0 && "text-success",
                  )}
                >
                  <HugeiconsIcon icon={IconOfertas} size={13} strokeWidth={1.5} />
                  {category.recentOfferCount === 0
                    ? "sem ofertas recentes"
                    : `${category.recentOfferCount.toLocaleString("pt-BR")} ${
                        category.recentOfferCount === 1 ? "oferta recente" : "ofertas recentes"
                      }`}
                </span>
              </span>
            </button>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="outline" size="sm" disabled={isPending} onClick={showAll}>
          Ver os {totalProducts.toLocaleString("pt-BR")} produtos de todas as categorias
        </Button>
        {uncategorized > 0 && (
          <span className="text-xs text-muted-foreground">
            {uncategorized.toLocaleString("pt-BR")} produtos ainda não pertencem a nenhuma categoria monitorada
            e só aparecem em &quot;todas&quot;.
          </span>
        )}
      </div>
    </div>
  );
}
