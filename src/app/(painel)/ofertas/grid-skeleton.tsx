import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/// Espelha o layout real do grid de OfferCard (imagem de capa + conteúdo)
/// pra não piscar a página inteira enquanto o filtro troca (Suspense
/// fallback).
export function OffersGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <Card key={i} className="gap-0 overflow-hidden p-0">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <Skeleton className="h-7 flex-1" />
              <Skeleton className="size-7 shrink-0 rounded-lg" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
