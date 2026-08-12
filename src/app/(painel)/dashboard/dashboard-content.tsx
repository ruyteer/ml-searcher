import { Suspense } from "react";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDashboardHasData, type Period } from "@/lib/data/metrics";
import { KpiSection } from "./kpi-section";
import { ClicksChartSection } from "./clicks-chart-section";
import { DeviceSection } from "./device-section";
import { DiscountSection } from "./discount-section";
import { TopProductsSection } from "./top-products-section";
import { TopLinksSection } from "./top-links-section";
import { LatestRunSection } from "./latest-run-section";
import { PresellsSection } from "./presells-section";
import { ChartSkeleton, KpiRowSkeleton, ListSkeleton, RunCardSkeleton } from "./skeletons";

/// Gate assíncrono: decide entre o EmptyState de banco vazio e a grade de
/// blocos do dashboard. Cada bloco fica no seu próprio Suspense pra pintar
/// a página inteira em skeleton na hora e ir preenchendo — nenhum await
/// aqui bloqueia os outros.
export async function DashboardContent({ period }: { period: Period }) {
  const hasData = await getDashboardHasData();

  if (!hasData) {
    return (
      <EmptyState
        icon={SearchX}
        title="Ainda não há dados no painel"
        description="O banco está recém-criado. Rode a primeira varredura em Ofertas para começar a coletar produtos, ofertas e cliques."
        action={
          <Link href="/ofertas" className={cn(buttonVariants())}>
            Ir para Ofertas
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<KpiRowSkeleton />}>
        <KpiSection period={period} />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Suspense fallback={<ChartSkeleton height={320} />}>
            <ClicksChartSection period={period} />
          </Suspense>
        </div>
        <div className="flex flex-col gap-6">
          <Suspense fallback={<ChartSkeleton height={220} />}>
            <DeviceSection period={period} />
          </Suspense>
          <Suspense fallback={<ChartSkeleton height={220} />}>
            <DiscountSection period={period} />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<ListSkeleton rows={8} />}>
            <TopProductsSection period={period} />
          </Suspense>
        </div>
        <Suspense fallback={<RunCardSkeleton />}>
          <LatestRunSection />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<ListSkeleton rows={6} />}>
          <TopLinksSection period={period} />
        </Suspense>
        <Suspense fallback={<ListSkeleton rows={6} />}>
          <PresellsSection />
        </Suspense>
      </div>
    </div>
  );
}
