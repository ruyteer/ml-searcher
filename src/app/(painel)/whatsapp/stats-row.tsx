import { IconOfertas, IconWhatsapp, IconCalendario, IconAlerta } from "@/components/icons";
import { StatCard } from "@/components/shell/stat-card";
import { formatCompact } from "@/lib/format";
import type { WhatsappOverview } from "@/lib/data/whatsapp";

export function StatsRow({ stats, schedule }: Pick<WhatsappOverview, "stats" | "schedule">) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Ofertas aguardando envio" value={formatCompact(stats.pendingOffers)} icon={IconOfertas} />
      <StatCard label="Enviadas hoje" value={formatCompact(stats.sentToday)} icon={IconCalendario} />
      <StatCard label="Enviadas ao todo" value={formatCompact(stats.sentTotal)} icon={IconWhatsapp} />
      <StatCard
        label="Falhas nas últimas 24h"
        value={formatCompact(stats.failedRecent)}
        icon={IconAlerta}
        deltaLabel={schedule.enabled ? `a cada ${schedule.intervalMinutes}min` : "envio desligado"}
      />
    </div>
  );
}
