import { formatBRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PriceTagProps {
  /// Preço atual, em centavos.
  price: number;
  /// Preço de referência (riscado), em centavos. Omitido = sem desconto a mostrar.
  referencePrice?: number | null;
  discountPct?: number;
  /// A partir daqui o badge de desconto fica em destaque (settings.hotDiscount).
  hotDiscount?: number;
  size?: "sm" | "default";
  className?: string;
}

/// Preço atual em destaque + preço de referência riscado + badge de desconto.
/// O badge fica "quente" (destructive) quando o desconto bate hotDiscount.
export function PriceTag({
  price,
  referencePrice,
  discountPct,
  hotDiscount,
  size = "default",
  className,
}: PriceTagProps) {
  const hasReference = typeof referencePrice === "number" && referencePrice > price;
  const isHot = typeof discountPct === "number" && typeof hotDiscount === "number" && discountPct >= hotDiscount;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("font-semibold text-foreground", size === "sm" ? "text-sm" : "text-lg")}>
          {formatBRL(price)}
        </span>
        {typeof discountPct === "number" && discountPct > 0 && (
          <Badge variant={isHot ? "destructive" : "secondary"} className={cn(isHot && "font-semibold")}>
            -{discountPct}%
          </Badge>
        )}
      </div>
      {hasReference && (
        <span className="text-xs text-muted-foreground line-through">{formatBRL(referencePrice!)}</span>
      )}
    </div>
  );
}
