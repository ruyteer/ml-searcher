import { Skeleton } from "@/components/ui/skeleton";

export function PhrasesTabSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 max-w-xs flex-1" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="ml-auto h-8 w-32" />
        <Skeleton className="h-8 w-28" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <Skeleton className="mb-3 h-4 w-32" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-5/6" />
          </div>
        </div>
      ))}
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
