import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TAGS } from "@/lib/cache";
import { LinkKind } from "@/generated/prisma";
import type { PresellProduct, PresellTemplate } from "@/app/(painel)/presells/presell-template";

// -------------------------------------------------------------------- lista

export interface PresellListRow {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  imageUrl: string | null;
  active: boolean;
  isDefault: boolean;
  views: number;
  createdAt: Date;
  /// Quantos links já usam este modelo. É o número que mostra que um modelo
  /// só está servindo vários produtos.
  linkCount: number;
  /// Soma de clickCount de todos os Links associados (via Link.presellId).
  linkClicks: number;
}

async function fetchPresells(): Promise<PresellListRow[]> {
  const [presells, linkStats] = await Promise.all([
    prisma.presell.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        headline: true,
        imageUrl: true,
        active: true,
        isDefault: true,
        views: true,
        createdAt: true,
      },
    }),
    // contagem e soma feitas no banco — nunca somamos linhas em JS.
    prisma.link.groupBy({
      by: ["presellId"],
      where: { presellId: { not: null } },
      _sum: { clickCount: true },
      _count: { _all: true },
    }),
  ]);

  const statMap = new Map(
    linkStats.map((g) => [
      g.presellId as string,
      { clicks: g._sum.clickCount ?? 0, count: g._count._all },
    ]),
  );

  return presells.map((p) => ({
    ...p,
    linkCount: statMap.get(p.id)?.count ?? 0,
    linkClicks: statMap.get(p.id)?.clicks ?? 0,
  }));
}

export const listPresells = unstable_cache(fetchPresells, ["presells-list"], {
  tags: [TAGS.presells, TAGS.links],
});

// ------------------------------------------------------------------- edição

export interface PresellForEdit {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  body: string | null;
  ctaText: string;
  gateUrl: string | null;
  gateLabel: string;
  gateDelay: number;
  imageUrl: string | null;
  priceLabel: number | null;
  originalLabel: number | null;
  active: boolean;
  isDefault: boolean;
  /// Link de saída atualmente associado (kind != PRESELL), quando existir.
  exitLinkId: string | null;
  /// Quantos links já usam este modelo.
  linkCount: number;
}

async function fetchPresellForEdit(id: string): Promise<PresellForEdit | null> {
  const presell = await prisma.presell.findUnique({
    where: { id },
    include: {
      links: { where: { kind: { not: LinkKind.PRESELL } }, select: { id: true }, take: 1 },
      _count: { select: { links: { where: { kind: LinkKind.PRESELL } } } },
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
    isDefault: presell.isDefault,
    exitLinkId: presell.links[0]?.id ?? null,
    linkCount: presell._count.links,
  };
}

export const getPresellForEdit = unstable_cache(fetchPresellForEdit, ["presell-edit"], {
  tags: [TAGS.presells, TAGS.links],
});

// ------------------------------------------------------------ modelo padrão

/// Modelo marcado como padrão. É o que a tela de ofertas deve usar quando o
/// usuário pede um link "com página de aquecimento" sem escolher o modelo.
/// A página pública também cai aqui quando o link foi gerado sem modelo.
async function fetchDefaultPresell() {
  return prisma.presell.findFirst({
    where: { isDefault: true, active: true },
    select: { id: true, slug: true, title: true },
  });
}

export const getDefaultPresell = unstable_cache(fetchDefaultPresell, ["presell-default"], {
  tags: [TAGS.presells],
});

// -------------------------------------------------- links que usam o modelo

export interface PresellLinkRow {
  id: string;
  slug: string;
  productTitle: string | null;
  productThumbnail: string | null;
  clickCount: number;
  active: boolean;
  createdAt: Date;
}

/// Os links gerados em cima deste modelo, do mais novo para o mais antigo.
/// Sem cache: é uma consulta pontual, aberta sob demanda numa janela.
export async function listPresellLinks(presellId: string): Promise<PresellLinkRow[]> {
  const links = await prisma.link.findMany({
    where: { presellId, kind: LinkKind.PRESELL },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      slug: true,
      clickCount: true,
      active: true,
      createdAt: true,
      product: { select: { title: true, thumbnail: true } },
    },
  });

  return links.map((l) => ({
    id: l.id,
    slug: l.slug,
    productTitle: l.product?.title ?? null,
    productThumbnail: l.product?.thumbnail ?? null,
    clickCount: l.clickCount,
    active: l.active,
    createdAt: l.createdAt,
  }));
}

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
/// Também confere os slugs de Link: /p/{endereço} resolve primeiro pelo link,
/// então um modelo não pode roubar um endereço já publicado.
export async function isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
  if (isReservedSlug(slug)) return false;

  const [presell, link] = await Promise.all([
    prisma.presell.findUnique({ where: { slug }, select: { id: true } }),
    prisma.link.findUnique({ where: { slug }, select: { id: true } }),
  ]);

  if (link) return false;
  if (!presell) return true;
  return presell.id === excludeId;
}

