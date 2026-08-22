"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { IconEstoque } from "@/components/icons";
import { ProductThumb } from "./product-thumb";
import { PriceComparison } from "./price-comparison";
import { CopyButton } from "./copy-button";
import { OfferSourceBadge } from "./offer-source-badge";
import { OfferActionsMenu } from "./offer-actions-menu";
import { offerStatusLabel, opportunityCopy } from "./offer-language";
import type { PresellOption } from "./generate-link-menu";
import { OfferStatus, LinkKind } from "@/lib/enums";
import type { OfferListItem } from "@/lib/data/offers";
import { setOfferStatus, blockProductFromOffer, generateLink } from "@/app/(painel)/ofertas/actions";
import { cn } from "@/lib/utils";

export interface OfferCardProps {
  offer: OfferListItem;
  hotDiscount: number;
  presells?: PresellOption[];
  /// Existe instância do WhatsApp conectada com grupo habilitado? Controla
  /// se "Enviar mensagem" aparece habilitado no menu de ações.
  canSendWhatsapp: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  className?: string;
}

/// Card de oferta usado em /ofertas. Responde de cara as perguntas do
/// usuário: quanto custava, quanto custa agora e (pelo selo sobre a imagem,
/// com tooltip que funciona no toque) POR QUE isto virou oferta. Nota de
/// oportunidade e frete grátis ficam como uma linha compacta no card;
/// vendedor e o gráfico completo de histórico ficam no menu dos três pontos
/// ("Ver histórico de preço"), que já cobre o que o mini gráfico mostrava.
/// Status é atualizado de forma otimista; router.refresh() ressincroniza em
/// segundo plano (contadores, filtros etc. dependem do servidor).
export function OfferCard({
  offer,
  hotDiscount,
  presells = [],
  canSendWhatsapp,
  selected,
  onToggleSelect,
  className,
}: OfferCardProps) {
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
  const opportunity = opportunityCopy(offer.score);

  return (
    <Card
      className={cn(
        // No celular o card é uma linha (foto à esquerda, texto e ações à
        // direita): cabem várias ofertas na tela e o botão de copiar fica
        // sempre na altura do polegar. Do sm pra cima volta a ser o card
        // vertical de sempre.
        "group relative flex flex-row gap-0 overflow-hidden p-0 sm:flex-col",
        isDecided && "opacity-70",
        className,
      )}
    >
      {/* Imagem: quadrada e estreita no celular, 16:10 no desktop (cabe mais
          card por linha sem que a foto deixe de ser reconhecível). */}
      <div className="relative w-28 shrink-0 self-stretch bg-neutral-100 sm:aspect-[16/10] sm:w-full sm:self-auto">
        <Link href={offer.product.permalink} target="_blank" rel="noreferrer" className="absolute inset-0">
          <ProductThumb
            src={offer.product.thumbnail}
            alt={offer.product.title}
            sizes="(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 112px"
            imageClassName="p-2.5"
          />
        </Link>

        {onToggleSelect && (
          // No celular não existe hover: a caixa de seleção fica sempre
          // visível. No desktop ela continua aparecendo no hover/foco (ou
          // fixa, quando o card já está selecionado).
          <div
            className={cn(
              "absolute top-1.5 left-1.5 z-10 transition-opacity",
              selected
                ? "opacity-100"
                : "opacity-100 sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100",
            )}
          >
            <Checkbox
              checked={!!selected}
              onCheckedChange={() => onToggleSelect(offer.id)}
              className="size-5 bg-background shadow-sm sm:size-4"
              aria-label="Selecionar oferta"
            />
          </div>
        )}

        {/* Selo de origem da oferta + situação (quando decidida) ficam sobre
            a imagem. O desconto em si aparece uma vez só, junto do bloco de
            preço, onde tem o "antes" ao lado pra dar sentido ao número.
            Repetir "-63%" duas vezes no mesmo card era ruído. */}
        <div className="absolute top-1.5 right-1.5 z-10 flex flex-col items-end gap-1">
          <OfferSourceBadge referenceKind={offer.referenceKind} />
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
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
        <Link
          href={offer.product.permalink}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-[13px] leading-snug font-medium text-foreground hover:underline"
          title={offer.product.title}
        >
          {offer.product.title}
        </Link>

        <PriceComparison
          price={offer.price}
          referencePrice={offer.referencePrice}
          discountPct={offer.discountPct}
          hotDiscount={hotDiscount}
          size="md"
          className="mt-auto"
        />

        {/* Sinais rápidos de decisão: nota de oportunidade (score, em
            português) e frete grátis. Vendedor e o gráfico completo ficam no
            menu dos três pontos, em "Ver histórico de preço". */}
        <div className="flex items-center gap-2 text-[11px] leading-snug text-muted-foreground">
          <span className={cn("font-medium", opportunity.tone)}>
            Oportunidade {opportunity.label.toLowerCase()} ({offer.score} de 100)
          </span>
          {offer.product.freeShipping && (
            <span className="inline-flex items-center gap-1 text-success">
              <HugeiconsIcon icon={IconEstoque} size={12} strokeWidth={1.5} aria-hidden="true" />
              Frete grátis
            </span>
          )}
        </div>

        {/* Ação principal (copiar o link pra colar no grupo) com alvo de
            toque de 44px no celular; no desktop volta ao tamanho compacto. */}
        <div className="flex items-center gap-1.5">
          <CopyButton
            variant="default"
            size="default"
            label="Copiar link"
            className="h-11 flex-1 sm:h-8"
            getUrl={async () => {
              const link = await generateLink({ productId: offer.product.id, kind: LinkKind.TRACKED });
              return link.url;
            }}
          />
          <OfferActionsMenu
            className="size-11 sm:size-7"
            offerId={offer.id}
            productId={offer.product.id}
            productTitle={offer.product.title}
            presells={presells}
            status={status}
            blocked={blocked}
            isPending={isPending}
            canSendWhatsapp={canSendWhatsapp}
            onMarkPublished={() => changeStatus(OfferStatus.PUBLISHED)}
            onMarkIgnored={() => changeStatus(OfferStatus.IGNORED)}
            onBlock={handleBlock}
          />
        </div>
      </div>
    </Card>
  );
}
