import "server-only";
import { unstable_cache } from "next/cache";
import type { RunStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { TAGS } from "@/lib/cache";
import { type Period, periodDays } from "@/lib/periods";

/// Consultas agregadas para a visão geral do painel. Tudo aqui soma no banco
/// (count/groupBy/$queryRaw) — nunca traz linhas cruas pra somar em JS.

export type { Period } from "@/lib/periods";

interface PeriodRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

/// Janela do período selecionado (dias corridos, começando à meia-noite, até
/// agora) e a janela imediatamente anterior de mesmo tamanho — usada pra
/// calcular o delta de cada KPI.
function getPeriodRange(period: Period): PeriodRange {
  const days = periodDays(period);
  const end = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const prevEnd = new Date(start);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days);
  return { start, end, prevStart, prevEnd };
}

/// Delta percentual entre o período atual e o anterior. `undefined` quando
/// não há base de comparação — evita "+Infinity%" no StatCard.
function pctDelta(curr: number, prev: number): number | undefined {
  if (prev === 0) return curr === 0 ? undefined : 100;
  return ((curr - prev) / prev) * 100;
}

// ------------------------------------------------------------------- KPIs

export interface KpiValue {
  value: number;
  delta?: number;
}

export interface OverviewKpis {
  clicks: KpiValue;
  uniqueClicks: KpiValue;
  offersDetected: KpiValue;
  productsMonitored: number;
  activeLinks: number;
  /// Cliques do período divididos pelos links ativos — proxy de engajamento por link.
  clickThroughRate: KpiValue;
}

const cachedOverviewKpis = unstable_cache(
  async (period: Period): Promise<OverviewKpis> => {
    const { start, end, prevStart, prevEnd } = getPeriodRange(period);

    const [
      clicks,
      prevClicks,
      uniqueClicks,
      prevUniqueClicks,
      offersDetected,
      prevOffersDetected,
      productsMonitored,
      activeLinks,
    ] = await Promise.all([
      prisma.click.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.click.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
      prisma.click.count({ where: { createdAt: { gte: start, lte: end }, duplicate: false } }),
      prisma.click.count({ where: { createdAt: { gte: prevStart, lt: prevEnd }, duplicate: false } }),
      prisma.offer.count({ where: { detectedAt: { gte: start, lte: end } } }),
      prisma.offer.count({ where: { detectedAt: { gte: prevStart, lt: prevEnd } } }),
      prisma.product.count({ where: { blocked: false } }),
      prisma.link.count({ where: { active: true } }),
    ]);

    const ctr = activeLinks > 0 ? clicks / activeLinks : 0;
    const prevCtr = activeLinks > 0 ? prevClicks / activeLinks : 0;

    return {
      clicks: { value: clicks, delta: pctDelta(clicks, prevClicks) },
      uniqueClicks: { value: uniqueClicks, delta: pctDelta(uniqueClicks, prevUniqueClicks) },
      offersDetected: { value: offersDetected, delta: pctDelta(offersDetected, prevOffersDetected) },
      productsMonitored,
      activeLinks,
      clickThroughRate: { value: ctr, delta: pctDelta(ctr, prevCtr) },
    };
  },
  ["dashboard-overview-kpis"],
  { tags: [TAGS.metrics, TAGS.clicks, TAGS.offers, TAGS.links, TAGS.products] },
);

export function getOverviewKpis(period: Period): Promise<OverviewKpis> {
  return cachedOverviewKpis(period);
}

// ------------------------------------------------------------- série diária

export interface DailyClickPoint {
  date: string;
  total: number;
  unique: number;
}

const cachedDailyClicks = unstable_cache(
  async (period: Period): Promise<DailyClickPoint[]> => {
    const { start, end } = getPeriodRange(period);
    const rows = await prisma.$queryRaw<{ day: Date; total: number; unique: number }[]>`
      SELECT gs::date AS day,
        COUNT(c.id)::int AS total,
        COUNT(*) FILTER (WHERE c.duplicate = false)::int AS "unique"
      FROM generate_series(${start}::date, ${end}::date, interval '1 day') AS gs
      LEFT JOIN "Click" c
        ON c."createdAt" >= gs AND c."createdAt" < gs + interval '1 day'
      GROUP BY gs
      ORDER BY gs;
    `;
    return rows.map((r) => ({
      date: new Date(r.day).toISOString().slice(0, 10),
      total: Number(r.total),
      unique: Number(r.unique),
    }));
  },
  ["dashboard-daily-clicks"],
  { tags: [TAGS.metrics, TAGS.clicks] },
);

