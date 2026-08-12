"use client";

import { useQueryState } from "nuqs";
import { Pagination } from "@/components/produto/pagination";
import { productsParsers } from "./params";

export function ProductsPagination({ pageCount, total }: { pageCount: number; total: number }) {
  const [page, setPage] = useQueryState("page", productsParsers.page.withOptions({ shallow: false }));
  return <Pagination page={page} pageCount={pageCount} total={total} onPageChange={setPage} />;
}
