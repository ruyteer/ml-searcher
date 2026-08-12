import { IconLinks, IconCliques, IconCalendario, IconTrofeu } from "@/components/icons";
import { StatCard } from "@/components/shell/stat-card";
import { getLinkStats } from "@/lib/data/links";
import { formatCompact } from "@/lib/format";

export async function LinkStats() {
  const stats = await getLinkStats();

  const topLabel = stats.topLink
    ? (stats.topLink.productTitle ?? stats.topLink.label ?? stats.topLink.slug)
    : "-";

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Total de links" value={formatCompact(stats.totalLinks)} icon={IconLinks} />
      <StatCard
        label="Cliques totais"
        value={formatCompact(stats.totalClicks)}
        icon={IconCliques}
      />
      <StatCard label="Cliques hoje" value={formatCompact(stats.clicksToday)} icon={IconCalendario} />
      <StatCard
        label="Link campeão"
        value={
          <span className="line-clamp-1 text-lg" title={topLabel}>
            {topLabel}
          </span>
        }
        deltaLabel={stats.topLink ? `${formatCompact(stats.topLink.clickCount)} cliques` : undefined}
        icon={IconTrofeu}
      />
    </div>
  );
}
