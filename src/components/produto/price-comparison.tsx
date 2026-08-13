import { formatBRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PriceComparisonProps {
  /// Preço de agora, em centavos.
  price: number;
  /// Preço com que a oferta foi comparada, em centavos.
  referencePrice: number;
  discountPct: number;
  /// A partir daqui o desconto vira destaque forte (settings.hotDiscount).
  hotDiscount?: number;
  size?: "sm" | "md";
  className?: string;
}

/// Bloco "antes x agora" do card de oferta. O preço riscado (menor, cinza) e
/// o preço em destaque (maior, forte) já dizem sozinhos qual é qual: é a
/// convenção que todo site de oferta usa, não precisa de rótulo "Preço
/// cheio" / "Agora" escrito em cima. De onde veio a comparação (de/por do
/// Mercado Livre, média de 30 dias, menor preço já visto) virou o selo
/// OfferSourceBadge, sobre a imagem do card.
export function PriceComparison({
  price,
  referencePrice,
  discountPct,
  hotDiscount,
  size = "md",
  className,
}: PriceComparisonProps) {
  const hasReference = referencePrice > price;
  const isHot = typeof hotDiscount === "number" && discountPct >= hotDiscount;

  const nowSize = size === "sm" ? "text-base" : "text-lg";
  const savings = hasReference ? referencePrice - price : 0;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-end gap-3">
        {hasReference && (
          <span className="text-sm leading-tight tabular-nums text-muted-foreground line-through">
            {formatBRL(referencePrice)}
          </span>
        )}

        <span className={cn("leading-tight font-semibold tabular-nums text-foreground", nowSize)}>
          {formatBRL(price)}
        </span>

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
