"use server";

import { OfferStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { TAGS, bust } from "@/lib/cache";
import { loadProductDetail, type ProductDetail } from "@/lib/data/products";

// Os Server Actions moram aqui, e não junto das leituras em
// src/lib/data/products.ts: componentes cliente só podem importar ações de um
// módulo com "use server" no topo do arquivo — importar do módulo de leitura
// arrastaria o Prisma para o bundle do navegador.

/// Chamada pelo Sheet ao clicar numa linha — não passa por unstable_cache
/// porque o detalhe é sob demanda e já reflete o dado atual.
export async function getProductDetail(productId: string): Promise<ProductDetail | null> {
  return loadProductDetail(productId);
}

/// Bloqueia/desbloqueia o produto. Produto bloqueado não gera oferta nova
/// (checado em scraper/run.ts).
export async function setProductBlocked(productId: string, blocked: boolean): Promise<void> {
  await prisma.product.update({ where: { id: productId }, data: { blocked } });
  if (blocked) {
    await prisma.offer.updateMany({
      where: { productId, status: OfferStatus.NEW },
      data: { status: OfferStatus.IGNORED },
    });
  }
  bust(TAGS.products);
}
