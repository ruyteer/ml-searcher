import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/// Espelha o layout real do grid de OfferCard pra não piscar a página
/// inteira enquanto o filtro troca (Suspense fallback).
export function OffersGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <Card key={i} className="flex flex-col gap-3 p-3">
          <div className="flex gap-3">
            <Skeleton className="size-18 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-7 w-full" />
        </Card>
      ))}
    </div>
  );
}