/// Série diária de cliques, com os dias sem clique preenchidos com zero.
export function getDailyClicks(period: Period): Promise<DailyClickPoint[]> {
  return cachedDailyClicks(period);
}

export interface DailyOfferPoint {
  date: string;
  count: number;
}

const cachedDailyOffers = unstable_cache(
  async (period: Period): Promise<DailyOfferPoint[]> => {
    const { start, end } = getPeriodRange(period);
    const rows = await prisma.$queryRaw<{ day: Date; count: number }[]>`
      SELECT gs::date AS day,
        COUNT(o.id)::int AS count
      FROM generate_series(${start}::date, ${end}::date, interval '1 day') AS gs
      LEFT JOIN "Offer" o
        ON o."detectedAt" >= gs AND o."detectedAt" < gs + interval '1 day'
      GROUP BY gs
      ORDER BY gs;
    `;
    return rows.map((r) => ({
      date: new Date(r.day).toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  },
  ["dashboard-daily-offers"],
  { tags: [TAGS.metrics, TAGS.offers] },
);

/// Ofertas detectadas por dia no período, dias sem oferta preenchidos com zero.
export function getDailyOffers(period: Period): Promise<DailyOfferPoint[]> {
  return cachedDailyOffers(period);
}

// ----------------------------------------------------------------- rankings

export interface TopProduct {
  id: string;
  title: string;
  thumbnail: string | null;
  permalink: string;
  clicks: number;
  linkSlug: string | null;
}

const cachedTopProducts = unstable_cache(
  async (period: Period): Promise<TopProduct[]> => {
    const { start, end } = getPeriodRange(period);
    const rows = await prisma.$queryRaw<TopProduct[]>`
      WITH clicked AS (
        SELECT l."productId" AS product_id, c.id AS click_id, l.slug AS link_slug
        FROM "Click" c
        JOIN "Link" l ON l.id = c."linkId"
        WHERE c."createdAt" >= ${start} AND c."createdAt" <= ${end}
          AND l."productId" IS NOT NULL
      )
      SELECT p.id, p.title, p.thumbnail, p.permalink,
        COUNT(clicked.click_id)::int AS clicks,
        (array_agg(clicked.link_slug))[1] AS "linkSlug"
      FROM clicked
      JOIN "Product" p ON p.id = clicked.product_id
      GROUP BY p.id
      ORDER BY clicks DESC
      LIMIT 10;
    `;
    return rows;
  },
  ["dashboard-top-products"],
  { tags: [TAGS.metrics, TAGS.clicks, TAGS.products] },
);

/// Top 10 produtos por cliques no período.
export function getTopProducts(period: Period): Promise<TopProduct[]> {
  return cachedTopProducts(period);
}

export interface TopLink {
  id: string;
  slug: string;
  label: string | null;
  productTitle: string | null;
  clicks: number;
}

const cachedTopLinks = unstable_cache(
  async (period: Period): Promise<TopLink[]> => {
    const { start, end } = getPeriodRange(period);
    const grouped = await prisma.click.groupBy({
      by: ["linkId"],
      where: { createdAt: { gte: start, lte: end } },
      _count: { _all: true },
    });
    if (grouped.length === 0) return [];

    const top = [...grouped].sort((a, b) => b._count._all - a._count._all).slice(0, 10);
    const links = await prisma.link.findMany({
      where: { id: { in: top.map((g) => g.linkId) } },
      select: { id: true, slug: true, label: true, product: { select: { title: true } } },
    });
    const byId = new Map(links.map((l) => [l.id, l]));

    return top.map((g) => {
      const link = byId.get(g.linkId);
      return {
        id: g.linkId,
        slug: link?.slug ?? "",
        label: link?.label ?? null,
        productTitle: link?.product?.title ?? null,
        clicks: g._count._all,
      };
    });
  },
  ["dashboard-top-links"],
  { tags: [TAGS.metrics, TAGS.clicks, TAGS.links] },
);

/// Top 10 links por cliques no período.
export function getTopLinks(period: Period): Promise<TopLink[]> {
  return cachedTopLinks(period);
}

// -------------------------------------------------------------- distribuições

export interface DeviceBucket {
  device: string;
  count: number;
}

const cachedDeviceDistribution = unstable_cache(
  async (period: Period): Promise<DeviceBucket[]> => {
    const { start, end } = getPeriodRange(period);
    const rows = await prisma.click.groupBy({
      by: ["device"],
      where: { createdAt: { gte: start, lte: end } },
      _count: { _all: true },
    });
    return rows
      .map((r) => ({ device: r.device ?? "unknown", count: r._count._all }))
      .sort((a, b) => b.count - a.count);
  },
  ["dashboard-device-distribution"],
  { tags: [TAGS.metrics, TAGS.clicks] },
);

/// Distribuição de cliques por dispositivo (mobile/desktop/tablet/bot).
export function getDeviceDistribution(period: Period): Promise<DeviceBucket[]> {
  return cachedDeviceDistribution(period);
}

export interface DiscountBucket {
  range: string;
  count: number;
}

const DISCOUNT_RANGES: { range: string; min: number; max?: number }[] = [
  { range: "15–20%", min: 15, max: 20 },
  { range: "20–30%", min: 20, max: 30 },
  { range: "30–50%", min: 30, max: 50 },
  { range: "50%+", min: 50 },
];

const cachedDiscountDistribution = unstable_cache(
  async (period: Period): Promise<DiscountBucket[]> => {
    const { start, end } = getPeriodRange(period);
    const counts = await Promise.all(
      DISCOUNT_RANGES.map(({ min, max }) =>
        prisma.offer.count({
          where: {
            detectedAt: { gte: start, lte: end },
            discountPct: max !== undefined ? { gte: min, lt: max } : { gte: min },
          },
        }),
      ),
    );
    return DISCOUNT_RANGES.map((bucket, i) => ({ range: bucket.range, count: counts[i] }));
  },
  ["dashboard-discount-distribution"],
  { tags: [TAGS.metrics, TAGS.offers] },
);

/// Distribuição das ofertas do período por faixa de desconto.
export function getDiscountDistribution(period: Period): Promise<DiscountBucket[]> {
  return cachedDiscountDistribution(period);
}

// -------------------------------------------------------------- varreduras

export interface RecentScrapeRun {
  id: string;
  status: RunStatus;
  trigger: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  watchesTotal: number;
  watchesDone: number;
  itemsSeen: number;
  productsNew: number;
  offersNew: number;
  error: string | null;
}

const cachedRecentScrapeRuns = unstable_cache(
  async (limit: number): Promise<RecentScrapeRun[]> => {
    const runs = await prisma.scrapeRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    });
    return runs.map((r) => ({
      id: r.id,
      status: r.status,
      trigger: r.trigger,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      durationMs: r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null,
      watchesTotal: r.watchesTotal,
      watchesDone: r.watchesDone,
      itemsSeen: r.itemsSeen,
      productsNew: r.productsNew,
      offersNew: r.offersNew,
      error: r.error,
    }));
  },
  ["dashboard-recent-scrape-runs"],
  { tags: [TAGS.metrics, TAGS.runs] },
);

/// Últimas varreduras, mais recente primeiro. `limit` padrão cobre o card de
/// "última varredura" (pega o [0]) e uma mini-lista de histórico.
export function getRecentScrapeRuns(limit = 5): Promise<RecentScrapeRun[]> {
  return cachedRecentScrapeRuns(limit);
}

// ---------------------------------------------------------------- pre-sells

export interface TopPresell {
  id: string;
  slug: string;
  title: string;
  views: number;
  active: boolean;
}

const cachedTopPresells = unstable_cache(
  async (limit: number): Promise<TopPresell[]> => {
    return prisma.presell.findMany({
      orderBy: { views: "desc" },
      take: limit,
      select: { id: true, slug: true, title: true, views: true, active: true },
    });
  },
  ["dashboard-top-presells"],
  { tags: [TAGS.metrics, TAGS.presells] },
);

/// Pre-sells com mais visualizações.
export function getTopPresells(limit = 10): Promise<TopPresell[]> {
  return cachedTopPresells(limit);
}

// -------------------------------------------------------------------- vazio

const cachedHasAnyData = unstable_cache(
  async (): Promise<boolean> => {
    const [products, runs] = await Promise.all([
      prisma.product.count(),
      prisma.scrapeRun.count(),
    ]);
    return products > 0 || runs > 0;
  },
  ["dashboard-has-any-data"],
  { tags: [TAGS.metrics, TAGS.products, TAGS.runs] },
);

/// true assim que existir qualquer produto ou varredura — usado pra decidir
/// entre o dashboard normal e o EmptyState de "rode a primeira varredura".
export function getDashboardHasData(): Promise<boolean> {
  return cachedHasAnyData();
}
