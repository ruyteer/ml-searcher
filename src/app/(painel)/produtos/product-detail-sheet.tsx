"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ShieldBanIcon,
  CheckmarkCircle02Icon,
  ExternalLinkIcon,
  Loading03Icon,
  MouseLeftClick01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
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

/// Estado compartilhado entre a linha da tabela (desktop) e o cartão
/// (celular): as duas superfícies abrem o mesmo Sheet e bloqueiam o mesmo
/// produto, então a lógica mora aqui e não é escrita duas vezes.
export function useProductActions(product: ProductListItem) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(product.blocked);
  const [isPending, startTransition] = useTransition();

  const toggleBlocked = () => {
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

  return { open, setOpen, blocked, toggleBlocked, isPending };
}

export interface ProductDetailSheetProps {
  product: ProductListItem;
  presells: PresellOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocked: boolean;
  onToggleBlocked: () => void;
  isPending: boolean;
}

/// Detalhe do produto: preço, histórico, vezes em que virou oferta e links
/// gerados. O conteúdo é carregado sob demanda na primeira abertura.
///
/// No celular o painel ocupa a tela inteira. O `w-3/4` que o Sheet aplica por
/// padrão vem de um seletor com atributo (`data-[side=right]`), então precisa
/// ser sobrescrito com o mesmo seletor: um `w-full` solto perde a disputa e o
/// detalhe fica espremido em três quartos de tela.
export function ProductDetailSheet({
  product,
  presells,
  open,
  onOpenChange,
  blocked,
  onToggleBlocked,
  isPending,
}: ProductDetailSheetProps) {
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (next && !detail && !loading) {
      setLoading(true);
      getProductDetail(product.id)
        .then(setDetail)
        .catch(() => toast.error("Não foi possível carregar o detalhe do produto"))
        .finally(() => setLoading(false));
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <SheetHeader className="pr-12">
          <div className="flex items-start gap-3">
            <ProductThumb src={product.thumbnail} alt={product.title} size={56} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <SheetTitle className="line-clamp-3">{product.title}</SheetTitle>
              <SheetDescription>{product.sellerName ?? "Vendedor não informado"}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {loading || !detail ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <HugeiconsIcon icon={Loading03Icon} size={16} strokeWidth={1.5} className="animate-spin" />
              Carregando detalhe...
            </div>
          ) : (
            <>
              {detail.originalPrice && detail.originalPrice > detail.price ? (
                <PriceComparison
                  price={detail.price}
                  referencePrice={detail.originalPrice}
                  discountPct={discountPct(detail.price, detail.originalPrice)}
                />
              ) : (
                <PriceTag price={detail.price} />
              )}

              {/* Ações com alvo de toque de 44px no celular. */}
              <div className="flex flex-wrap items-center gap-2">
                <a href={detail.permalink} target="_blank" rel="noreferrer" className="max-sm:flex-1">
                  <Button variant="outline" size="xs" className="h-11 w-full sm:h-6 sm:w-auto">
                    <HugeiconsIcon icon={ExternalLinkIcon} size={15} strokeWidth={1.5} /> Abrir no Mercado Livre
                  </Button>
                </a>
                <GenerateLinkMenu
                  productId={detail.id}
                  presells={presells}
                  size="xs"
                  className="h-11 max-sm:flex-1 sm:h-6"
                />
                <Button
                  variant={blocked ? "outline" : "destructive"}
                  size="xs"
                  className="h-11 max-sm:w-full sm:h-6"
                  disabled={isPending}
                  onClick={onToggleBlocked}
                >
                  {isPending ? (
                    <HugeiconsIcon icon={Loading03Icon} size={15} strokeWidth={1.5} className="animate-spin" />
                  ) : blocked ? (
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} strokeWidth={1.5} />
                  ) : (
                    <HugeiconsIcon icon={ShieldBanIcon} size={15} strokeWidth={1.5} />
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
                        <CopyButton size="icon-sm" label="" className="size-11 sm:size-7" getUrl={() => link.url} />
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
  );
}
