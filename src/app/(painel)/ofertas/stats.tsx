import { IconOfertas, IconDesconto, IconEmAlta, IconEstoque } from "@/components/icons";
import { StatCard } from "@/components/shell/stat-card";
import { getOfferStats } from "@/lib/data/offers";

/// Row de StatCards do topo — Server Component isolado num <Suspense> próprio
/// pra não travar o resto da página enquanto os agregados são calculados.
export async function OffersStats() {
  const stats = await getOfferStats();

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Ofertas novas hoje" value={stats.newToday.toLocaleString("pt-BR")} icon={IconOfertas} />
      <StatCard label="Desconto médio" value={`${stats.avgDiscount}%`} icon={IconDesconto} />
      <StatCard label="Melhor desconto" value={`${stats.bestDiscount}%`} icon={IconEmAlta} />
      <StatCard
        label="Total monitorado"
        value={stats.totalMonitored.toLocaleString("pt-BR")}
        icon={IconEstoque}
      />
    </div>
  );
}

export function OffersStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Ofertas novas hoje" value="" loading />
      <StatCard label="Desconto médio" value="" loading />
      <StatCard label="Melhor desconto" value="" loading />
      <StatCard label="Total monitorado" value="" loading />
    </div>
  );
}
