"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { IconInfo } from "@/components/icons";
import { ProductThumb } from "./product-thumb";
import { PriceComparison } from "./price-comparison";
import { CopyButton } from "./copy-button";
import { OfferDetailsPopover } from "./offer-details-popover";
import { OfferActionsMenu } from "./offer-actions-menu";
import { offerStatusLabel, referenceCopy } from "./offer-language";
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

/// Card de oferta usado em /ofertas. O card responde de cara as três perguntas
/// do usuário: quanto custava, quanto custa agora e POR QUE isto virou oferta
/// (a frase de referenceKind, em português, nunca o código do banco). Nota de
/// oportunidade, vendedor, frete grátis e o mini gráfico ficam no popover de
/// detalhes (ícone "i"); o histórico completo fica no menu dos três pontos.
/// Status é atualizado de forma otimista; router.refresh() ressincroniza em
/// segundo plano (contadores, filtros etc. dependem do servidor).
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
  const reason = referenceCopy(offer.referenceKind);

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

        {/* Só a situação fica sobre a imagem. O desconto aparece uma vez só,
            junto do bloco de preço, onde tem o "antes" ao lado pra dar sentido
            ao número. Repetir "-63%" duas vezes no mesmo card era ruído. */}
        <div className="absolute top-1.5 right-1.5 z-10 flex flex-col items-end gap-1">
          {isDecided && (
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full bg-background/95 shadow-sm ring-1 ring-border",
                status === OfferStatus.PUBLISHED ? "text-success" : "text-muted-foreground",
              )}
              title={offerStatusLabel(status)}
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
          <PriceComparison
            price={offer.price}
            referencePrice={offer.referencePrice}
            referenceKind={offer.referenceKind}
            discountPct={offer.discountPct}
            hotDiscount={hotDiscount}
            size="md"
          />
          <OfferDetailsPopover offer={offer} />
        </div>

        {/* Por que este produto saiu de "produtos" e apareceu aqui. */}
        <p className="flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
          <HugeiconsIcon
            icon={IconInfo}
            size={12}
            strokeWidth={1.5}
            className="mt-px shrink-0"
            aria-hidden="true"
          />
          <span>{reason.line}.</span>
        </p>

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
