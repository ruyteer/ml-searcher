"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconInfo, IconTrofeu, IconEstoque, IconUsuarios, IconProdutos } from "@/components/icons";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PriceSparkline } from "./price-sparkline";
import { OPPORTUNITY_EXPLAIN, opportunityCopy, referenceCopy } from "./offer-language";
import type { OfferListItem } from "@/lib/data/offers";

export interface OfferDetailsPopoverProps {
  offer: OfferListItem;
}

/// Botão discreto (ícone "i") ao lado do preço. Abre um popover que explica,
/// sem jargão: com o que o preço foi comparado, quanto isso representa, o que
/// é a nota de oportunidade e de que ela é feita. Nada de "score",
/// "referenceKind" ou "ML_ORIGINAL" na tela.
export function OfferDetailsPopover({ offer }: OfferDetailsPopoverProps) {
  const reason = referenceCopy(offer.referenceKind);
  const opportunity = opportunityCopy(offer.score);
  const savings = offer.referencePrice > offer.price ? offer.referencePrice - offer.price : 0;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            aria-label="Entender por que isto virou oferta"
          >
            <HugeiconsIcon icon={IconInfo} size={16} strokeWidth={1.5} />
          </Button>
        }
      />
      <PopoverContent align="end" className="flex w-80 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">Por que isto virou oferta</span>
          <p className="text-xs leading-relaxed text-muted-foreground">{reason.full}</p>
        </div>

        <div className="flex items-end justify-between gap-2 rounded-lg border border-border px-2.5 py-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase">{reason.beforeLabel}</span>
            <span className="text-sm tabular-nums text-muted-foreground line-through">
              {formatBRL(offer.referencePrice)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase">Agora</span>
            <span className="text-base font-semibold tabular-nums text-foreground">
              {formatBRL(offer.price)}
            </span>
          </div>
          <Badge variant="secondary" className="mb-0.5 tabular-nums">
            -{offer.discountPct}%
          </Badge>
        </div>

        {savings > 0 && (
          <p className="text-xs text-success">Diferença de {formatBRL(savings)} para quem comprar agora.</p>
        )}

        <Separator />

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <HugeiconsIcon icon={IconTrofeu} size={14} strokeWidth={1.5} />
              Oportunidade
            </span>
            <span className={cn("text-sm font-semibold tabular-nums", opportunity.tone)}>
              {opportunity.label} ({offer.score} de 100)
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{OPPORTUNITY_EXPLAIN}</p>
        </div>

        <Separator />

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {offer.product.sellerName && (
            <span className="inline-flex items-center gap-1.5">
              <HugeiconsIcon icon={IconUsuarios} size={13} strokeWidth={1.5} />
              Vendedor: {offer.product.sellerName}
            </span>
          )}
          {offer.product.watchLabel && (
            <span className="inline-flex items-center gap-1.5">
              <HugeiconsIcon icon={IconProdutos} size={13} strokeWidth={1.5} />
              Categoria monitorada: {offer.product.watchLabel}
            </span>
          )}
          {offer.product.freeShipping && (
            <span className="inline-flex items-center gap-1.5 text-success">
              <HugeiconsIcon icon={IconEstoque} size={13} strokeWidth={1.5} />
              Tem frete grátis
            </span>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-foreground">Preço nos últimos 30 dias</p>
          <PriceSparkline data={offer.history} height={56} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Para ver o gráfico completo, abra &quot;Ver histórico de preço&quot; no menu dos três pontos.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
