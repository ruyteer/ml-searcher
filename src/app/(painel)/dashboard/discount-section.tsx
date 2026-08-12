import { ChartCard, DiscountBars } from "@/components/charts";
import { getDiscountDistribution, type Period } from "@/lib/data/metrics";

export async function DiscountSection({ period }: { period: Period }) {
  const data = await getDiscountDistribution(period);
  const isEmpty = data.every((d) => d.count === 0);

  return (
    <ChartCard
      title="Distribuição de desconto"
      description="Ofertas do período por faixa de desconto."
      isEmpty={isEmpty}
      emptyMessage="Nenhuma oferta neste período"
      height={220}
    >
      <DiscountBars data={data} />
    </ChartCard>
  );
}
