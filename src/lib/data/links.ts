import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TAGS } from "@/lib/cache";
import { LinkKind, Prisma } from "@/generated/prisma";
import type { LinkPeriod, LinkSort } from "@/lib/link-filters";

// ------------------------------------------------------------------ filtros

export type { LinkPeriod, LinkSort } from "@/lib/link-filters";

export interface LinkFilters {
  kind?: LinkKind;
  active?: boolean;
  q?: string;
  period?: LinkPeriod;
  sort?: LinkSort;
}

function periodStart(period?: LinkPeriod): Date | undefined {
  if (!period || period === "all") return undefined;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function buildWhere(filters: LinkFilters): Prisma.LinkWhereInput {
  const where: Prisma.LinkWhereInput = {};
  if (filters.kind) where.kind = filters.kind;
  if (filters.active !== undefined) where.active = filters.active;

  const start = periodStart(filters.period);
  if (start) where.createdAt = { gte: start };

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { slug: { contains: q, mode: "insensitive" } },
      { label: { contains: q, mode: "insensitive" } },
      { product: { title: { contains: q, mode: "insensitive" } } },
    ];
  }
  return where;
}

function buildOrderBy(sort?: LinkSort): Prisma.LinkOrderByWithRelationInput {
  switch (sort) {
    case "clicks-asc":
      return { clickCount: "asc" };
    case "createdAt-desc":
      return { createdAt: "desc" };
    case "createdAt-asc":
      return { createdAt: "asc" };
    case "clicks-desc":
    default:
      return { clickCount: "desc" };
  }
}

// -------------------------------------------------------------------- lista

export interface LinkListRow {
  id: string;
  slug: string;
  kind: LinkKind;
  label: string | null;
  targetUrl: string;
  affiliate: boolean;
  clickCount: number;
  active: boolean;
  createdAt: Date;
  product: { title: string; thumbnail: string | null } | null;
  presell: { slug: string; title: string } | null;
  /// Click.duplicate = false
  uniqueClicks: number;
  lastClickAt: Date | null;
}

// Teto de segurança — o painel é de uso interno e não pagina a tabela ainda.
const LIST_TAKE = 300;

async function fetchLinks(filters: LinkFilters): Promise<LinkListRow[]> {
  const links = await prisma.link.findMany({
    where: buildWhere(filters),
    orderBy: buildOrderBy(filters.sort),
    take: LIST_TAKE,
    include: {
      product: { select: { title: true, thumbnail: true } },
      presell: { select: { slug: true, title: true } },
    },
  });

  const ids = links.map((l) => l.id);
  const [uniqueGroups, lastGroups] = ids.length
    ? await Promise.all([
        prisma.click.groupBy({
          by: ["linkId"],
          where: { linkId: { in: ids }, duplicate: false },
          _count: { _all: true },
        }),
        prisma.click.groupBy({
          by: ["linkId"],
          where: { linkId: { in: ids } },
          _max: { createdAt: true },
        }),
      ])
    : [[], []];

  const uniqueMap = new Map(uniqueGroups.map((g) => [g.linkId, g._count._all]));
  const lastMap = new Map(lastGroups.map((g) => [g.linkId, g._max.createdAt]));

  return links.map((l) => ({
    ...l,
    uniqueClicks: uniqueMap.get(l.id) ?? 0,
    lastClickAt: lastMap.get(l.id) ?? null,
  }));
}

export const listLinks = unstable_cache(fetchLinks, ["links-list"], {
  tags: [TAGS.links, TAGS.clicks],
});

// -------------------------------------------------------------------- stats

export interface LinkStats {
  totalLinks: number;
  totalClicks: number;
  clicksToday: number;
  topLink: {
    id: string;
    slug: string;
    label: string | null;
    productTitle: string | null;
    clickCount: number;
  } | null;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function fetchLinkStats(): Promise<LinkStats> {
  const [totalLinks, clicksAgg, clicksToday, top] = await Promise.all([
    prisma.link.count(),
    prisma.link.aggregate({ _sum: { clickCount: true } }),
    prisma.click.count({ where: { createdAt: { gte: startOfToday() }, duplicate: false } }),
    prisma.link.findFirst({
      orderBy: { clickCount: "desc" },
      include: { product: { select: { title: true } } },
    }),
  ]);

  return {
    totalLinks,
    totalClicks: clicksAgg._sum.clickCount ?? 0,
    clicksToday,
    topLink:
      top && top.clickCount > 0
        ? {
            id: top.id,
            slug: top.slug,
            label: top.label,
            productTitle: top.product?.title ?? null,
            clickCount: top.clickCount,
          }
        : null,
  };
}

export const getLinkStats = unstable_cache(fetchLinkStats, ["links-stats"], {
  tags: [TAGS.links, TAGS.clicks],
});

// ------------------------------------------------------------------- detail

export interface LinkDetail {
  id: string;
  slug: string;
  kind: LinkKind;
  label: string | null;
  targetUrl: string;
  affiliate: boolean;
  clickCount: number;
  active: boolean;
  createdAt: Date;
  product: { title: string; thumbnail: string | null } | null;
  presell: { slug: string; title: string } | null;
  clicksByDay: { day: string; count: number }[];
  byDevice: { device: string; count: number }[];
  topReferrers: { referer: string; count: number }[];
  recentClicks: {
    id: string;
    createdAt: Date;
    device: string | null;
    country: string | null;
    duplicate: boolean;
  }[];
}

const DETAIL_WINDOW_DAYS = 30;

async function fetchLinkDetail(id: string): Promise<LinkDetail | null> {
  const link = await prisma.link.findUnique({
    where: { id },
    include: {
      product: { select: { title: true, thumbnail: true } },
      presell: { select: { slug: true, title: true } },
    },
  });
  if (!link) return null;

  const since = new Date(Date.now() - DETAIL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [dailyRows, byDeviceGroups, referrerGroups, recentClicks] = await Promise.all([
    // date_trunc via SQL — o Prisma não trunca datetime em groupBy.
    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") as day, count(*)::bigint as count
      FROM "Click"
      WHERE "linkId" = ${id} AND "createdAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `,
    prisma.click.groupBy({
      by: ["device"],
      where: { linkId: id },
      _count: { _all: true },
    }),
    prisma.click.groupBy({
      by: ["referer"],
      where: { linkId: id, referer: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { referer: "desc" } },
      take: 5,
    }),
    prisma.click.findMany({
      where: { linkId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, createdAt: true, device: true, country: true, duplicate: true },
    }),
  ]);

  // Preenche os dias sem clique com zero — apenas formatação, sem somar nada.
  const dayMap = new Map(
    dailyRows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]),
  );
  const clicksByDay: { day: string; count: number }[] = [];
  for (let i = DETAIL_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    clicksByDay.push({ day: key, count: dayMap.get(key) ?? 0 });
  }

  return {
    id: link.id,
    slug: link.slug,
    kind: link.kind,
    label: link.label,
    targetUrl: link.targetUrl,
    affiliate: link.affiliate,
    clickCount: link.clickCount,
    active: link.active,
    createdAt: link.createdAt,
    product: link.product,
    presell: link.presell,
    clicksByDay,
    byDevice: byDeviceGroups.map((g) => ({
      device: g.device ?? "desconhecido",
      count: g._count._all,
    })),
    topReferrers: referrerGroups.map((g) => ({
      referer: g.referer ?? "direto",
      count: g._count._all,
    })),
    recentClicks,
  };
}

export const getLinkDetail = unstable_cache(fetchLinkDetail, ["link-detail"], {
  tags: [TAGS.links, TAGS.clicks],
});
