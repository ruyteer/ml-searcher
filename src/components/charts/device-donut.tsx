"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCompact } from "@/lib/format";

export interface DeviceDonutPoint {
  device: string;
  count: number;
}

export interface DeviceDonutProps {
  data: DeviceDonutPoint[];
}

/// Cor fixa por dispositivo (identidade, não por posição/rank) — as mesmas
/// 5 cores de chart do tema, na ordem categórica do projeto.
const DEVICE_COLOR: Record<string, string> = {
  mobile: "var(--chart-1)",
  desktop: "var(--chart-2)",
  tablet: "var(--chart-3)",
  bot: "var(--chart-4)",
  unknown: "var(--chart-5)",
};

const DEVICE_LABEL: Record<string, string> = {
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
  bot: "Bot",
  unknown: "Desconhecido",
};

function DeviceTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const value = entry.value ?? 0;
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{DEVICE_LABEL[entry.name ?? ""] ?? entry.name}</p>
      <p className="text-muted-foreground">
        <span className="font-medium tabular-nums text-popover-foreground">{formatCompact(value)}</span> cliques ·{" "}
        {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      </p>
    </div>
  );
}

/// Donut de distribuição de cliques por dispositivo, cor fixa por tipo.
export function DeviceDonut({ data }: DeviceDonutProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="device"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={2}
          stroke="var(--card)"
        >
          {data.map((entry) => (
            <Cell key={entry.device} fill={DEVICE_COLOR[entry.device] ?? "var(--chart-5)"} />
          ))}
        </Pie>
        <Tooltip content={<DeviceTooltip total={total} />} />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span className="text-xs text-muted-foreground">{DEVICE_LABEL[value] ?? value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
