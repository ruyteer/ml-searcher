import Link from "next/link";
import { IconDocumento } from "@/components/icons";
import { Section } from "@/components/shell/section";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompact } from "@/lib/format";
import { getTopPresells } from "@/lib/data/metrics";

export async function PresellsSection() {
  const presells = await getTopPresells(10);

  return (
    <Section title="Pre-sells com mais views" description="Top 10 por visualizações.">
      {presells.length === 0 ? (
        <EmptyState icon={IconDocumento} title="Nenhuma pre-sell criada ainda" className="border-none py-10" />
      ) : (
        <>
          {/* Abaixo do breakpoint, tabela vira lista de linhas tocáveis. */}
          <div className="flex flex-col gap-1 sm:hidden">
            {presells.map((presell) => (
              <Link
                key={presell.id}
                href="/presells"
                className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-muted/50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="line-clamp-1 text-sm text-foreground">{presell.title}</span>
                  {!presell.active && (
                    <Badge variant="outline" className="shrink-0">
                      inativa
                    </Badge>
                  )}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {formatCompact(presell.views)}
                </span>
              </Link>
            ))}
          </div>

          <Table className="hidden sm:table">
            <TableHeader>
              <TableRow>
                <TableHead>Pre-sell</TableHead>
                <TableHead className="text-right">Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presells.map((presell) => (
                <TableRow key={presell.id}>
                  <TableCell>
                    <Link href="/presells" className="flex items-center gap-2">
                      <span className="line-clamp-1 text-sm text-foreground">{presell.title}</span>
                      {!presell.active && (
                        <Badge variant="outline" className="shrink-0">
                          inativa
                        </Badge>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCompact(presell.views)}
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
