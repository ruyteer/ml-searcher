"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductThumb } from "./product-thumb";
import { PriceTag } from "./price-tag";
import { CopyButton } from "./copy-button";
import { OfferDetailsPopover } from "./offer-details-popover";
import { OfferActionsMenu } from "./offer-actions-menu";
import type { PresellOption } from "./generate-link-menu";
import { OfferStatus, LinkKind } from "@/lib/enums";
import type { OfferListItem } from "@/lib/data/offers";
import { setOfferStatus, blockProductFromOffer, generateLink } from "@/app/(painel)/ofertas/actions";
import { cn } from "@/lib/utils";

export interface OfferCardProps {
  offer: OfferListItem;
  hotDiscount: number;
  presells?: PresellOption[];
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  className?: string;
}

/// Card de oferta usado em /ofertas. Card compacto: a imagem ocupa a largura
/// toda em proporção 16:10, e só o essencial fica visível de cara (imagem,
/// badge de desconto, título, preço). Score, tipo de referência, vendedor, frete
/// grátis e histórico ficam no popover de detalhes (ícone "i"). As demais
/// ações (gerar link, publicar, ignorar, bloquear) ficam no menu kebab; só
/// "Copiar link" fica visível como botão principal. Status é atualizado de
/// forma otimista; router.refresh() ressincroniza em segundo plano (stats,
/// filtros etc. dependem do servidor).
export function OfferCard({ offer, hotDiscount, presells = [], selected, onToggleSelect, className }: OfferCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState(offer.status);
  const [isPending, startTransition] = useTransition();
  const [blocked, setBlocked] = useState(offer.product.blocked);

  const changeStatus = (next: OfferStatus) => {
    const previous = status;
    setStatus(next);
    startTransition(async () => {
      try {
        await setOfferStatus(offer.id, next);
        toast.success(next === OfferStatus.PUBLISHED ? "Oferta marcada como publicada" : "Oferta ignorada");
        router.refresh();
      } catch (err) {
        setStatus(previous);
        toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a oferta");
      }
    });
  };

  const handleBlock = () => {
    const previous = blocked;
    setBlocked(true);
    startTransition(async () => {
      try {
        await blockProductFromOffer(offer.product.id);
        toast.success("Produto bloqueado");
        router.refresh();
      } catch (err) {
        setBlocked(previous);
        toast.error(err instanceof Error ? err.message : "Não foi possível bloquear o produto");
      }
    });
  };

  const isDecided = status !== OfferStatus.NEW;
  const isHot = offer.discountPct >= hotDiscount;

  return (
    <Card
      className={cn("group relative flex flex-col gap-0 overflow-hidden p-0", isDecided && "opacity-70", className)}
    >
      {/* Imagem: 16:10 em vez de 4:3, pra caber mais card por linha sem que a
          foto deixe de ser reconhecível. */}
      <div className="relative aspect-[16/10] w-full shrink-0 bg-neutral-100">
        <Link href={offer.product.permalink} target="_blank" rel="noreferrer" className="absolute inset-0">
          <ProductThumb
            src={offer.product.thumbnail}
            alt={offer.product.title}
            sizes="(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            imageClassName="p-2.5"
          />
        </Link>

        {onToggleSelect && (
          <div
            className={cn(
              "absolute top-2 left-2 z-10 transition-opacity",
              selected ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
            )}
          >
            <Checkbox
              checked={!!selected}
              onCheckedChange={() => onToggleSelect(offer.id)}
              className="bg-background shadow-sm"
              aria-label="Selecionar oferta"
            />
          </div>
        )}

        <div className="absolute top-1.5 right-1.5 z-10 flex flex-col items-end gap-1">
          {offer.discountPct > 0 && (
            <Badge
              variant={isHot ? "destructive" : "secondary"}
              className={cn("px-1.5 py-0 text-xs tabular-nums shadow-sm", isHot && "font-semibold")}
            >
              -{offer.discountPct}%
            </Badge>
          )}
          {isDecided && (
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full bg-background/95 shadow-sm ring-1 ring-border",
                status === OfferStatus.PUBLISHED ? "text-success" : "text-muted-foreground",
              )}
              title={status === OfferStatus.PUBLISHED ? "Publicada" : "Ignorada"}
            >
              <HugeiconsIcon
                icon={status === OfferStatus.PUBLISHED ? CheckmarkCircle02Icon : Cancel01Icon}
                size={12}
                strokeWidth={1.5}
              />
            </span>
          )}
        </div>
      </div>

      {/* Conteúdo: só o essencial fica visível de cara */}
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <Link
          href={offer.product.permalink}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-[13px] leading-snug font-medium text-foreground hover:underline"
          title={offer.product.title}
        >
          {offer.product.title}
        </Link>

        <div className="mt-auto flex items-start justify-between gap-1">
          <PriceTag price={offer.price} referencePrice={offer.referencePrice} size="md" />
          <OfferDetailsPopover offer={offer} />
        </div>

        <div className="flex items-center gap-1">
          <CopyButton
            variant="default"
            size="sm"
            label="Copiar link"
            className="flex-1"
            getUrl={async () => {
              const link = await generateLink({ productId: offer.product.id, kind: LinkKind.TRACKED });
              return link.url;
            }}
          />
          <OfferActionsMenu
            productId={offer.product.id}
            productTitle={offer.product.title}
            presells={presells}
            status={status}
            blocked={blocked}
            isPending={isPending}
            onMarkPublished={() => changeStatus(OfferStatus.PUBLISHED)}
            onMarkIgnored={() => changeStatus(OfferStatus.IGNORED)}
            onBlock={handleBlock}
          />
        </div>
      </div>
    </Card>
  );
}
