"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, StarIcon, TruckIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PriceSparkline } from "./price-sparkline";
import type { OfferListItem } from "@/lib/data/offers";

const REFERENCE_LABEL: Record<string, string> = {
  ML_ORIGINAL: "De/por do Mercado Livre",
  HISTORY_AVG: "Abaixo da média de preço",
  HISTORY_MIN: "Menor preço já visto",
};

export interface OfferDetailsPopoverProps {
  offer: OfferListItem;
}

/// Botão discreto (ícone "i") que abre um popover com tudo que não precisa
/// aparecer de cara no OfferCard: pontuação, o que está sendo comparado pra
/// achar o desconto, vendedor, frete grátis e o histórico de preço.
export function OfferDetailsPopover({ offer }: OfferDetailsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            aria-label="Ver detalhes da oferta"
          >
            <HugeiconsIcon icon={InformationCircleIcon} size={16} strokeWidth={1.5} />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground">Detalhes da oferta</span>
          <Badge variant="outline" className="shrink-0">
            {REFERENCE_LABEL[offer.referenceKind] ?? offer.referenceKind}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <HugeiconsIcon icon={StarIcon} size={13} strokeWidth={1.5} />
            Pontuação de oportunidade: {offer.score}
          </span>
          {offer.product.freeShipping && (
            <span className="inline-flex items-center gap-1">
              <HugeiconsIcon icon={TruckIcon} size={13} strokeWidth={1.5} />
              Frete grátis
            </span>
          )}
        </div>

        {offer.product.sellerName && (
          <p className="text-xs text-muted-foreground">Vendedor: {offer.product.sellerName}</p>
        )}

        <div>
          <p className="mb-1 text-xs font-medium text-foreground">Histórico de preço</p>
          <PriceSparkline data={offer.history} height={56} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
