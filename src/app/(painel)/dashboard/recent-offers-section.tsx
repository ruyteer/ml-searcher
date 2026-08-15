import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconOfertaVazia, IconSemImagem } from "@/components/icons";
import { Section } from "@/components/shell/section";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { offerStatusLabel } from "@/components/produto/offer-language";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { getOffers, type OfferFilters } from "@/lib/data/offers";

const RECENT_OFFERS_FILTERS: OfferFilters = {
  status: "ALL",
  minDiscount: 0,
  priceMin: null,
  priceMax: null,
  watchId: null,
  search: "",
  sort: "recent",
  page: 1,
  pageSize: 6,
};

/// Últimas ofertas detectadas pela varredura, independente de status — é o
/// "o que apareceu agora, o que já dá pra divulgar hoje".
export async function RecentOffersSection() {
  const { items } = await getOffers(RECENT_OFFERS_FILTERS);

  return (
    <Section
      title="Ofertas recentes"
      description="Últimas detectadas pela varredura."
      actions={
        <Link href="/ofertas" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Ver ofertas
        </Link>
      }
      className="h-full"
      contentClassName="flex flex-col gap-1 max-h-[320px] overflow-y-auto"
    >
      {items.length === 0 ? (
        <EmptyState
          icon={IconOfertaVazia}
          title="Nenhuma oferta detectada ainda"
          description="Rode uma varredura em Ofertas para começar a encontrar promoções."
          className="border-none py-10"
        />
      ) : (
        items.map((offer) => (
          <Link
            key={offer.id}
            href="/ofertas"
            className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-muted/50"
          >
            {offer.product.thumbnail ? (
              <Image
                src={offer.product.thumbnail}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-md bg-muted object-cover"
              />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <HugeiconsIcon icon={IconSemImagem} size={14} strokeWidth={1.6} className="text-muted-foreground" aria-hidden="true" />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="line-clamp-1 text-sm text-foreground">{offer.product.title}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(offer.detectedAt)}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant="secondary" className="text-primary">
                -{offer.discountPct}%
              </Badge>
              <span className="text-[10px] text-muted-foreground">{offerStatusLabel(offer.status)}</span>
            </span>
          </Link>
        ))
      )}
    </Section>
  );
}
