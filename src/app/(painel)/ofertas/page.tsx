import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { getWatchOptions } from "@/lib/data/products";
import { loadOffersParams, toOfferFilters } from "./params";
import { OffersFilters } from "./filters";
import { OffersStats, OffersStatsSkeleton } from "./stats";
import { OffersGrid } from "./grid";
import { OffersGridSkeleton } from "./grid-skeleton";
import { SelectionProvider, BulkActionsBar } from "./selection";
import { ScrapePanel } from "./scrape-panel";

interface OfertasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OfertasPage({ searchParams }: OfertasPageProps) {
  const params = await loadOffersParams(searchParams);
  const filters = toOfferFilters(params);
  const watches = await getWatchOptions();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ofertas"
        description="Quedas de preço detectadas pela varredura, prontas pra publicar."
        actions={<ScrapePanel />}
      />

      <Suspense fallback={<OffersStatsSkeleton />}>
        <OffersStats />
      </Suspense>

      <OffersFilters watches={watches} />

      <SelectionProvider>
        <BulkActionsBar />
        {/* Sem key aqui de propósito: o useTransition do filtro mantém o grid
            atual visível enquanto o novo carrega, evitando o flash do skeleton
            a cada troca de filtro (só aparece na primeira carga da página). */}
        <Suspense fallback={<OffersGridSkeleton />}>
          <OffersGrid filters={filters} />
        </Suspense>
      </SelectionProvider>
    </div>
  );
}
