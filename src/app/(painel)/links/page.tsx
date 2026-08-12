import { Suspense } from "react";
import type { SearchParams } from "nuqs/server";
import { PageHeader } from "@/components/shell/page-header";
import { Section } from "@/components/shell/section";
import { LinkKind } from "@/generated/prisma";
import type { LinkFilters } from "@/lib/data/links";
import { linksSearchParamsCache } from "./search-params";
import { LinkStats } from "./stats";
import { LinkFilters as LinkFiltersBar } from "./filters";
import { LinkList } from "./link-list";
import { LinkDetailSheet } from "./link-detail-sheet";
import { LinkDetailContent } from "./link-detail-content";
import { NewLinkDialog } from "./new-link-dialog";
import { StatsSkeleton, LinkTableSkeleton, LinkDetailSkeleton } from "./skeletons";

interface LinksPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function LinksPage({ searchParams }: LinksPageProps) {
  const params = await linksSearchParamsCache.parse(searchParams);

  const filters: LinkFilters = {
    kind: params.kind === "all" ? undefined : (params.kind as LinkKind),
    active: params.active === "all" ? undefined : params.active === "active",
    q: params.q || undefined,
    period: params.period,
    sort: params.sort,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Links"
        description="Todos os links gerados, de produtos ou avulsos, e o desempenho de cada um."
        actions={<NewLinkDialog />}
      />

      <Suspense fallback={<StatsSkeleton />}>
        <LinkStats />
      </Suspense>

      <Section contentClassName="flex flex-col gap-4">
        <LinkFiltersBar />
        {/* a key força um novo Suspense sempre que os filtros mudam, evitando
            mostrar a tabela antiga por baixo do fallback */}
        <Suspense key={JSON.stringify(filters)} fallback={<LinkTableSkeleton />}>
          <LinkList filters={filters} />
        </Suspense>
      </Section>

      <LinkDetailSheet>
        {params.linkId && (
          <Suspense fallback={<LinkDetailSkeleton />}>
            <LinkDetailContent id={params.linkId} />
          </Suspense>
        )}
      </LinkDetailSheet>
    </div>
  );
}
