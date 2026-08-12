import Link from "next/link";
import { Link2 } from "lucide-react";
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
        <EmptyState icon={Link2} title="Nenhum clique em link neste período" className="border-none py-10" />
      ) : (
        <Table>
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
      )}
    </Section>
  );
}