// ---------------------------------------------------------------- produtos

export interface ProductSearchResult {
  id: string;
  title: string;
  thumbnail: string | null;
  price: number;
  originalPrice: number | null;
}

const PRODUCT_FIELDS = {
  id: true,
  title: true,
  thumbnail: true,
  price: true,
  originalPrice: true,
} as const;

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
    select: PRODUCT_FIELDS,
  });
  return products;
}

/// Produtos reais para o preview do editor. Prioriza quem tem oferta viva —
/// é assim que o modelo vai aparecer na prática, com "de/por" e desconto.
async function fetchPreviewProducts(): Promise<PresellProduct[]> {
  const withOffer = await prisma.product.findMany({
    where: { blocked: false, offers: { some: {} } },
    orderBy: { lastSeenAt: "desc" },
    take: 12,
    select: PRODUCT_FIELDS,
  });

  if (withOffer.length >= 6) return withOffer;

  const rest = await prisma.product.findMany({
    where: { blocked: false, id: { notIn: withOffer.map((p) => p.id) } },
    orderBy: { lastSeenAt: "desc" },
    take: 12 - withOffer.length,
    select: PRODUCT_FIELDS,
  });

  return [...withOffer, ...rest];
}

export const listPreviewProducts = unstable_cache(fetchPreviewProducts, ["presell-preview-products"], {
  tags: [TAGS.products, TAGS.offers],
});

// ------------------------------------------------------- resolução pública

export interface ResolvedPresellPage {
  presellId: string;
  template: PresellTemplate;
  product: PresellProduct | null;
  /// Para onde o botão final aponta.
  ctaHref: string | null;
}

/// Só o que a página pública precisa do modelo. Selecionado campo a campo de
/// propósito: a rota pública é a mais quente do sistema e não tem por que
/// trazer contadores nem controles do painel.
const TEMPLATE_FIELDS = {
  id: true,
  active: true,
  title: true,
  headline: true,
  body: true,
  ctaText: true,
  imageUrl: true,
  priceLabel: true,
  originalLabel: true,
  gateUrl: true,
  gateLabel: true,
  gateDelay: true,
} as const;

const PRODUCT_PAGE_FIELDS = {
  id: true,
  title: true,
  thumbnail: true,
  price: true,
  originalPrice: true,
} as const;

/// Resolve o que a rota pública /p/{endereço} deve mostrar.
///
/// 1. O endereço é de um Link "com página de aquecimento": o modelo vem do
///    link (ou do modelo padrão, quando o link foi gerado sem escolher um) e
///    o conteúdo vem do produto do link. É o caminho novo, um modelo servindo
///    centenas de produtos.
/// 2. O endereço é de um modelo avulso: comportamento antigo, conteúdo fixo e
///    botão final no link de saída associado. Mantém de pé tudo que já foi
///    divulgado antes desta mudança.
export async function resolvePresellPage(slug: string): Promise<ResolvedPresellPage | null> {
  const link = await prisma.link.findUnique({
    where: { slug },
    select: {
      slug: true,
      kind: true,
      active: true,
      presell: { select: TEMPLATE_FIELDS },
      product: { select: PRODUCT_PAGE_FIELDS },
    },
  });

  if (link && link.active && link.kind === LinkKind.PRESELL) {
    let presell = link.presell;

    // link gerado "com página de aquecimento" sem escolher o modelo, ou com um
    // modelo que foi desligado/excluído: cai no modelo padrão. É o que permite
    // divulgar centenas de ofertas sem escolher o modelo uma por uma.
    if (!presell || !presell.active) {
      const fallbackId = (await getDefaultPresell())?.id;
      presell = fallbackId
        ? await prisma.presell.findUnique({ where: { id: fallbackId }, select: TEMPLATE_FIELDS })
        : null;
    }

    if (presell?.active) {
      return {
        presellId: presell.id,
        template: presell,
        product: link.product,
        // conta o clique e leva ao destino final sem passar por /r, que
        // devolveria o visitante para esta mesma página.
        ctaHref: `/p/${link.slug}/ir`,
      };
    }
  }

  const presell = await prisma.presell.findFirst({
    where: { slug, active: true },
    select: {
      ...TEMPLATE_FIELDS,
      links: {
        where: { active: true, kind: { not: LinkKind.PRESELL } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { slug: true },
      },
    },
  });
  if (!presell) return null;

  const exit = presell.links[0];
  return {
    presellId: presell.id,
    template: presell,
    product: null,
    ctaHref: exit ? `/r/${exit.slug}` : null,
  };
}
