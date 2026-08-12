import { PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { getOffers, getActivePresells, type OfferFilters } from "@/lib/data/offers";
import { getSettings } from "@/lib/settings";
import { SelectableOfferCard } from "./selectable-offer-card";
import { OffersPagination } from "./offers-pagination";

/// Busca os dados e renderiza o grid — Server Component async, fica dentro
/// do <Suspense> de page.tsx pra não travar o resto da UI durante o fetch.
export async function OffersGrid({ filters }: { filters: OfferFilters }) {
  const [result, presells, settings] = await Promise.all([
    getOffers(filters),
    getActivePresells(),
    getSettings(),
  ]);

  if (result.items.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Nenhuma oferta encontrada"
        description="Ajuste os filtros ou dispare uma nova varredura para encontrar ofertas."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {result.items.map((offer) => (
          <SelectableOfferCard key={offer.id} offer={offer} hotDiscount={settings.hotDiscount} presells={presells} />
        ))}
      </div>
      <OffersPagination pageCount={result.pageCount} total={result.total} />
    </div>
  );
}
