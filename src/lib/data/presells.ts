import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TAGS } from "@/lib/cache";
import { LinkKind } from "@/generated/prisma";

// -------------------------------------------------------------------- lista

export interface PresellListRow {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  active: boolean;
  views: number;
  createdAt: Date;
  /// Soma de clickCount de todos os Links associados (via Link.presellId).
  linkClicks: number;
}

async function fetchPresells(): Promise<PresellListRow[]> {
  const [presells, clickSums] = await Promise.all([
    prisma.presell.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        imageUrl: true,
        active: true,
        views: true,
        createdAt: true,
      },
    }),
    // soma feita no banco (_sum) — nunca somamos linhas em JS.
    prisma.link.groupBy({
      by: ["presellId"],
      where: { presellId: { not: null } },
      _sum: { clickCount: true },
    }),
  ]);

  const sumMap = new Map(clickSums.map((g) => [g.presellId as string, g._sum.clickCount ?? 0]));

  return presells.map((p) => ({ ...p, linkClicks: sumMap.get(p.id) ?? 0 }));
}

export const listPresells = unstable_cache(fetchPresells, ["presells-list"], {
  tags: [TAGS.presells, TAGS.links],
});

// ------------------------------------------------------------------- edição

export interface PresellForEdit {
  id: string;
  slug: string;
  title: string;
  headline: string;
  body: string | null;
  ctaText: string;
  gateUrl: string | null;
  gateLabel: string;
  gateDelay: number;
  imageUrl: string | null;
  priceLabel: number | null;
  originalLabel: number | null;
  active: boolean;
  /// Link de saída atualmente associado (kind != PRESELL), quando existir.
  exitLinkId: string | null;
}

async function fetchPresellForEdit(id: string): Promise<PresellForEdit | null> {
  const presell = await prisma.presell.findUnique({
    where: { id },
    include: {
      links: { where: { kind: { not: LinkKind.PRESELL } }, select: { id: true }, take: 1 },
    },
  });
  if (!presell) return null;

  return {
    id: presell.id,
    slug: presell.slug,
    title: presell.title,
    headline: presell.headline,
    body: presell.body,
    ctaText: presell.ctaText,
    gateUrl: presell.gateUrl,
    gateLabel: presell.gateLabel,
    gateDelay: presell.gateDelay,
    imageUrl: presell.imageUrl,
    priceLabel: presell.priceLabel,
    originalLabel: presell.originalLabel,
    active: presell.active,
    exitLinkId: presell.links[0]?.id ?? null,
  };
}

export const getPresellForEdit = unstable_cache(fetchPresellForEdit, ["presell-edit"], {
  tags: [TAGS.presells, TAGS.links],
});

// ------------------------------------------------------- links elegíveis p/ CTA

export interface EligibleLink {
  id: string;
  slug: string;
  label: string | null;
  kind: LinkKind;
  productTitle: string | null;
}

/// Links que podem servir de "botão final" de uma pre-sell: precisam ter
/// kind != PRESELL (senão criaria um loop) e estar livres (sem presell) ou
/// já pertencerem a esta mesma pre-sell (edição).
async function fetchEligibleLinks(excludePresellId?: string): Promise<EligibleLink[]> {
  const links = await prisma.link.findMany({
    where: {
      kind: { not: LinkKind.PRESELL },
      OR: [{ presellId: null }, ...(excludePresellId ? [{ presellId: excludePresellId }] : [])],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      slug: true,
      label: true,
      kind: true,
      product: { select: { title: true } },
    },
  });

  return links.map((l) => ({
    id: l.id,
    slug: l.slug,
    label: l.label,
    kind: l.kind,
    productTitle: l.product?.title ?? null,
  }));
}

export const listEligibleLinks = unstable_cache(fetchEligibleLinks, ["presell-eligible-links"], {
  tags: [TAGS.links, TAGS.presells],
});

// -------------------------------------------------------------- slug único

const RESERVED_SLUGS = [
  "r",
  "p",
  "api",
  "login",
  "dashboard",
  "ofertas",
  "produtos",
  "links",
  "presells",
  "frases",
  "whatsapp",
  "configuracoes",
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug);
}

/// Checagem sempre fresca (sem cache) — usada tanto na validação do
/// servidor quanto na checagem interativa de disponibilidade no editor.
export async function isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
  if (isReservedSlug(slug)) return false;
  const existing = await prisma.presell.findUnique({ where: { slug }, select: { id: true } });
  if (!existing) return true;
  return existing.id === excludeId;
}

// ---------------------------------------------------------------- produtos

export interface ProductSearchResult {
  id: string;
  title: string;
  thumbnail: string | null;
  price: number;
}

/// Busca "ao vivo" para o combobox de produto no editor. Sem unstable_cache
/// de propósito: é interativa, chaveada por texto livre digitado pelo
/// usuário, então cachear não ajudaria e só atrasaria a atualização.
export async function searchProducts(query: string): Promise<ProductSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const products = await prisma.product.findMany({
    where: { title: { contains: q, mode: "insensitive" }, blocked: false },
    orderBy: { lastSeenAt: "desc" },
    take: 8,
    select: { id: true, title: true, thumbnail: true, price: true },
  });
  return products;
}
