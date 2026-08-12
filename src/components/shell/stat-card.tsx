import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
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
  icon: Icon,
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
            {Icon && <Skeleton className="size-8 rounded-lg" />}
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
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          {Icon && (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
          )}
        </div>
        <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
        {typeof delta === "number" && (
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                isPositive && "text-success",
                isNegative && "text-danger",
                !isPositive && !isNegative && "text-muted-foreground"
              )}
            >
              {isPositive && <ArrowUp className="size-3" />}
              {isNegative && <ArrowDown className="size-3" />}
              {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>
            {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
