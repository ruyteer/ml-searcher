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
