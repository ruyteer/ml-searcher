"use client";

import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBRL, discountPct } from "@/lib/format";

export interface PresellPreviewData {
  title: string;
  headline: string;
  body: string;
  ctaText: string;
  imageUrl: string;
  priceLabelCents: number | null;
  originalLabelCents: number | null;
  gateUrl: string;
  gateLabel: string;
  gateDelay: number;
  hasExitLink: boolean;
}

/// Espelha visualmente src/app/p/[slug]/page.tsx — a moldura simula uma tela
/// de celular estreita (~380px) e atualiza a cada tecla digitada no formulário.
export function PresellPreview({ data }: { data: PresellPreviewData }) {
  const hasPrice = data.priceLabelCents != null;
  const hasDiscount =
    data.priceLabelCents != null &&
    data.originalLabelCents != null &&
    data.originalLabelCents > data.priceLabelCents;
  const discount = hasDiscount
    ? discountPct(data.priceLabelCents as number, data.originalLabelCents as number)
    : 0;

  const hasGate = Boolean(data.gateUrl.trim());
  const steps = hasGate
    ? [
        `Toque em "${data.gateLabel || "Acessar link do patrocinador"}" para acessar o parceiro.`,
        "Aguarde alguns segundos — é rapidinho.",
        `Toque em "${data.ctaText || "Liberar oferta"}" para ver a oferta no Mercado Livre.`,
      ]
    : [
        `Toque em "${data.ctaText || "Liberar oferta"}" abaixo.`,
        "Você será levado direto para a oferta no Mercado Livre.",
      ];

  return (
    <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[2rem] border-4 border-border bg-background shadow-xl">
      <div className="flex h-8 items-center justify-center bg-border/40">
        <div className="h-1.5 w-16 rounded-full bg-border" />
      </div>

      <main className="flex max-h-[640px] flex-col gap-6 overflow-y-auto px-4 py-6">
        <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted">
          {data.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview de host arbitrário
            <img src={data.imageUrl} alt={data.title} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-8" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl leading-tight font-bold text-balance">
            {data.headline || "Sua headline aparece aqui"}
          </h1>
        </div>

        {hasPrice && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              {data.originalLabelCents != null && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatBRL(data.originalLabelCents)}
                </span>
              )}
              {hasDiscount && <Badge variant="destructive">-{discount}%</Badge>}
            </div>
            <span className="text-3xl font-extrabold text-foreground">
              {formatBRL(data.priceLabelCents as number)}
            </span>
          </div>
        )}

        {data.body && (
          <p className="text-base leading-relaxed whitespace-pre-line text-foreground/90">
            {data.body}
          </p>
        )}

        <ol className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4 text-sm">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        {!data.hasExitLink && (
          <p className="rounded-lg bg-destructive/10 p-3 text-center text-xs text-destructive">
            Sem link associado — o botão final não vai aparecer na página publicada.
          </p>
        )}

        {hasGate ? (
          <div className="flex flex-col gap-3">
            <span
              className={cn(buttonVariants(), "h-12 w-full text-base font-semibold")}
            >
              {data.gateLabel || "Acessar link do patrocinador"}
            </span>
            <span
              className={cn(
                buttonVariants(),
                "h-12 w-full cursor-not-allowed text-base font-semibold opacity-50",
              )}
            >
              {data.ctaText || "Liberar oferta"}
            </span>
          </div>
        ) : (
          <span className={cn(buttonVariants(), "h-12 w-full text-base font-semibold")}>
            {data.ctaText || "Liberar oferta"}
          </span>
        )}
      </main>
    </div>
  );
}
