"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, Loader2, Star, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProductThumb } from "./product-thumb";
import { PriceTag } from "./price-tag";
import { PriceSparkline } from "./price-sparkline";
import { GenerateLinkMenu, type PresellOption } from "./generate-link-menu";
import { CopyButton } from "./copy-button";
import { OfferStatus, LinkKind } from "@/generated/prisma";
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

const REFERENCE_LABEL: Record<string, string> = {
  ML_ORIGINAL: "De/por do ML",
  HISTORY_AVG: "Abaixo da média",
  HISTORY_MIN: "Menor preço já visto",
};

/// Card de oferta usado em /ofertas: imagem, preço, badges, sparkline e as
/// ações (gerar link, copiar, publicar, ignorar, bloquear). Status é
/// atualizado de forma otimista; router.refresh() ressincroniza em segundo
/// plano (stats, filtros, etc. dependem do servidor).
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

  return (
    <Card className={cn("relative flex flex-col gap-3 p-3", isDecided && "opacity-70", className)}>
      {onToggleSelect && (
        <Checkbox
          checked={!!selected}
          onCheckedChange={() => onToggleSelect(offer.id)}
          className="absolute top-3 left-3 z-10 bg-background"
          aria-label="Selecionar oferta"
        />
      )}

      <div className={cn("flex gap-3", onToggleSelect && "pl-6")}>
        <Link href={offer.product.permalink} target="_blank" rel="noreferrer">
          <ProductThumb src={offer.product.thumbnail} alt={offer.product.title} size={72} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link
            href={offer.product.permalink}
            target="_blank"
            rel="noreferrer"
            className="line-clamp-2 text-sm font-medium text-foreground hover:underline"
            title={offer.product.title}
          >
            {offer.product.title}
          </Link>
          <PriceTag
            price={offer.price}
            referencePrice={offer.referencePrice}
            discountPct={offer.discountPct}
            hotDiscount={hotDiscount}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{REFERENCE_LABEL[offer.referenceKind] ?? offer.referenceKind}</Badge>
        <Badge variant="secondary" className="gap-1">
          <Star className="size-3" /> {offer.score}
        </Badge>
        {offer.product.freeShipping && (
          <Badge variant="secondary" className="gap-1">
            <Truck className="size-3" /> Frete grátis
          </Badge>
        )}
        {blocked && <Badge variant="destructive">Bloqueado</Badge>}
        {status !== OfferStatus.NEW && (
          <Badge variant={status === OfferStatus.PUBLISHED ? "default" : "outline"}>
            {status === OfferStatus.PUBLISHED ? "Publicada" : "Ignorada"}
          </Badge>
        )}
      </div>

      {offer.product.sellerName && (
        <p className="truncate text-xs text-muted-foreground">Vendedor: {offer.product.sellerName}</p>
      )}

      <PriceSparkline data={offer.history} />

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
        <GenerateLinkMenu productId={offer.product.id} presells={presells} size="xs" />
        <CopyButton
          size="xs"
          getUrl={async () => {
            const link = await generateLink({ productId: offer.product.id, kind: LinkKind.TRACKED });
            return link.url;
          }}
        />
        <Button
          variant="outline"
          size="xs"
          disabled={isPending || status === OfferStatus.PUBLISHED}
          onClick={() => changeStatus(OfferStatus.PUBLISHED)}
        >
          {isPending ? <Loader2 className="animate-spin" /> : <Check />}
          Publicada
        </Button>
        <Button
          variant="outline"
          size="xs"
          disabled={isPending || status === OfferStatus.IGNORED}
          onClick={() => changeStatus(OfferStatus.IGNORED)}
        >
          <X /> Ignorar
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" size="xs" disabled={isPending || blocked} className="ml-auto">
                <Ban /> Bloquear
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bloquear produto?</AlertDialogTitle>
              <AlertDialogDescription>
                {offer.product.title} deixa de gerar novas ofertas e as ofertas pendentes dele são ignoradas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleBlock}>
                Bloquear
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}
