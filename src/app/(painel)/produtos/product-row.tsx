"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShieldBanIcon, CheckmarkCircle02Icon, ExternalLinkIcon, Loading03Icon, MouseLeftClick01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { TableCell, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProductThumb } from "@/components/produto/product-thumb";
import { PriceTag } from "@/components/produto/price-tag";
import { PriceComparison } from "@/components/produto/price-comparison";
import { GenerateLinkMenu } from "@/components/produto/generate-link-menu";
import { CopyButton } from "@/components/produto/copy-button";
import {
  linkKindLabel,
  offerStatusLabel,
  opportunityCopy,
  OPPORTUNITY_EXPLAIN,
} from "@/components/produto/offer-language";
import { discountPct, formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getProductDetail, setProductBlocked } from "@/app/(painel)/produtos/actions";
import type { ProductDetail, ProductListItem } from "@/lib/data/products";
import type { PresellOption } from "@/components/produto/generate-link-menu";

/// Linha da tabela de /produtos. Clicar abre um Sheet com o detalhe completo,
/// carregado sob demanda (getProductDetail) na primeira abertura. `presells`
/// vem pronto do servidor (table.tsx) — client component nenhum aqui chama
/// direto uma função de leitura que dependa de prisma/server-only.
export function ProductRow({ product, presells }: { product: ProductListItem; presells: PresellOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(product.blocked);
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !detail) {
      setLoading(true);
      getProductDetail(product.id)
        .then(setDetail)
        .catch(() => toast.error("Não foi possível carregar o detalhe do produto"))
        .finally(() => setLoading(false));
    }
  };

  const toggleBlock = () => {
    const next = !blocked;
    setBlocked(next);
    startTransition(async () => {
      try {
        await setProductBlocked(product.id, next);
        toast.success(next ? "Produto bloqueado" : "Produto desbloqueado");
        router.refresh();
      } catch (err) {
        setBlocked(!next);
        toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o produto");
      }
    });
  };

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => handleOpenChange(true)}>
        <TableCell>
          <ProductThumb src={product.thumbnail} alt={product.title} size={40} />
        </TableCell>
        <TableCell className="max-w-64 truncate" title={product.title}>
          <span>{product.title}</span>
          {blocked && (
            <Badge variant="destructive" className="ml-2">
              Bloqueado
            </Badge>
          )}
        </TableCell>
        <TableCell>{formatBRL(product.price)}</TableCell>
        <TableCell>{formatBRL(product.lowestPrice)}</TableCell>
        <TableCell>
          {product.variationPct === null ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            <span
              className={cn(
                product.variationPct < 0 ? "text-success" : product.variationPct > 0 ? "text-danger" : "text-muted-foreground",
              )}
            >
              {product.variationPct > 0 ? "+" : ""}
              {product.variationPct}%
            </span>
          )}
        </TableCell>
        <TableCell className="max-w-32 truncate">{product.sellerName ?? "-"}</TableCell>
        <TableCell>{product.soldQuantity.toLocaleString("pt-BR")}</TableCell>
        <TableCell className="max-w-32 truncate">{product.watchLabel ?? product.categoryName ?? "-"}</TableCell>
        <TableCell>{formatDateTime(product.lastSeenAt)}</TableCell>
      </TableRow>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
          <SheetHeader>
            <div className="flex items-start gap-3">
              <ProductThumb src={product.thumbnail} alt={product.title} size={56} />
              <div className="flex flex-1 flex-col gap-1">
                <SheetTitle className="line-clamp-2">{product.title}</SheetTitle>
                <SheetDescription>{product.sellerName ?? "Vendedor não informado"}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            {loading || !detail ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <HugeiconsIcon icon={Loading03Icon} size={16} strokeWidth={1.5} className="animate-spin" /> Carregando detalhe...
              </div>
            ) : (
              <>
                {detail.originalPrice && detail.originalPrice > detail.price ? (
                  <PriceComparison
                    price={detail.price}
                    referencePrice={detail.originalPrice}
                    referenceKind="ML_ORIGINAL"
                    discountPct={discountPct(detail.price, detail.originalPrice)}
                  />
                ) : (
                  <PriceTag price={detail.price} />
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  <a href={detail.permalink} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="xs">
                      <HugeiconsIcon icon={ExternalLinkIcon} size={13} strokeWidth={1.5} /> Abrir no Mercado Livre
                    </Button>
                  </a>
                  <GenerateLinkMenu productId={detail.id} presells={presells} size="xs" />
                  <Button
                    variant={blocked ? "outline" : "destructive"}
                    size="xs"
                    disabled={isPending}
                    onClick={toggleBlock}
                  >
                    {isPending ? (
                      <HugeiconsIcon icon={Loading03Icon} size={13} strokeWidth={1.5} className="animate-spin" />
                    ) : blocked ? (
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} strokeWidth={1.5} />
                    ) : (
                      <HugeiconsIcon icon={ShieldBanIcon} size={13} strokeWidth={1.5} />
                    )}
                    {blocked ? "Desbloquear" : "Bloquear"}
                  </Button>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-2 text-sm font-medium text-foreground">Histórico de preço</h4>
                  {detail.history.length < 2 ? (
                    <p className="text-xs text-muted-foreground">
                      Ainda não dá para desenhar o gráfico: temos {detail.history.length === 0 ? "nenhuma" : "só uma"}{" "}
                      leitura de preço deste produto. Começamos a acompanhar em{" "}
                      {formatDateTime(detail.firstSeenAt)} e cada varredura acrescenta um ponto.
                    </p>
                  ) : (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={detail.history} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis
                            dataKey="capturedAt"
                            tickFormatter={(v: string) => formatDateTime(v).split(" ")[0]}
                            fontSize={10}
                            stroke="var(--muted-foreground)"
                            minTickGap={24}
                          />
                          <YAxis
                            tickFormatter={(v: number) => formatBRL(v)}
                            fontSize={10}
                            stroke="var(--muted-foreground)"
                            width={64}
                          />
                          <Tooltip
                            formatter={(value) => [formatBRL(Number(value)), "Preço"]}
                            labelFormatter={(v) => (typeof v === "string" ? formatDateTime(v) : "")}
                            contentStyle={{
                              background: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <defs>
                            <linearGradient id="detail-fill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="price"
                            stroke="var(--color-chart-1)"
                            fill="url(#detail-fill)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    Vezes em que virou oferta ({detail.offers.length})
                  </h4>
                  <p className="mb-2 text-[11px] text-muted-foreground">{OPPORTUNITY_EXPLAIN}</p>
                  {detail.offers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Este produto ainda não teve queda de preço suficiente para aparecer na tela de ofertas.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {detail.offers.map((offer) => {
                        const opportunity = opportunityCopy(offer.score);
                        return (
                          <div
                            key={offer.id}
                            className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-border px-2.5 py-1.5 text-xs"
                          >
                            <span className="text-muted-foreground">{formatDateTime(offer.detectedAt)}</span>
                            <span className="flex items-center gap-1.5">
                              <span className="tabular-nums text-muted-foreground line-through">
                                {formatBRL(offer.referencePrice)}
                              </span>
                              <span className="font-medium tabular-nums text-foreground">
                                {formatBRL(offer.price)}
                              </span>
                              <span className="tabular-nums text-success">-{offer.discountPct}%</span>
                            </span>
                            <span className={cn("tabular-nums", opportunity.tone)}>
                              oportunidade {opportunity.label.toLowerCase()} ({offer.score} de 100)
                            </span>
                            <Badge variant={offer.status === "PUBLISHED" ? "default" : "outline"}>
                              {offerStatusLabel(offer.status)}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h4 className="mb-2 text-sm font-medium text-foreground">Links gerados ({detail.links.length})</h4>
                  {detail.links.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum link gerado ainda.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {detail.links.map((link) => (
                        <div
                          key={link.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs"
                        >
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span
                              className="truncate font-medium text-foreground"
                              title={`Endereço do link: ${link.slug}`}
                            >
                              {link.label || link.slug}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Badge variant="outline" className="text-[10px]">
                                {linkKindLabel(link.kind)}
                              </Badge>
                              <HugeiconsIcon icon={MouseLeftClick01Icon} size={12} strokeWidth={1.5} />
                              {link.clickCount} {link.clickCount === 1 ? "clique" : "cliques"}
                            </span>
                          </div>
                          <CopyButton size="icon-sm" label="" getUrl={() => link.url} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
