"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact } from "@/lib/format";

export interface ClicksAreaChartPoint {
  date: string;
  total: number;
  unique: number;
}

export interface ClicksAreaChartProps {
  data: ClicksAreaChartPoint[];
}

/// "YYYY-MM-DD" -> Date local (evita o salto de dia do parser UTC do Date()).
function parseDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const axisFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const tooltipFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" });

const SERIES_LABEL: Record<string, string> = {
  total: "Total",
  unique: "Únicos",
};

function ClicksTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium capitalize">{tooltipFormatter.format(parseDay(label))}</p>
      <div className="flex flex-col gap-0.5">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{SERIES_LABEL[String(entry.dataKey)] ?? entry.dataKey}</span>
            <span className="ml-auto font-medium tabular-nums text-popover-foreground">
              {formatCompact(entry.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/// Área de cliques por dia (total vs. únicos), tema escuro, tooltip e eixo em pt-BR.
export function ClicksAreaChart({ data }: ClicksAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="clicksTotalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="clicksUniqueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => axisFormatter.format(parseDay(v))}
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tickFormatter={(v: number) => formatCompact(v)}
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<ClicksTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
        <Legend
          verticalAlign="top"
          height={28}
          align="right"
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span className="text-xs text-muted-foreground">{SERIES_LABEL[value] ?? value}</span>
          )}
        />
        <Area
          type="monotone"
          dataKey="total"
          name="total"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#clicksTotalFill)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="unique"
          name="unique"
          stroke="var(--chart-2)"
          strokeWidth={2}
          fill="url(#clicksUniqueFill)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
