import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconCliques, IconProdutos } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shell/empty-state";
import { CopyButton } from "@/components/produto/copy-button";
import { getLinkDetail } from "@/lib/data/links";
import { getSettings } from "@/lib/settings";
import { publicUrl } from "@/lib/links";
import { formatCompact, formatDateTime } from "@/lib/format";
import { LinkKind } from "@/generated/prisma";
import { DailyClicksChart, DeviceBreakdownChart } from "./link-charts";

const KIND_LABELS: Record<LinkKind, string> = {
  [LinkKind.DIRECT]: "Direto",
  [LinkKind.TRACKED]: "Com rastreio",
  [LinkKind.PRESELL]: "Com página de aquecimento",
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
  bot: "Bot",
  desconhecido: "Desconhecido",
};

/// "https://dominio.com/caminho" -> "dominio.com/caminho", só pra exibição
/// (o botão de copiar usa a URL completa).
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export async function LinkDetailContent({ id }: { id: string }) {
  const [detail, settings, requestHeaders] = await Promise.all([
    getLinkDetail(id),
    getSettings(),
    headers(),
  ]);
  if (!detail) notFound();

  const title = detail.product?.title ?? detail.label ?? detail.slug;
  const path =
    detail.kind === LinkKind.PRESELL && detail.presell ? `/p/${detail.presell.slug}` : `/r/${detail.slug}`;
  const address = publicUrl(path, settings, requestHeaders);
  const neverClicked = detail.clickCount === 0;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="line-clamp-2 pr-6">{title}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2">
          <span>Criado em {formatDateTime(detail.createdAt)}</span>
          <Badge variant="outline">{KIND_LABELS[detail.kind]}</Badge>
          {!detail.active && <Badge variant="secondary">Inativo</Badge>}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4">
        {detail.product && (
          <Link
            href="/produtos"
            className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted"
          >
            {detail.product.thumbnail ? (
              <Image
                src={detail.product.thumbnail}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-md bg-muted object-cover"
              />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                <HugeiconsIcon icon={IconProdutos} size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden="true" />
              </span>
            )}
            <span className="flex flex-col gap-0.5 overflow-hidden">
              <span className="line-clamp-1 text-sm font-medium text-foreground">{detail.product.title}</span>
              <span className="text-xs text-muted-foreground">Produto ligado a este link</span>
            </span>
          </Link>
        )}

        {detail.presell && (
          <Link
            href="/presells"
            className="flex flex-col gap-0.5 rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted"
          >
            <span className="line-clamp-1 text-sm font-medium text-foreground">{detail.presell.title}</span>
            <span className="text-xs text-muted-foreground">Página de aquecimento usada por este link</span>
          </Link>
        )}

        <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <span className="text-xs text-muted-foreground">Endereço do link</span>
            <span className="truncate font-mono text-sm text-foreground">{displayUrl(address)}</span>
          </div>
          <CopyButton getUrl={() => address} label="Copiar" successMessage="Endereço do link copiado" size="icon-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Cliques totais</p>
            <p className="text-xl font-semibold">{formatCompact(detail.clickCount)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Cliques nos últimos 30 dias</p>
            <p className="text-xl font-semibold">
              {formatCompact(detail.clicksByDay.reduce((sum, d) => sum + d.count, 0))}
            </p>
          </div>
        </div>

        {neverClicked ? (
          <EmptyState
            icon={IconCliques}
            title="Este link ainda não recebeu nenhum clique"
            description="Assim que alguém clicar, os cliques por dia, o aparelho usado e a origem do tráfego aparecem aqui."
          />
        ) : (
          <>
            <Separator />

            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Cliques nos últimos 30 dias</h4>
              <DailyClicksChart data={detail.clicksByDay} />
            </div>

            <Separator />

            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Por aparelho</h4>
              {detail.byDevice.length > 0 ? (
                <DeviceBreakdownChart data={detail.byDevice} />
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados de aparelho ainda.</p>
              )}
            </div>

            <Separator />

            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Principais origens do tráfego</h4>
              {detail.topReferrers.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {detail.topReferrers.map((r) => (
                    <li key={r.referer} className="flex items-center justify-between text-sm">
                      <span className="line-clamp-1 max-w-56 text-muted-foreground">
                        {r.referer === "direto" ? "Acesso direto" : r.referer}
                      </span>
                      <span className="font-medium">{formatCompact(r.count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma origem registrada ainda.</p>
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
                            repetido
                          </Badge>
                        )}
                        <span>{c.country ?? "-"}</span>
                        <span className="text-muted-foreground">
                          · {c.device ? (DEVICE_LABELS[c.device] ?? c.device) : "desconhecido"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum clique registrado ainda.</p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
