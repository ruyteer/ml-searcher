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
  searchProducts,
  type ProductSearchResult,
} from "@/lib/data/presells";

import type { ActionState } from "./action-state";

// ------------------------------------------------------------------- schema

const presellSchema = z
  .object({
    id: z.string().trim().optional(),
    title: z.string().trim().min(1, "Informe um título.").max(200),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Informe um slug.")
      .max(80, "Máximo de 80 caracteres.")
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens (kebab-case)."),
    headline: z.string().trim().min(1, "Informe a headline.").max(300),
    body: z.string().trim().max(4000).optional(),
    ctaText: z.string().trim().min(1, "Informe o texto do botão.").max(60),
    imageUrl: z
      .string()
      .trim()
      .url("URL de imagem inválida.")
      .optional()
      .or(z.literal("")),
    priceLabelReais: z.string().trim().optional(),
    originalLabelReais: z.string().trim().optional(),
    gateUrl: z.string().trim().optional(),
    gateLabel: z.string().trim().min(1, "Informe o rótulo do gate.").max(80),
    gateDelay: z.coerce.number().int().min(0).max(30),
    linkMode: z.enum(["none", "existing", "new"]),
    existingLinkId: z.string().trim().optional(),
    newProductId: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (isReservedSlug(data.slug)) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: "Esse slug é reservado por uma rota do sistema.",
      });
    }
    if (data.gateUrl && !/^https?:\/\//i.test(data.gateUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["gateUrl"],
        message: "Informe uma URL http(s) válida.",
      });
    }
    if (data.linkMode === "existing" && !data.existingLinkId) {
      ctx.addIssue({
        code: "custom",
        path: ["existingLinkId"],
        message: "Selecione um link existente.",
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

export async function upsertPresellAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = presellSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    slug: formData.get("slug"),
    headline: formData.get("headline"),
    body: formData.get("body") || undefined,
    ctaText: formData.get("ctaText"),
    imageUrl: formData.get("imageUrl") || "",
    priceLabelReais: formData.get("priceLabelReais") || undefined,
    originalLabelReais: formData.get("originalLabelReais") || undefined,
    gateUrl: formData.get("gateUrl") || undefined,
    gateLabel: formData.get("gateLabel"),
    gateDelay: formData.get("gateDelay") ?? 0,
    linkMode: formData.get("linkMode") ?? "none",
    existingLinkId: formData.get("existingLinkId") || undefined,
    newProductId: formData.get("newProductId") || undefined,
  });

  if (!parsed.success) {
    return { error: "Verifique os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const slugFree = await isSlugAvailable(data.slug, data.id);
  if (!slugFree) {
    return {
      error: "Esse slug já está em uso.",
      fieldErrors: { slug: ["Esse slug já está em uso."] },
    };
  }

  if (data.linkMode === "existing" && data.existingLinkId) {
    const link = await prisma.link.findUnique({ where: { id: data.existingLinkId } });
    if (!link || link.kind === LinkKind.PRESELL) {
      return {
        error: "Link selecionado é inválido.",
        fieldErrors: { existingLinkId: ["Selecione um link válido."] },
      };
    }
  }

  const priceLabel = data.priceLabelReais ? toCents(data.priceLabelReais) : null;
  const originalLabel = data.originalLabelReais ? toCents(data.originalLabelReais) : null;

  const values = {
    slug: data.slug,
    title: data.title,
    headline: data.headline,
    body: data.body || null,
    ctaText: data.ctaText,
    gateUrl: data.gateUrl || null,
    gateLabel: data.gateLabel,
    gateDelay: data.gateDelay,
    imageUrl: data.imageUrl || null,
    priceLabel,
    originalLabel,
  };

  const presell = data.id
    ? await prisma.presell.update({ where: { id: data.id }, data: values })
    : await prisma.presell.create({ data: values });

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
  if (!original) return { error: "Pre-sell não encontrada." };

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
      // a cópia nasce inativa e sem link de saída — evita duas páginas
      // publicadas com o mesmo conteúdo simultaneamente.
      active: false,
    },
  });

  bust(TAGS.presells);
  return { success: true, presellId: copy.id, slug: copy.slug };
}

// ----------------------------------------------------------- ativar/excluir

export async function setPresellActiveAction(id: string, active: boolean): Promise<void> {
  await prisma.presell.update({ where: { id }, data: { active } });
  bust(TAGS.presells);
}

/// Links que apontavam pra essa pre-sell (presellId) apenas perdem a
/// referência (onDelete: SetNull) — não são apagados.
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

/// slugify() é server-only (lib/links.ts importa "server-only"), então o
/// editor — que é client component — precisa desse wrapper pra sugerir o
/// slug a partir do título sem reimplementar a função.
export async function slugifyAction(text: string): Promise<string> {
  return slugify(text);
}
