import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { getWhatsappOverview } from "@/lib/data/whatsapp";
import { InstanceCard } from "./instance-card";
import { GroupsList } from "./groups-list";
import { ScheduleForm } from "./schedule-form";
import { UazapiConfigForm } from "./uazapi-config-form";
import { SendLogTable } from "./send-log-table";
import { StatsRow } from "./stats-row";
import { OverviewSkeleton } from "./skeletons";

export default function WhatsappPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="WhatsApp"
        description="Envio automático de ofertas pros grupos de promoção, com preview de link."
      />
      <Suspense fallback={<OverviewSkeleton />}>
        <WhatsappContent />
      </Suspense>
    </div>
  );
}

async function WhatsappContent() {
  const overview = await getWhatsappOverview();
  const connected = overview.instance?.status === "connected";

  return (
    <div className="flex flex-col gap-6">
      <StatsRow stats={overview.stats} schedule={overview.schedule} />

      <div className="grid gap-6 lg:grid-cols-2">
        <InstanceCard instance={overview.instance} hostConfigured={Boolean(overview.uazapiHost.trim())} />
        <UazapiConfigForm uazapiHost={overview.uazapiHost} adminTokenConfigured={overview.adminTokenConfigured} />
      </div>

      <GroupsList instanceId={overview.instance?.id ?? null} connected={connected} groups={overview.groups} />

      <ScheduleForm schedule={overview.schedule} />

      <SendLogTable rows={overview.recentSends} />
    </div>
  );
}
