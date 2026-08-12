"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLink } from "@/lib/links";
import { TAGS, bust } from "@/lib/cache";
import { LinkKind } from "@/generated/prisma";

import type { ActionState } from "./action-state";

// -------------------------------------------------------------- novo link

const createStandaloneSchema = z.object({
  targetUrl: z.string().trim().min(1, "Informe a URL de destino.").url("URL inválida."),
  kind: z.enum([LinkKind.DIRECT, LinkKind.TRACKED]),
  label: z.string().trim().max(80, "Máximo de 80 caracteres.").optional(),
});

/// Cria um link avulso (sem produto/pre-sell) — útil pra rastrear qualquer
/// URL, não só produtos do catálogo.
export async function createStandaloneLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createStandaloneSchema.safeParse({
    targetUrl: formData.get("targetUrl"),
    kind: formData.get("kind"),
    label: formData.get("label") || undefined,
  });

  if (!parsed.success) {
    return { error: "Verifique os campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await createLink({
      targetUrl: parsed.data.targetUrl,
      kind: parsed.data.kind,
      label: parsed.data.label || null,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao criar o link." };
  }

  bust(TAGS.links);
  return { success: true };
}

// --------------------------------------------------------- ativar/desativar

export async function setLinkActiveAction(id: string, active: boolean): Promise<void> {
  await prisma.link.update({ where: { id }, data: { active } });
  bust(TAGS.links);
}

// ------------------------------------------------------------------ excluir

/// O histórico de cliques vai junto (Click.linkId tem onDelete: Cascade).
export async function deleteLinkAction(id: string): Promise<void> {
  await prisma.link.delete({ where: { id } });
  bust(TAGS.links);
}
