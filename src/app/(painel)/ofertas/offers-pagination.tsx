"use client";

import { useQueryState } from "nuqs";
import { Pagination } from "@/components/produto/pagination";
import { offersParsers } from "./params";

export function OffersPagination({ pageCount, total }: { pageCount: number; total: number }) {
  const [page, setPage] = useQueryState("page", offersParsers.page.withOptions({ shallow: false }));
  return <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />;
}
