"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLink, slugify } from "@/lib/links";
import { TAGS, bust } from "@/lib/cache";
import { toCents } from "@/lib/format";
import { LinkKind } from "@/generated/prisma";
import {
  isReservedSlug,
  isSlugAvailable,
  listPresellLinks,
  searchProducts,
  type PresellLinkRow,
  type ProductSearchResult,
} from "@/lib/data/presells";

import type { ActionState } from "./action-state";

// ------------------------------------------------------------------- schema

const presellSchema = z
  .object({
    id: z.string().trim().optional(),
    title: z.string().trim().min(1, "Dê um nome ao modelo.").max(200),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Informe o endereço do link.")
      .max(80, "Máximo de 80 caracteres.")
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Use letras minúsculas, números e hífen entre as palavras.",
      ),
    // vazio é permitido: sem chamada escrita, a página usa o nome do produto.
    headline: z.string().trim().max(300).optional(),
    body: z.string().trim().max(4000).optional(),
    ctaText: z.string().trim().min(1, "Informe o texto do botão.").max(60),
    imageUrl: z.string().trim().max(2000).optional(),
    priceLabelReais: z.string().trim().optional(),
    originalLabelReais: z.string().trim().optional(),
    gateUrl: z.string().trim().optional(),
    gateLabel: z.string().trim().min(1, "Informe o texto do botão do parceiro.").max(80),
    gateDelay: z.coerce.number().int().min(0).max(30),
    isDefault: z.coerce.boolean().optional(),
    linkMode: z.enum(["none", "existing", "new"]),
    existingLinkId: z.string().trim().optional(),
    newProductId: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (isReservedSlug(data.slug)) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: "Esse endereço é usado por uma tela do sistema. Escolha outro.",
      });
    }
    // a imagem pode ser um endereço fixo ou a variável {{imagem}} — só o
    // endereço fixo precisa parecer um endereço de verdade.
    if (data.imageUrl && !data.imageUrl.includes("{{") && !/^https?:\/\//i.test(data.imageUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["imageUrl"],
        message: "Cole um endereço começando com http, ou use {{imagem}}.",
      });
    }
    if (data.gateUrl && !/^https?:\/\//i.test(data.gateUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["gateUrl"],
        message: "Cole um endereço começando com http.",
      });
    }
    if (data.linkMode === "existing" && !data.existingLinkId) {
      ctx.addIssue({
        code: "custom",
        path: ["existingLinkId"],
        message: "Selecione um link.",
      });
    }
    if (data.linkMode === "new" && !data.newProductId) {
      ctx.addIssue({
        code: "custom",
        path: ["newProductId"],
        message: "Selecione um produto.",
      });
    }
  });

// ------------------------------------------------------------- criar/editar

/// Desassocia da pre-sell qualquer link de saída atual (kind != PRESELL),
/// exceto o que estamos prestes a manter/associar — evita ficar com dois
/// links de saída simultâneos para a mesma pre-sell.
async function detachOtherExitLinks(presellId: string, keepLinkId?: string) {
  await prisma.link.updateMany({
    where: {
      presellId,
      kind: { not: LinkKind.PRESELL },
      ...(keepLinkId ? { id: { not: keepLinkId } } : {}),
    },
    data: { presellId: null },
  });
}

/// Só um modelo pode ser o padrão. Desmarca todos os outros.
async function clearOtherDefaults(presellId: string) {
  await prisma.presell.updateMany({
    where: { isDefault: true, id: { not: presellId } },
    data: { isDefault: false },
  });
}

