import { ChartCard, ClicksAreaChart } from "@/components/charts";
import { getDailyClicks, type Period } from "@/lib/data/metrics";

export async function ClicksChartSection({ period }: { period: Period }) {
  const data = await getDailyClicks(period);
  const isEmpty = data.every((d) => d.total === 0);

  return (
    <ChartCard
      title="Cliques por dia"
      description="Total de cliques vs. cliques únicos no período."
      isEmpty={isEmpty}
      emptyMessage="Nenhum clique registrado neste período"
      height={320}
    >
      <ClicksAreaChart data={data} />
    </ChartCard>
  );
}
