"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PriceSparklinePoint {
  price: number;
  capturedAt: string;
}

export interface PriceSparklineProps {
  data: PriceSparklinePoint[];
  height?: number;
  className?: string;
}

/// Mini gráfico de histórico de preço (últimos 30 dias) usado nos cards de
/// oferta. Sem eixos visíveis — só a forma da curva importa aqui.
export function PriceSparkline({ data, height = 40, className }: PriceSparklineProps) {
  if (data.length < 2) {
    return (
      <div className={cn("flex items-center text-xs text-muted-foreground", className)} style={{ height }}>
        Histórico insuficiente
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = Math.max(1, Math.round((max - min) * 0.15));

  return (
    <div className={cn(className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis domain={[min - pad, max + pad]} hide />
          <defs>
            <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            formatter={(value) => [formatBRL(Number(value)), "Preço"]}
            labelFormatter={() => ""}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="var(--color-chart-1)"
            strokeWidth={1.5}
            fill="url(#sparkline-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
