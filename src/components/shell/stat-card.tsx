import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IconDescendo, IconSubindo, type AppIcon } from "@/components/icons";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: AppIcon;
  /// Variação percentual (ex.: 12.4 ou -3.1). Positivo = verde com seta pra
  /// cima, negativo = vermelho com seta pra baixo.
  delta?: number;
  deltaLabel?: string;
  loading?: boolean;
  className?: string;
}

/// Card de métrica usado nos dashboards (cliques, ofertas, produtos etc.).
export function StatCard({
  label,
  value,
  icon,
  delta,
  deltaLabel,
  loading,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <Card className={cn(className)}>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            {icon && <Skeleton className="size-8 rounded-lg" />}
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  const isPositive = typeof delta === "number" && delta > 0;
  const isNegative = typeof delta === "number" && delta < 0;

  return (
    <Card className={cn(className)}>
      <CardContent className="flex flex-col gap-1.5 sm:gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[0.8125rem] text-muted-foreground sm:text-sm">
            {label}
          </span>
          {icon && (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground sm:size-8">
              <HugeiconsIcon icon={icon} size={16} strokeWidth={1.6} aria-hidden="true" />
            </div>
          )}
        </div>
        {/* Número grande usa a fonte de display e dígito de largura fixa */}
        <span
          className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
          data-numeric
        >
          {value}
        </span>
        {typeof delta === "number" && (
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                isPositive && "text-success",
                isNegative && "text-danger",
                !isPositive && !isNegative && "text-muted-foreground"
              )}
              data-numeric
            >
              {isPositive && (
                <HugeiconsIcon
                  icon={IconSubindo}
                  size={12}
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              )}
              {isNegative && (
                <HugeiconsIcon
                  icon={IconDescendo}
                  size={12}
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              )}
              {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>
            {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
