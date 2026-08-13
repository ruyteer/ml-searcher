"use client";

import { useState } from "react";
import { Section } from "@/components/shell/section";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/produto/pagination";
import { formatDateTime } from "@/lib/format";
import type { WhatsappSendLogRow } from "@/lib/data/whatsapp";

const STATUS_LABEL: Record<string, string> = {
  sent: "Enviada",
  failed: "Falhou",
  pending: "Pendente",
};

const STATUS_VARIANT: Record<string, "default" | "destructive" | "outline"> = {
  sent: "default",
  failed: "destructive",
  pending: "outline",
};

const PAGE_SIZE = 10;

export function SendLogTable({ rows }: { rows: WhatsappSendLogRow[] }) {
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Section title="Envios recentes" description="Últimas mensagens mandadas (ou tentadas) pelo envio automático.">
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum envio ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-xs whitespace-normal">
                      <p className="line-clamp-2 text-sm whitespace-pre-line">{row.message}</p>
                      {row.error && <p className="mt-1 text-xs text-danger">{row.error}</p>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.groupName ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(row.sentAt ?? row.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={safePage} pageCount={pageCount} total={rows.length} onPageChange={setPage} />
        </div>
      )}
    </Section>
  );
}
