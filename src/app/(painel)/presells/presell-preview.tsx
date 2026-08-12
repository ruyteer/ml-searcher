"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { IconSemImagem } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import {
  resolvePresell,
  presellSteps,
  examplePresellVars,
  type PresellProduct,
  type PresellTemplate,
} from "./presell-template";

export interface PresellPreviewProps {
  /// Os campos do modelo como estão no formulário, sem nada resolvido.
  template: PresellTemplate;
  /// Produtos reais do banco, para ver o modelo funcionando de verdade.
  products: PresellProduct[];
  /// Produto escolhido no momento. Null = mostrar com dados de exemplo.
  productId: string | null;
  onProductChange: (id: string | null) => void;
  /// Só importa para o uso avulso (abrir o endereço do modelo sem produto).
  hasExitLink: boolean;
}

const NO_PRODUCT = "__exemplo__";

/// Espelha visualmente src/app/p/[slug]/page.tsx usando exatamente o mesmo
/// motor de conteúdo, então o que aparece aqui é o que o visitante vê. A
/// moldura simula uma tela de celular estreita (~380px).
export function PresellPreview({
  template,
  products,
  productId,
  onProductChange,
  hasExitLink,
}: PresellPreviewProps) {
  const product = products.find((p) => p.id === productId) ?? null;
  const content = resolvePresell(template, product, product ? undefined : examplePresellVars());
  const steps = presellSteps(content);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">
          Veja como fica com um produto de verdade
        </span>
        <Select
          value={productId ?? NO_PRODUCT}
          onValueChange={(v) => onProductChange(!v || v === NO_PRODUCT ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Escolha um produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PRODUCT}>Sem produto (dados de exemplo)</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[2rem] border-4 border-border bg-background shadow-xl">
        <div className="flex h-8 items-center justify-center bg-border/40">
          <div className="h-1.5 w-16 rounded-full bg-border" />
        </div>

        <main className="flex max-h-[640px] flex-col gap-6 overflow-y-auto px-4 py-6">
          <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted">
            {content.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview de host arbitrário
              <img
                src={content.imageUrl}
                alt={content.headline}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <HugeiconsIcon icon={IconSemImagem} size={32} strokeWidth={1.5} aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl leading-tight font-bold text-balance">
              {content.headline || "A chamada aparece aqui"}
            </h1>
          </div>

          {content.priceCents != null && (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                {content.originalCents != null && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatBRL(content.originalCents)}
                  </span>
                )}
                {content.discount > 0 && <Badge variant="destructive">-{content.discount}%</Badge>}
              </div>
              <span className="text-3xl font-extrabold text-foreground">
                {formatBRL(content.priceCents)}
              </span>
            </div>
          )}

          {content.body && (
            <p className="text-base leading-relaxed whitespace-pre-line text-foreground/90">
              {content.body}
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

          {!product && !hasExitLink && (
            <p className="rounded-lg bg-muted p-3 text-center text-xs text-muted-foreground">
              Assim que você gerar um link para um produto, o botão abaixo leva direto à oferta.
            </p>
          )}

          {content.gateUrl ? (
            <div className="flex flex-col gap-3">
              <span className={cn(buttonVariants(), "h-12 w-full text-base font-semibold")}>
                {content.gateLabel}
              </span>
              <span
                className={cn(
                  buttonVariants(),
                  "h-12 w-full cursor-not-allowed text-base font-semibold opacity-50",
                )}
              >
                {content.ctaText}
              </span>
            </div>
          ) : (
            <span className={cn(buttonVariants(), "h-12 w-full text-base font-semibold")}>
              {content.ctaText}
            </span>
          )}
        </main>
      </div>
    </div>
  );
}
