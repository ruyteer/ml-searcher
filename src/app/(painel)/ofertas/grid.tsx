import { IconOfertaVazia } from "@/components/icons";
import { EmptyState } from "@/components/shell/empty-state";
import { getOffers, getActivePresells, type OfferFilters } from "@/lib/data/offers";
import { getWatchOptions } from "@/lib/data/products";
import { getSettings } from "@/lib/settings";
import { SelectableOfferCard } from "./selectable-offer-card";
import { OffersPagination } from "./offers-pagination";

/// Como a lista está ordenada, em português. O valor da URL continua sendo
/// score/discount/price/recent.
const SORT_PHRASE: Record<string, string> = {
  score: "das melhores oportunidades para as piores",
  discount: "do maior desconto para o menor",
  price: "do mais barato para o mais caro",
  recent: "das mais recentes para as mais antigas",
};

/// Como a lista está filtrada por situação, em português.
const STATUS_NOUN: Record<string, string> = {
  NEW: "ofertas novas",
  PUBLISHED: "ofertas já publicadas",
  IGNORED: "ofertas ignoradas",
  ALL: "ofertas",
};

/// Uma frase honesta dizendo o que está na tela e o que ficou de fora. O
/// usuário reclamou de não saber se estava vendo tudo ou um recorte.
function summarize(filters: OfferFilters, shown: number, total: number, watchLabel: string | null): string {
  const noun = STATUS_NOUN[filters.status] ?? "ofertas";
  const parts: string[] = [];

  if (total <= shown) {
    parts.push(`Mostrando ${total.toLocaleString("pt-BR")} ${noun}`);
  } else {
    parts.push(`Mostrando ${shown} de ${total.toLocaleString("pt-BR")} ${noun}`);
  }

  if (watchLabel) parts.push(`na categoria ${watchLabel}`);
  if (filters.search.trim()) parts.push(`com "${filters.search.trim()}" no nome`);
  if (filters.minDiscount > 0) parts.push(`com pelo menos ${filters.minDiscount}% de desconto`);

  return `${parts.join(", ")}, ${SORT_PHRASE[filters.sort] ?? ""}.`.replace(", .", ".");
}

/// Busca os dados e renderiza o grid. Server Component async, fica dentro do
/// <Suspense> de page.tsx pra não travar o resto da UI durante o fetch.
export async function OffersGrid({ filters }: { filters: OfferFilters }) {
  const [result, presells, settings, watches] = await Promise.all([
    getOffers(filters),
    getActivePresells(),
    getSettings(),
    getWatchOptions(),
  ]);

  if (result.items.length === 0) {
    const filtrando =
      Boolean(filters.search.trim()) ||
      Boolean(filters.watchId) ||
      filters.minDiscount > 0 ||
      filters.priceMin !== null ||
      filters.priceMax !== null;

    return (
      <EmptyState
        icon={IconOfertaVazia}
        title="Nenhuma oferta aqui"
        description={
          filtrando
            ? "Nenhuma oferta bate com os filtros escolhidos. Limpe os filtros para ver tudo que foi encontrado."
            : "Ainda não há queda de preço registrada nesta situação. Dispare uma nova varredura para procurar ofertas."
        }
      />
    );
  }

  const watchLabel = filters.watchId ? (watches.find((w) => w.id === filters.watchId)?.label ?? null) : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {summarize(filters, result.items.length, result.total, watchLabel)}
      </p>

      {/* Densidade: a coluna fica em torno de 230px em todo breakpoint acima
          do celular, largura em que nome e preço ainda são legíveis. */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {result.items.map((offer) => (
          <SelectableOfferCard key={offer.id} offer={offer} hotDiscount={settings.hotDiscount} presells={presells} />
        ))}
      </div>
      <OffersPagination pageCount={result.pageCount} total={result.total} />
    </div>
  );
}
