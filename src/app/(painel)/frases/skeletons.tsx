import { Skeleton } from "@/components/ui/skeleton";

export function PhrasesTabSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[200px_1fr] lg:items-start">
      <div className="hidden rounded-xl bg-card p-2.5 ring-1 ring-foreground/10 lg:block">
        <Skeleton className="mb-2 h-4 w-20" />
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 max-w-xs flex-1" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="ml-auto h-8 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-x-2 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TemplatesTabSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
