import { IconLinks, IconCliques, IconProdutos, IconDesconto, IconOfertas, IconUsuarios } from "@/components/icons";
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
        icon={IconCliques}
        delta={kpis.clicks.delta}
        deltaLabel="período anterior"
      />
      <StatCard
        label="Cliques únicos"
        value={formatCompact(kpis.uniqueClicks.value)}
        icon={IconUsuarios}
        delta={kpis.uniqueClicks.delta}
        deltaLabel="período anterior"
      />
      <StatCard
        label="Ofertas detectadas"
        value={formatCompact(kpis.offersDetected.value)}
        icon={IconOfertas}
        delta={kpis.offersDetected.delta}
        deltaLabel="período anterior"
      />
      <StatCard label="Produtos monitorados" value={formatCompact(kpis.productsMonitored)} icon={IconProdutos} />
      <StatCard label="Links ativos" value={formatCompact(kpis.activeLinks)} icon={IconLinks} />
      <StatCard
        label="Cliques por link"
        value={kpis.clickThroughRate.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
        icon={IconDesconto}
        delta={kpis.clickThroughRate.delta}
        deltaLabel="período anterior"
      />
    </div>
  );
}