export async function upsertPresellAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = presellSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    slug: formData.get("slug"),
    headline: formData.get("headline") || undefined,
    body: formData.get("body") || undefined,
    ctaText: formData.get("ctaText"),
    imageUrl: formData.get("imageUrl") || undefined,
    priceLabelReais: formData.get("priceLabelReais") || undefined,
    originalLabelReais: formData.get("originalLabelReais") || undefined,
    gateUrl: formData.get("gateUrl") || undefined,
    gateLabel: formData.get("gateLabel"),
    gateDelay: formData.get("gateDelay") ?? 0,
    isDefault: formData.get("isDefault") === "1",
    linkMode: formData.get("linkMode") ?? "none",
    existingLinkId: formData.get("existingLinkId") || undefined,
    newProductId: formData.get("newProductId") || undefined,
  });

  if (!parsed.success) {
    return {
      error: "Verifique os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  const slugFree = await isSlugAvailable(data.slug, data.id);
  if (!slugFree) {
    return {
      error: "Esse endereço já está em uso.",
      fieldErrors: { slug: ["Esse endereço já está em uso."] },
    };
  }

  if (data.linkMode === "existing" && data.existingLinkId) {
    const link = await prisma.link.findUnique({ where: { id: data.existingLinkId } });
    if (!link || link.kind === LinkKind.PRESELL) {
      return {
        error: "O link escolhido não serve para essa função.",
        fieldErrors: { existingLinkId: ["Escolha outro link."] },
      };
    }
  }

  const priceLabel = data.priceLabelReais ? toCents(data.priceLabelReais) : null;
  const originalLabel = data.originalLabelReais ? toCents(data.originalLabelReais) : null;

  const values = {
    slug: data.slug,
    title: data.title,
    headline: data.headline || null,
    body: data.body || null,
    ctaText: data.ctaText,
    gateUrl: data.gateUrl || null,
    gateLabel: data.gateLabel,
    gateDelay: data.gateDelay,
    imageUrl: data.imageUrl || null,
    priceLabel,
    originalLabel,
    isDefault: Boolean(data.isDefault),
  };

  const presell = data.id
    ? await prisma.presell.update({ where: { id: data.id }, data: values })
    : await prisma.presell.create({ data: values });

  if (values.isDefault) await clearOtherDefaults(presell.id);

  // ------------------------------------------------------ link de saída
  if (data.linkMode === "existing" && data.existingLinkId) {
    await detachOtherExitLinks(presell.id, data.existingLinkId);
    await prisma.link.update({
      where: { id: data.existingLinkId },
      data: { presellId: presell.id },
    });
  } else if (data.linkMode === "new" && data.newProductId) {
    await detachOtherExitLinks(presell.id);
    await createLink({
      productId: data.newProductId,
      kind: LinkKind.TRACKED,
      presellId: presell.id,
    });
  } else if (data.linkMode === "none") {
    await detachOtherExitLinks(presell.id);
  }

  bust(TAGS.presells, TAGS.links);
  return { success: true, presellId: presell.id, slug: presell.slug };
}

// --------------------------------------------------------------- duplicar

export async function duplicatePresellAction(id: string): Promise<ActionState> {
  const original = await prisma.presell.findUnique({ where: { id } });
  if (!original) return { error: "Modelo não encontrado." };

  const base = slugify(`${original.title}-copia`) || "presell-copia";
  let slug = base;
  let attempt = 1;
  while (!(await isSlugAvailable(slug))) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  const copy = await prisma.presell.create({
    data: {
      slug,
      title: `${original.title} (cópia)`,
      headline: original.headline,
      body: original.body,
      ctaText: original.ctaText,
      gateUrl: original.gateUrl,
      gateLabel: original.gateLabel,
      gateDelay: original.gateDelay,
      imageUrl: original.imageUrl,
      priceLabel: original.priceLabel,
      originalLabel: original.originalLabel,
      // a cópia nunca nasce como padrão e nasce desligada — evita duas
      // páginas publicadas com o mesmo conteúdo ao mesmo tempo.
      isDefault: false,
      active: false,
    },
  });

  bust(TAGS.presells);
  return { success: true, presellId: copy.id, slug: copy.slug };
}

// ----------------------------------------------------------- ligar/excluir

export async function setPresellActiveAction(id: string, active: boolean): Promise<void> {
  await prisma.presell.update({
    where: { id },
    // um modelo desligado não pode continuar sendo o padrão: os links novos
    // ficariam sem página.
    data: active ? { active } : { active, isDefault: false },
  });
  bust(TAGS.presells);
}

/// Marca o modelo que será usado quando um link "com página de aquecimento"
/// for gerado sem escolha de modelo. Passar o mesmo id de novo desmarca.
export async function setDefaultPresellAction(id: string, isDefault: boolean): Promise<void> {
  if (isDefault) {
    await prisma.$transaction([
      prisma.presell.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      }),
      prisma.presell.update({ where: { id }, data: { isDefault: true, active: true } }),
    ]);
  } else {
    await prisma.presell.update({ where: { id }, data: { isDefault: false } });
  }
  bust(TAGS.presells);
}

/// Links que apontavam pra esse modelo apenas perdem a referência
/// (onDelete: SetNull) — não são apagados. Quem já tiver o endereço na mão
/// continua caindo no modelo padrão.
export async function deletePresellAction(id: string): Promise<void> {
  await prisma.presell.delete({ where: { id } });
  bust(TAGS.presells, TAGS.links);
}

// -------------------------------------------------------- checagens ao vivo

export async function checkSlugAvailableAction(
  slug: string,
  excludeId?: string,
): Promise<{ available: boolean; reserved: boolean }> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return { available: false, reserved: false };
  return {
    available: await isSlugAvailable(clean, excludeId),
    reserved: isReservedSlug(clean),
  };
}

export async function searchProductsAction(query: string): Promise<ProductSearchResult[]> {
  return searchProducts(query);
}

/// Alimenta a janela "links que usam este modelo".
export async function listPresellLinksAction(presellId: string): Promise<PresellLinkRow[]> {
  return listPresellLinks(presellId);
}

/// slugify() é server-only (lib/links.ts importa "server-only"), então o
/// editor — que é client component — precisa desse wrapper pra sugerir o
/// endereço a partir do nome sem reimplementar a função.
export async function slugifyAction(text: string): Promise<string> {
  return slugify(text);
}
