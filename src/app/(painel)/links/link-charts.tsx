"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DailyPoint {
  day: string;
  count: number;
}

/// Gráfico de cliques por dia (últimos 30 dias). Cores vêm das CSS vars do
/// tema para acompanhar automaticamente o dark mode.
export function DailyClicksChart({ data }: { data: DailyPoint[] }) {
  const chartData = data.map((d) => ({
    label: new Date(d.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="clicksFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={Math.ceil(chartData.length / 8)}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          labelFormatter={(v) => `Dia ${v}`}
          formatter={(value) => [value, "Cliques"]}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#clicksFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface DevicePoint {
  device: string;
  count: number;
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
  bot: "Bot",
  desconhecido: "Desconhecido",
};

/// Mesma paleta categórica do donut de dispositivos do dashboard, pra manter
/// a identidade visual do aparelho consistente entre as duas telas.
const DEVICE_COLOR: Record<string, string> = {
  mobile: "var(--chart-1)",
  desktop: "var(--chart-2)",
  tablet: "var(--chart-3)",
  bot: "var(--chart-4)",
  desconhecido: "var(--chart-5)",
};

export function DeviceBreakdownChart({ data }: { data: DevicePoint[] }) {
  const chartData = data.map((d) => ({
    device: d.device,
    label: DEVICE_LABELS[d.device] ?? d.device,
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={chartData} layout="vertical" margin={{ left: -8 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={16}>
          {chartData.map((entry) => (
            <Cell key={entry.device} fill={DEVICE_COLOR[entry.device] ?? "var(--chart-5)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
