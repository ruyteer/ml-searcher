"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TAGS, bust } from "@/lib/cache";

/// Estado devolvido por toda Server Action desta página — tanto as ligadas
/// a <form action={...}> via useActionState quanto as chamadas imperativas
/// (delete/duplicar/toggle) disparadas dentro de um startTransition.
export interface ActionState {
  success: boolean;
  message?: string;
}

export const INITIAL_ACTION_STATE: ActionState = { success: false, message: undefined };

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

// ------------------------------------------------------------------ phrases

const phraseInputSchema = z.object({
  text: z.string().trim().min(1, "Digite o texto da frase.").max(500, "Frase muito longa."),
  category: z
    .string()
    .trim()
    .min(1, "Escolha ou digite uma categoria.")
    .max(50, "Categoria muito longa."),
});

export async function createPhrase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = phraseInputSchema.safeParse({
    text: formData.get("text"),
    category: formData.get("category"),
  });
  if (!parsed.success) return { success: false, message: firstIssueMessage(parsed.error) };

  await prisma.phrase.create({ data: parsed.data });
  bust(TAGS.phrases);
  return { success: true, message: "Frase criada." };
}

export async function updatePhrase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { success: false, message: "Frase não encontrada." };

  const parsed = phraseInputSchema.safeParse({
    text: formData.get("text"),
    category: formData.get("category"),
  });
  if (!parsed.success) return { success: false, message: firstIssueMessage(parsed.error) };

  await prisma.phrase.update({ where: { id }, data: parsed.data });
  bust(TAGS.phrases);
  return { success: true, message: "Frase atualizada." };
}

export async function deletePhrase(id: string): Promise<ActionState> {
  try {
    await prisma.phrase.delete({ where: { id } });
    bust(TAGS.phrases);
    return { success: true };
  } catch {
    return { success: false, message: "Erro ao excluir a frase." };
  }
}

export async function duplicatePhrase(id: string): Promise<ActionState> {
  const original = await prisma.phrase.findUnique({ where: { id } });
  if (!original) return { success: false, message: "Frase não encontrada." };

  await prisma.phrase.create({
    data: { text: original.text, category: original.category, active: original.active },
  });
  bust(TAGS.phrases);
  return { success: true, message: "Frase duplicada." };
}

export async function setPhraseActive(id: string, active: boolean): Promise<ActionState> {
  try {
    await prisma.phrase.update({ where: { id }, data: { active } });
    bust(TAGS.phrases);
    return { success: true };
  } catch {
    return { success: false, message: "Erro ao atualizar a frase." };
  }
}

const MAX_BULK_LINES = 300;

const bulkPhraseSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, "Escolha ou digite uma categoria.")
    .max(50, "Categoria muito longa."),
  lines: z.string().min(1, "Cole ao menos uma frase, uma por linha."),
});

/// Cada linha não-vazia da textarea vira uma Phrase da categoria escolhida —
/// pensado para colar uma lista pronta de uma vez.
export async function bulkCreatePhrases(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = bulkPhraseSchema.safeParse({
    category: formData.get("category"),
    lines: formData.get("lines"),
  });
  if (!parsed.success) return { success: false, message: firstIssueMessage(parsed.error) };

  const texts = parsed.data.lines
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_BULK_LINES);

  if (texts.length === 0) {
    return { success: false, message: "Nenhuma linha válida encontrada." };
  }

  await prisma.phrase.createMany({
    data: texts.map((text) => ({ text, category: parsed.data.category })),
  });
  bust(TAGS.phrases);
  return { success: true, message: `${texts.length} frase(s) adicionada(s).` };
}

// ---------------------------------------------------------------- templates

const templateInputSchema = z.object({
  name: z.string().trim().min(1, "Digite um nome para o template.").max(100, "Nome muito longo."),
  body: z
    .string()
    .trim()
    .min(1, "Digite o corpo da mensagem.")
    .max(4000, "Corpo muito longo."),
});

export async function createTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = templateInputSchema.safeParse({
    name: formData.get("name"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { success: false, message: firstIssueMessage(parsed.error) };

  const total = await prisma.messageTemplate.count();
  await prisma.messageTemplate.create({
    data: { ...parsed.data, isDefault: total === 0 },
  });
  bust(TAGS.templates);
  return { success: true, message: "Template criado." };
}

export async function updateTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { success: false, message: "Template não encontrado." };

  const parsed = templateInputSchema.safeParse({
    name: formData.get("name"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { success: false, message: firstIssueMessage(parsed.error) };

  await prisma.messageTemplate.update({ where: { id }, data: parsed.data });
  bust(TAGS.templates);
  return { success: true, message: "Template atualizado." };
}

export async function deleteTemplate(id: string): Promise<ActionState> {
  const total = await prisma.messageTemplate.count();
  if (total <= 1) {
    return { success: false, message: "Não é possível excluir o último template restante." };
  }

  const template = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!template) return { success: false, message: "Template não encontrado." };

  await prisma.messageTemplate.delete({ where: { id } });

  // O template excluído era o padrão: promove o mais antigo dos que sobraram
  // pra sempre existir exatamente um padrão.
  if (template.isDefault) {
    const next = await prisma.messageTemplate.findFirst({ orderBy: { createdAt: "asc" } });
    if (next) await prisma.messageTemplate.update({ where: { id: next.id }, data: { isDefault: true } });
  }

  bust(TAGS.templates);
  return { success: true, message: "Template excluído." };
}

export async function duplicateTemplate(id: string): Promise<ActionState> {
  const original = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!original) return { success: false, message: "Template não encontrado." };

  await prisma.messageTemplate.create({
    data: { name: `${original.name} (cópia)`, body: original.body, isDefault: false },
  });
  bust(TAGS.templates);
  return { success: true, message: "Template duplicado." };
}

/// Marca `id` como padrão e desmarca o anterior — na mesma transação pra
/// nunca existir zero ou mais de um template padrão ao mesmo tempo.
export async function setDefaultTemplate(id: string): Promise<ActionState> {
  try {
    await prisma.$transaction([
      prisma.messageTemplate.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      }),
      prisma.messageTemplate.update({ where: { id }, data: { isDefault: true } }),
    ]);
    bust(TAGS.templates);
    return { success: true, message: "Template padrão atualizado." };
  } catch {
    return { success: false, message: "Erro ao definir o template padrão." };
  }
}
