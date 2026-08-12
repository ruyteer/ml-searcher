"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconCarregando, IconGrafico } from "@/components/icons";
import { formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getPriceTimeline, type PriceTimeline } from "@/app/(painel)/ofertas/actions";
import { offerStatusLabel, opportunityCopy, referenceCopy, OPPORTUNITY_TERM } from "./offer-language";

export interface PriceHistorySheetProps {
  productId: string;
  productTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ChartPoint {
  capturedAt: string;
  price: number;
  /// Preenchido só nos pontos em que o produto virou oferta, pra desenhar a
  /// bolinha destacada por cima da linha.
  offerPrice: number | null;
}

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const shortTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

/// Quando todas as leituras são do mesmo dia, mostrar "12/08" cinco vezes não
/// diz nada: nesse caso o eixo vira hora.
function makeTickFormatter(points: ChartPoint[]) {
  if (points.length < 2) return (iso: string) => shortDate.format(new Date(iso));
  const first = new Date(points[0].capturedAt).getTime();
  const last = new Date(points[points.length - 1].capturedAt).getTime();
  const useTime = last - first < TWO_DAYS_MS;
  return (iso: string) => (useTime ? shortTime : shortDate).format(new Date(iso));
}

/// O eixo Y do recharts começa em zero por padrão, o que achata a curva quando
/// o preço varia pouco (R$ 102 a R$ 111 vira uma linha reta). Aqui a escala
/// acompanha a faixa real, com uma folga para a linha não encostar na borda.
function priceDomain(min: number, max: number): [number, number] {
  const pad = Math.max(100, Math.round((max - min) * 0.15));
  return [Math.max(0, min - pad), max + pad];
}

/// Casa cada oferta detectada com a captura de preço mais próxima, pra marcar
/// no gráfico o momento em que o produto virou oferta. A oferta e a captura
/// quase nunca têm o mesmo timestamp: a oferta nasce logo depois da varredura.
function buildSeries(timeline: PriceTimeline): ChartPoint[] {
  const series: ChartPoint[] = timeline.points.map((p) => ({
    capturedAt: p.capturedAt,
    price: p.price,
    offerPrice: null,
  }));
  if (series.length === 0) return series;

  const times = series.map((p) => new Date(p.capturedAt).getTime());

  for (const offer of timeline.offers) {
    const target = new Date(offer.detectedAt).getTime();
    let best = 0;
    let bestDelta = Math.abs(times[0] - target);
    for (let i = 1; i < times.length; i += 1) {
      const delta = Math.abs(times[i] - target);
      if (delta < bestDelta) {
        best = i;
        bestDelta = delta;
      }
    }
    series[best].offerPrice = series[best].price;
  }

  return series;
}

function StatBox({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border px-2.5 py-2">
      <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums text-foreground", tone)}>{value}</span>
    </div>
  );
}

function LegendDot({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("size-2 rounded-full", className)} aria-hidden="true" />
      {children}
    </span>
  );
}

