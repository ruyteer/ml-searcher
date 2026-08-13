"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconOfertas, IconGrafico, IconTrofeu, type AppIcon } from "@/components/icons";
import { referenceCopy } from "./offer-language";
import { cn } from "@/lib/utils";

export interface OfferSourceBadgeProps {
  /// ML_ORIGINAL | HISTORY_AVG | HISTORY_MIN, cru do banco. Vira texto só
  /// via referenceCopy(), nunca aparece cru na tela.
  referenceKind: string;
  className?: string;
}

interface SourceBadgeStyle {
  icon: AppIcon;
  classes: string;
}

/// Ícone e cor diferentes por origem, pra dar pra distinguir sem depender só
/// de matiz (quem não enxerga cor ainda lê a forma do ícone). Amarelo +
/// etiqueta pro selo do próprio Mercado Livre (a cor institucional deles
/// casa com a primária do painel); cinza neutro + gráfico pra "comparamos
/// com a média que nós calculamos"; verde + troféu pro menor preço já
/// visto (mesma cor que o marcador "menor preço do período" usa no
/// histórico de preço).
const SOURCE_BADGE_STYLE: Record<string, SourceBadgeStyle> = {
  ML_ORIGINAL: { icon: IconOfertas, classes: "bg-primary text-primary-foreground" },
  HISTORY_AVG: { icon: IconGrafico, classes: "bg-muted text-foreground ring-1 ring-border" },
  HISTORY_MIN: { icon: IconTrofeu, classes: "bg-success/15 text-success ring-1 ring-success/30" },
};

const SOURCE_BADGE_FALLBACK: SourceBadgeStyle = SOURCE_BADGE_STYLE.HISTORY_AVG;

/// Selo pequeno sobre a imagem do card de oferta. Substitui a frase que
/// costumava ficar escrita direto no card ("O próprio Mercado Livre marcou
/// de/por", ou a versão de quando fomos nós que detectamos comparando com o
/// histórico). O texto completo da explicação vira o conteúdo do popover.
///
/// Usa Popover, não Tooltip: abre no toque e no clique, não só no hover,
/// porque metade do uso do painel é no celular. Mesmo padrão do HelpTooltip
/// em app/(painel)/configuracoes/field.tsx — gatilho é um <button> nativo,
/// focável por teclado, com aria-label próprio.
export function OfferSourceBadge({ referenceKind, className }: OfferSourceBadgeProps) {
  const copy = referenceCopy(referenceKind);
  const style = SOURCE_BADGE_STYLE[referenceKind] ?? SOURCE_BADGE_FALLBACK;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Por que virou oferta: ${copy.badge}`}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          style.classes,
          className,
        )}
      >
        <HugeiconsIcon icon={style.icon} size={12} strokeWidth={1.8} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-64 gap-1 text-xs text-muted-foreground">
        <p className="text-sm font-medium text-foreground">{copy.badge}</p>
        <p className="leading-relaxed">{copy.full}</p>
      </PopoverContent>
    </Popover>
  );
}
