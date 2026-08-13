import Link from "next/link";
import { IconLinks } from "@/components/icons";
import { Section } from "@/components/shell/section";
import { EmptyState } from "@/components/shell/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompact } from "@/lib/format";
import { getTopLinks, type Period } from "@/lib/data/metrics";

export async function TopLinksSection({ period }: { period: Period }) {
  const links = await getTopLinks(period);

  return (
    <Section title="Links mais clicados" description="Top 10 no período selecionado.">
      {links.length === 0 ? (
        <EmptyState icon={IconLinks} title="Nenhum clique em link neste período" className="border-none py-10" />
      ) : (
        <>
          {/* Abaixo do breakpoint, tabela vira lista de linhas tocáveis. */}
          <div className="flex flex-col gap-1 sm:hidden">
            {links.map((link) => (
              <Link
                key={link.id}
                href="/links"
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-1 py-1.5 transition-colors hover:bg-muted/50"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {link.label ?? `/r/${link.slug}`}
                  </span>
                  {link.productTitle && (
                    <span className="line-clamp-1 text-xs text-muted-foreground">{link.productTitle}</span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {formatCompact(link.clicks)}
                </span>
              </Link>
            ))}
          </div>

          <Table className="hidden sm:table">
            <TableHeader>
              <TableRow>
                <TableHead>Link</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <Link href="/links" className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {link.label ?? `/r/${link.slug}`}
                      </span>
                      {link.productTitle && (
                        <span className="line-clamp-1 text-xs text-muted-foreground">{link.productTitle}</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCompact(link.clicks)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Section>
  );
}
