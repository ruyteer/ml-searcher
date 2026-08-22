import { IconOfertas, IconWhatsapp, IconCalendario, IconAlerta } from "@/components/icons";
import { StatCard } from "@/components/shell/stat-card";
import { formatCompact, formatDateTime, formatTime } from "@/lib/format";
import type { WhatsappOverview } from "@/lib/data/whatsapp";

/// Resume o agendamento numa linha curta pro card de estatísticas.
/// nextSendAt nulo ou já vencido significa que o cron externo decide no
/// próximo tick — não dá pra cravar um horário.
function scheduleLabel(schedule: WhatsappOverview["schedule"]): string {
  if (!schedule.enabled) return "envio desligado";

  const interval = `a cada ${schedule.intervalMinutes}min`;
  const nextSendAt = schedule.nextSendAt ? new Date(schedule.nextSendAt) : null;
  const isFuture = nextSendAt !== null && nextSendAt.getTime() > Date.now();

  return isFuture ? `${interval} · próximo às ${formatTime(nextSendAt)}` : `${interval} · no próximo ciclo`;
}

export function StatsRow({ stats, schedule }: Pick<WhatsappOverview, "stats" | "schedule">) {
  const lastSentTitle = schedule.lastSentAt
    ? `Último envio: ${formatDateTime(schedule.lastSentAt)}`
    : undefined;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Ofertas aguardando envio" value={formatCompact(stats.pendingOffers)} icon={IconOfertas} />
      <StatCard label="Enviadas hoje" value={formatCompact(stats.sentToday)} icon={IconCalendario} />
      <StatCard label="Enviadas ao todo" value={formatCompact(stats.sentTotal)} icon={IconWhatsapp} />
      <StatCard
        label="Falhas nas últimas 24h"
        value={formatCompact(stats.failedRecent)}
        icon={IconAlerta}
        deltaLabel={
          <span title={lastSentTitle}>{scheduleLabel(schedule)}</span>
        }
      />
    </div>
  );
}
