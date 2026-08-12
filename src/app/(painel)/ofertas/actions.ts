"use server";

import { headers } from "next/headers";
import { OfferStatus, LinkKind } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { TAGS, bust } from "@/lib/cache";
import { createLink, publicUrl } from "@/lib/links";
import { getSettings } from "@/lib/settings";

// Os Server Actions moram aqui, e não junto das leituras em
// src/lib/data/offers.ts: componentes cliente só podem importar ações de um
// módulo com "use server" no topo do arquivo — importar do módulo de leitura
// arrastaria o Prisma para o bundle do navegador.

/// Marca uma oferta como publicada/ignorada/nova de volta.
export async function setOfferStatus(offerId: string, status: OfferStatus): Promise<void> {
  await prisma.offer.update({
    where: { id: offerId },
    data: { status, publishedAt: status === OfferStatus.PUBLISHED ? new Date() : null },
  });
  bust(TAGS.offers);
}

/// Ação em massa da seleção múltipla (marcar publicadas / ignorar).
export async function setOffersStatusBulk(offerIds: string[], status: OfferStatus): Promise<void> {
  if (offerIds.length === 0) return;
  await prisma.offer.updateMany({
    where: { id: { in: offerIds } },
    data: { status, publishedAt: status === OfferStatus.PUBLISHED ? new Date() : null },
  });
  bust(TAGS.offers);
}

/// Bloqueia o produto (não gera oferta nova) e ignora as ofertas NEW dele.
export async function blockProductFromOffer(productId: string): Promise<void> {
  await prisma.$transaction([
    prisma.product.update({ where: { id: productId }, data: { blocked: true } }),
    prisma.offer.updateMany({
      where: { productId, status: OfferStatus.NEW },
      data: { status: OfferStatus.IGNORED },
    }),
  ]);
  bust(TAGS.products);
}

export interface GenerateLinkInput {
  productId: string;
  kind: LinkKind;
  presellId?: string | null;
  label?: string | null;
}

export interface GeneratedLink {
  id: string;
  slug: string;
  kind: LinkKind;
  /// URL pública pronta pra copiar: /r/{slug}, /p/{slug} ou o destino direto.
  url: string;
}

/// Gera um Link para o produto e devolve a URL pública já montada — é o que
/// os botões "Gerar link" e "Copiar" dos cards consomem.
export async function generateLink(input: GenerateLinkInput): Promise<GeneratedLink> {
  const link = await createLink({
    productId: input.productId,
    kind: input.kind,
    presellId: input.presellId ?? null,
    label: input.label ?? null,
  });

  const settings = await getSettings();
  const hdrs = await headers();

  const url =
    link.kind === LinkKind.DIRECT
      ? link.targetUrl
      : publicUrl(
          link.kind === LinkKind.PRESELL ? `/p/${link.slug}` : `/r/${link.slug}`,
          settings,
          hdrs,
        );

  bust(TAGS.links);

  return { id: link.id, slug: link.slug, kind: link.kind, url };
}

// ------------------------------------------------- histórico de preço (Sheet)

/// Janela padrão do gráfico. 90 dias cobre bem mais que os 30 do sparkline
/// do card sem virar um paredão de pontos.
const TIMELINE_DAYS = 90;
/// Teto de pontos plotados. O histórico ganha uma linha por varredura, então
/// um produto antigo pode ter milhares: cortamos no banco (take), nunca em JS.
const TIMELINE_MAX_POINTS = 240;

export interface PriceTimelinePoint {
  price: number;
  capturedAt: string;
}

export interface PriceTimelineOffer {
  id: string;
  price: number;
  referencePrice: number;
  referenceKind: string;
  discountPct: number;
  score: number;
  status: OfferStatus;
  detectedAt: string;
}

export interface PriceTimeline {
  productId: string;
  title: string;
  /// Preço atual do anúncio, em centavos.
  currentPrice: number;
  /// Quando o produto entrou no painel pela primeira vez.
  firstSeenAt: string;
  /// Dias cobertos pelo gráfico.
  days: number;
  /// Pontos em ordem cronológica, já limitados a TIMELINE_MAX_POINTS.
  points: PriceTimelinePoint[];
  /// Quantas capturas existem no período (pode ser maior que points.length).
  pointsInPeriod: number;
  /// Menor/maior preço do período, agregados no banco.
  minPrice: number | null;
  maxPrice: number | null;
  /// Momentos em que o produto virou oferta dentro do período.
  offers: PriceTimelineOffer[];
}

/// Carrega o histórico de preço de um produto para o Sheet "Ver histórico de
/// preço". Devolve também as ofertas detectadas no período, pra marcar no
/// gráfico em que momentos o produto virou oferta. Min e max saem de um
/// aggregate no banco, não de um Math.min sobre um array gigante.
export async function getPriceTimeline(productId: string): Promise<PriceTimeline | null> {
  const since = new Date(Date.now() - TIMELINE_DAYS * 24 * 60 * 60 * 1000);

  const [product, recentPoints, aggregate, offers] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, price: true, firstSeenAt: true },
    }),
    prisma.priceHistory.findMany({
      where: { productId, capturedAt: { gte: since } },
      orderBy: { capturedAt: "desc" },
      take: TIMELINE_MAX_POINTS,
      select: { price: true, capturedAt: true },
    }),
    prisma.priceHistory.aggregate({
      where: { productId, capturedAt: { gte: since } },
      _min: { price: true },
      _max: { price: true },
      _count: { _all: true },
    }),
    prisma.offer.findMany({
      where: { productId, detectedAt: { gte: since } },
      orderBy: { detectedAt: "desc" },
      take: 50,
      select: {
        id: true,
        price: true,
        referencePrice: true,
        referenceKind: true,
        discountPct: true,
        score: true,
        status: true,
        detectedAt: true,
      },
    }),
  ]);

  if (!product) return null;

  return {
    productId: product.id,
    title: product.title,
    currentPrice: product.price,
    firstSeenAt: product.firstSeenAt.toISOString(),
    days: TIMELINE_DAYS,
    // findMany veio do mais novo pro mais antigo (pra o take pegar o final da
    // série); o gráfico precisa da ordem cronológica.
    points: recentPoints
      .map((p) => ({ price: p.price, capturedAt: p.capturedAt.toISOString() }))
      .reverse(),
    pointsInPeriod: aggregate._count._all,
    minPrice: aggregate._min.price,
    maxPrice: aggregate._max.price,
    offers: offers
      .map((o) => ({
        id: o.id,
        price: o.price,
        referencePrice: o.referencePrice,
        referenceKind: o.referenceKind,
        discountPct: o.discountPct,
        score: o.score,
        status: o.status,
        detectedAt: o.detectedAt.toISOString(),
      }))
      .reverse(),
  };
}
