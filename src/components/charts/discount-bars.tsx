"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact } from "@/lib/format";

export interface DiscountBarsPoint {
  range: string;
  count: number;
}

export interface DiscountBarsProps {
  data: DiscountBarsPoint[];
}

/// Magnitude ordinal (faixas de desconto crescentes) -> uma hue só, em
/// degradê de opacidade — não uma cor por barra.
const OPACITY_STEPS = [0.45, 0.6, 0.8, 1];

function DiscountTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-0.5 font-medium">{label}</p>
      <p className="text-muted-foreground">
        <span className="font-medium tabular-nums text-popover-foreground">
          {formatCompact(payload[0].value ?? 0)}
        </span>{" "}
        ofertas
      </p>
    </div>
  );
}

/// Barras da distribuição de ofertas por faixa de desconto.
export function DiscountBars({ data }: DiscountBarsProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="range"
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tickFormatter={(v: number) => formatCompact(v)}
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip content={<DiscountTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
          {data.map((entry, i) => (
            <Cell
              key={entry.range}
              fill="var(--chart-1)"
              fillOpacity={OPACITY_STEPS[i] ?? 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
