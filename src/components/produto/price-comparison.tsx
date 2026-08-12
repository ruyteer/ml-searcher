import { formatBRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { referenceCopy } from "./offer-language";

export interface PriceComparisonProps {
  /// Preço de agora, em centavos.
  price: number;
  /// Preço com que a oferta foi comparada, em centavos.
  referencePrice: number;
  /// ML_ORIGINAL | HISTORY_AVG | HISTORY_MIN. Só entra aqui como código: o
  /// texto exibido sai sempre de referenceCopy().
  referenceKind: string;
  discountPct: number;
  /// A partir daqui o desconto vira destaque forte (settings.hotDiscount).
  hotDiscount?: number;
  size?: "sm" | "md";
  className?: string;
}

/// Bloco "antes x agora" do card de oferta. Responde de cara a pergunta do
/// usuário: qual era o preço, qual é o preço, quanto caiu e com o que foi
/// comparado. O rótulo do valor antigo muda conforme a origem da comparação
/// ("Preço cheio", "Média de 30 dias", "Menor preço anterior"), pra ninguém
/// achar que o riscado é sempre o de/por do Mercado Livre.
export function PriceComparison({
  price,
  referencePrice,
  referenceKind,
  discountPct,
  hotDiscount,
  size = "md",
  className,
}: PriceComparisonProps) {
  const copy = referenceCopy(referenceKind);
  const hasReference = referencePrice > price;
  const isHot = typeof hotDiscount === "number" && discountPct >= hotDiscount;

  const nowSize = size === "sm" ? "text-base" : "text-lg";
  const savings = hasReference ? referencePrice - price : 0;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-end gap-3">
        {hasReference && (
          <div className="flex min-w-0 flex-col">
            <span className="text-[10px] leading-tight text-muted-foreground uppercase">{copy.beforeLabel}</span>
            <span className="text-sm leading-tight tabular-nums text-muted-foreground line-through">
              {formatBRL(referencePrice)}
            </span>
          </div>
        )}

        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] leading-tight text-muted-foreground uppercase">Agora</span>
          <span className={cn("leading-tight font-semibold tabular-nums text-foreground", nowSize)}>
            {formatBRL(price)}
          </span>
        </div>

        {discountPct > 0 && (
          <Badge
            variant={isHot ? "destructive" : "secondary"}
            className={cn("mb-0.5 shrink-0 tabular-nums", isHot && "font-semibold")}
          >
            -{discountPct}%
          </Badge>
        )}
      </div>

      {savings > 0 && (
        <span className="text-xs text-success">Você economiza {formatBRL(savings)}</span>
      )}
    </div>
  );
}
