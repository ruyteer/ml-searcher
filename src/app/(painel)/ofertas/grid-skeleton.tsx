import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/// Espelha o layout real do grid de OfferCard (imagem de capa 16:10 +
/// conteúdo compacto) pra não piscar a página inteira enquanto o filtro troca
/// (Suspense fallback). Se mudar colunas, proporção ou espaçamento em
/// grid.tsx / offer-card.tsx, mude aqui junto.
export function OffersGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="gap-0 overflow-hidden p-0">
          <Skeleton className="aspect-[16/10] w-full rounded-none" />
          <div className="flex flex-col gap-1.5 p-2.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
            <div className="flex items-center justify-between gap-1">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-7 flex-1" />
              <Skeleton className="size-7 shrink-0 rounded-lg" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