/// Sheet "Ver histórico de preço": mostra a curva de preço dos últimos 90 dias,
/// marca o menor e o maior preço do período e as datas em que o produto virou
/// oferta. Quando há pouca coisa registrada, diz isso com todas as letras em
/// vez de desenhar uma linha bonita em cima de dois pontos.
export function PriceHistorySheet({ productId, productTitle, open, onOpenChange }: PriceHistorySheetProps) {
  const [timeline, setTimeline] = useState<PriceTimeline | null>(null);
  /// Guarda para qual produto o carregamento já terminou. O estado de
  /// "carregando" é DERIVADO daqui em vez de virar um setState síncrono dentro
  /// do efeito, que dispara renderização em cascata.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const requested = useRef<string | null>(null);

  useEffect(() => {
    if (!open || requested.current === productId) return;
    requested.current = productId;
    let active = true;
    getPriceTimeline(productId)
      .then((data) => {
        if (!active) return;
        setTimeline(data);
        setLoadedFor(productId);
      })
      .catch(() => {
        if (!active) return;
        requested.current = null;
        toast.error("Não foi possível carregar o histórico de preço");
      });
    return () => {
      active = false;
    };
  }, [open, productId]);

  const loading = loadedFor !== productId;

  const series = timeline ? buildSeries(timeline) : [];
  const enoughToPlot = series.length >= 2;
  const thin = series.length >= 2 && series.length < 5;

  const minIndex =
    timeline?.minPrice != null ? series.findIndex((p) => p.price === timeline.minPrice) : -1;
  const maxIndex =
    timeline?.maxPrice != null ? series.findIndex((p) => p.price === timeline.maxPrice) : -1;
  const offerCount = timeline?.offers.length ?? 0;
  const formatTick = makeTickFormatter(series);
  const domain =
    timeline?.minPrice != null && timeline?.maxPrice != null
      ? priceDomain(timeline.minPrice, timeline.maxPrice)
      : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="line-clamp-2 pr-8">{productTitle}</SheetTitle>
          <SheetDescription>
            Preço registrado a cada varredura. Mostrando os últimos {timeline?.days ?? 90} dias.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {loading || !timeline ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <HugeiconsIcon icon={IconCarregando} size={16} strokeWidth={1.5} className="animate-spin" />
              Carregando histórico...
            </div>
          ) : !enoughToPlot ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <HugeiconsIcon icon={IconGrafico} size={20} strokeWidth={1.6} aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground">Ainda não dá para desenhar o gráfico</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {series.length === 0
                  ? "Nenhum preço foi registrado para este produto nos últimos 90 dias."
                  : "Só temos um preço registrado até agora. Com uma única leitura não existe subida nem queda para mostrar."}{" "}
                Começamos a acompanhar este produto em {formatDateTime(timeline.firstSeenAt)}. A cada nova
                varredura entra um ponto novo aqui.
              </p>
              <p className="text-sm text-foreground">
                Preço de agora: <span className="font-semibold">{formatBRL(timeline.currentPrice)}</span>
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <StatBox
                  label="Menor no período"
                  value={timeline.minPrice != null ? formatBRL(timeline.minPrice) : "-"}
                  tone="text-success"
                />
                <StatBox label="Preço de agora" value={formatBRL(timeline.currentPrice)} />
                <StatBox
                  label="Maior no período"
                  value={timeline.maxPrice != null ? formatBRL(timeline.maxPrice) : "-"}
                />
              </div>

              {thin && (
                <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Atenção: só temos {series.length} leituras de preço deste produto. É pouco para
                  afirmar qual é o preço normal dele. A linha abaixo vai ficar mais confiável a cada
                  varredura.
                </p>
              )}

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="capturedAt"
                      tickFormatter={formatTick}
                      fontSize={10}
                      stroke="var(--muted-foreground)"
                      minTickGap={28}
                    />
                    <YAxis
                      domain={domain}
                      tickFormatter={(v: number) => formatBRL(v)}
                      fontSize={10}
                      stroke="var(--muted-foreground)"
                      width={72}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatBRL(Number(value)),
                        name === "offerPrice" ? "Virou oferta" : "Preço",
                      ]}
                      labelFormatter={(v) => (typeof v === "string" ? formatDateTime(v) : "")}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <defs>
                      <linearGradient id="price-history-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="var(--color-chart-1)"
                      strokeWidth={2}
                      fill="url(#price-history-fill)"
                      isAnimationActive={false}
                    />
                    {/* Linha sem traço: só os pontos aparecem, marcando quando
                        o produto virou oferta. */}
                    <Line
                      type="monotone"
                      dataKey="offerPrice"
                      stroke="transparent"
                      connectNulls={false}
                      isAnimationActive={false}
                      dot={{ r: 4, fill: "var(--color-chart-2)", stroke: "var(--background)", strokeWidth: 1.5 }}
                      activeDot={{ r: 6 }}
                    />
                    {minIndex >= 0 && (
                      <ReferenceDot
                        x={series[minIndex].capturedAt}
                        y={series[minIndex].price}
                        r={4}
                        fill="var(--color-success)"
                        stroke="var(--background)"
                        strokeWidth={1.5}

                      />
                    )}
                    {maxIndex >= 0 && (
                      <ReferenceDot
                        x={series[maxIndex].capturedAt}
                        y={series[maxIndex].price}
                        r={4}
                        fill="var(--muted-foreground)"
                        stroke="var(--background)"
                        strokeWidth={1.5}

                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <LegendDot className="bg-[var(--color-chart-2)]">virou oferta</LegendDot>
                <LegendDot className="bg-success">menor preço do período</LegendDot>
                <LegendDot className="bg-muted-foreground">maior preço do período</LegendDot>
              </div>

              {timeline.pointsInPeriod > series.length && (
                <p className="text-xs text-muted-foreground">
                  O produto tem {timeline.pointsInPeriod.toLocaleString("pt-BR")} leituras no período.
                  O gráfico mostra as {series.length} mais recentes para não virar um borrão.
                </p>
              )}

              <Separator />

              <div>
                <h4 className="mb-2 text-sm font-medium text-foreground">
                  {offerCount === 0
                    ? "Ainda não virou oferta neste período"
                    : offerCount === 1
                      ? "Virou oferta 1 vez neste período"
                      : `Virou oferta ${offerCount} vezes neste período`}
                </h4>

                {offerCount === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    O preço deste produto não caiu o suficiente para entrar na tela de ofertas nos
                    últimos {timeline.days} dias.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {[...timeline.offers].reverse().map((offer) => {
                      const copy = referenceCopy(offer.referenceKind);
                      const opportunity = opportunityCopy(offer.score);
                      return (
                        <div
                          key={offer.id}
                          className="flex flex-col gap-1 rounded-lg border border-border px-2.5 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-muted-foreground">{formatDateTime(offer.detectedAt)}</span>
                            <Badge variant={offer.status === "PUBLISHED" ? "default" : "outline"}>
                              {offerStatusLabel(offer.status)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="tabular-nums text-muted-foreground line-through">
                              {formatBRL(offer.referencePrice)}
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">
                              {formatBRL(offer.price)}
                            </span>
                            <Badge variant="secondary" className="tabular-nums">
                              -{offer.discountPct}%
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">{copy.line}.</p>
                          <p className="text-muted-foreground">
                            {OPPORTUNITY_TERM.charAt(0).toUpperCase() + OPPORTUNITY_TERM.slice(1)}:{" "}
                            <span className={cn("font-medium", opportunity.tone)}>
                              {opportunity.label} ({offer.score} de 100)
                            </span>
                          </p>
                        </div>
                      );
                    })}
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
