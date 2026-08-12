import { Link2, MousePointerClick, Package, Percent, Tag, Users } from "lucide-react";
import { StatCard } from "@/components/shell/stat-card";
import { formatCompact } from "@/lib/format";
import { getOverviewKpis, type Period } from "@/lib/data/metrics";

export async function KpiSection({ period }: { period: Period }) {
  const kpis = await getOverviewKpis(period);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Cliques"
        value={formatCompact(kpis.clicks.value)}
        icon={MousePointerClick}
        delta={kpis.clicks.delta}
        deltaLabel="período anterior"
      />
      <StatCard
        label="Cliques únicos"
        value={formatCompact(kpis.uniqueClicks.value)}
        icon={Users}
        delta={kpis.uniqueClicks.delta}
        deltaLabel="período anterior"
      />
      <StatCard
        label="Ofertas detectadas"
        value={formatCompact(kpis.offersDetected.value)}
        icon={Tag}
        delta={kpis.offersDetected.delta}
        deltaLabel="período anterior"
      />
      <StatCard label="Produtos monitorados" value={formatCompact(kpis.productsMonitored)} icon={Package} />
      <StatCard label="Links ativos" value={formatCompact(kpis.activeLinks)} icon={Link2} />
      <StatCard
        label="Cliques por link"
        value={kpis.clickThroughRate.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
        icon={Percent}
        delta={kpis.clickThroughRate.delta}
        deltaLabel="período anterior"
      />
    </div>
  );
}
