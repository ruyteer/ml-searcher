import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { getLinkDetail } from "@/lib/data/links";
import { formatCompact, formatDateTime } from "@/lib/format";
import { LinkKind } from "@/generated/prisma";
import { DailyClicksChart, DeviceBreakdownChart } from "./link-charts";

const KIND_LABELS: Record<LinkKind, string> = {
  [LinkKind.DIRECT]: "Direto",
  [LinkKind.TRACKED]: "Rastreado",
  [LinkKind.PRESELL]: "Pre-sell",
};

export async function LinkDetailContent({ id }: { id: string }) {
  const detail = await getLinkDetail(id);
  if (!detail) notFound();

  const title = detail.product?.title ?? detail.label ?? detail.slug;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="line-clamp-2 pr-6">{title}</SheetTitle>
        <SheetDescription>
          Criado em {formatDateTime(detail.createdAt)} · <Badge variant="outline">{KIND_LABELS[detail.kind]}</Badge>
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Cliques totais</p>
            <p className="text-xl font-semibold">{formatCompact(detail.clickCount)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-xl font-semibold">{detail.active ? "Ativo" : "Inativo"}</p>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">Cliques nos últimos 30 dias</h4>
          <DailyClicksChart data={detail.clicksByDay} />
        </div>

        <Separator />

        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">Por dispositivo</h4>
          {detail.byDevice.length > 0 ? (
            <DeviceBreakdownChart data={detail.byDevice} />
          ) : (
            <p className="text-sm text-muted-foreground">Sem cliques registrados ainda.</p>
          )}
        </div>

        <Separator />

        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">Principais referrers</h4>
          {detail.topReferrers.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {detail.topReferrers.map((r) => (
                <li key={r.referer} className="flex items-center justify-between text-sm">
                  <span className="line-clamp-1 max-w-56 text-muted-foreground">{r.referer}</span>
                  <span className="font-medium">{formatCompact(r.count)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum referrer registrado.</p>
          )}
        </div>

        <Separator />

        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">Últimos cliques</h4>
          {detail.recentClicks.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {detail.recentClicks.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                  <span className="flex items-center gap-1.5">
                    {c.duplicate && (
                      <Badge variant="outline" className="text-[10px]">
                        duplicado
                      </Badge>
                    )}
                    <span>{c.country ?? "-"}</span>
                    <span className="text-muted-foreground">· {c.device ?? "desconhecido"}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum clique registrado ainda.</p>
          )}
        </div>
      </div>
    </>
  );
}
