import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PeriodSelector } from "./period-selector";
import { DashboardContent } from "./dashboard-content";
import { DashboardSkeleton } from "./skeletons";
import { loadDashboardSearchParams } from "./search-params";

export const metadata: Metadata = {
  title: "Visão geral",
};

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { period } = await loadDashboardSearchParams(searchParams);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Visão geral"
        description="Cliques, ofertas e varreduras do período selecionado."
        actions={<PeriodSelector />}
      />

      {/* O gate de "tem dado?" e cada bloco pesado ficam atrás do próprio
          Suspense — a página pinta o esqueleto na hora e vai preenchendo. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent period={period} />
      </Suspense>
    </div>
  );
}
