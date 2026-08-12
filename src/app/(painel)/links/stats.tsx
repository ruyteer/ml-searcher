import { Link2, MousePointerClick, CalendarClock, Trophy } from "lucide-react";
import { StatCard } from "@/components/shell/stat-card";
import { getLinkStats } from "@/lib/data/links";
import { formatCompact } from "@/lib/format";

export async function LinkStats() {
  const stats = await getLinkStats();

  const topLabel = stats.topLink
    ? (stats.topLink.productTitle ?? stats.topLink.label ?? stats.topLink.slug)
    : "—";

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Total de links" value={formatCompact(stats.totalLinks)} icon={Link2} />
      <StatCard
        label="Cliques totais"
        value={formatCompact(stats.totalClicks)}
        icon={MousePointerClick}
      />
      <StatCard label="Cliques hoje" value={formatCompact(stats.clicksToday)} icon={CalendarClock} />
      <StatCard
        label="Link campeão"
        value={
          <span className="line-clamp-1 text-lg" title={topLabel}>
            {topLabel}
          </span>
        }
        deltaLabel={stats.topLink ? `${formatCompact(stats.topLink.clickCount)} cliques` : undefined}
        icon={Trophy}
      />
    </div>
  );
}
