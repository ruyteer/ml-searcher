import { headers } from "next/headers";
import { listLinks, type LinkFilters } from "@/lib/data/links";
import { getSettings } from "@/lib/settings";
import { publicUrl } from "@/lib/links";
import { LinkKind } from "@/generated/prisma";
import { LinkTable, type LinkRow } from "./link-table";

/// Busca a lista já filtrada e resolve a URL pública de cada linha no
/// servidor (publicUrl depende de settings/headers, que não existem no cliente).
export async function LinkList({ filters }: { filters: LinkFilters }) {
  const [rows, settings, requestHeaders] = await Promise.all([
    listLinks(filters),
    getSettings(),
    headers(),
  ]);

  const enriched: LinkRow[] = rows.map((row) => {
    const path =
      row.kind === LinkKind.PRESELL && row.presell ? `/p/${row.presell.slug}` : `/r/${row.slug}`;
    return { ...row, publicHref: publicUrl(path, settings, requestHeaders) };
  });

  return <LinkTable rows={enriched} />;
}
