import { ChartCard, DeviceDonut } from "@/components/charts";
import { getDeviceDistribution, type Period } from "@/lib/data/metrics";

export async function DeviceSection({ period }: { period: Period }) {
  const data = await getDeviceDistribution(period);

  return (
    <ChartCard
      title="Dispositivos"
      description="Cliques por tipo de dispositivo."
      isEmpty={data.length === 0}
      emptyMessage="Sem cliques neste período"
      height={220}
    >
      <DeviceDonut data={data} />
    </ChartCard>
  );
}
