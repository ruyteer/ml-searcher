"use server";

import { setSettings } from "@/lib/settings";
import { TAGS, bust } from "@/lib/cache";
import { getAccessToken, clearTokenCache, isMLApiError } from "@/lib/ml";
import { toCents } from "@/lib/format";
import { createWatch, updateWatch, deleteWatch, setWatchEnabled, syncCategoryTree } from "@/lib/data/watches";
import { BEAUTY_ROOT } from "@/lib/ml/categories";
import { detectionSchema, domainSchema, affiliateSchema, mlSchema, watchSchema } from "./schemas";
import { type ActionState, ok, fail, zodErrors } from "./action-state";

// ------------------------------------------------------- detecção de ofertas

export async function updateDetectionSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = detectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Verifique os campos destacados.", zodErrors(parsed.error));

  const { minDiscount, hotDiscount, minHistoryPoints, minPrice, minSoldQuantity } = parsed.data;
  await setSettings({
    minDiscount,
    hotDiscount,
    minHistoryPoints,
    minPrice: toCents(minPrice),
    minSoldQuantity,
  });
  return ok("Configurações de detecção salvas.");
}

// -------------------------------------------------------------- links: domínio

export async function updateDomainSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = domainSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Verifique os campos destacados.", zodErrors(parsed.error));

  await setSettings({ publicBaseUrl: parsed.data.publicBaseUrl });
  return ok("Domínio salvo.");
}

// ---------------------------------------------------------- links: afiliado

export async function updateAffiliateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = affiliateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Verifique os campos destacados.", zodErrors(parsed.error));

  await setSettings(parsed.data);
  return ok("Configurações de afiliado salvas.");
}

// ---------------------------------------------------------------- mercado livre

export async function updateMlSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = mlSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Verifique os campos destacados.", zodErrors(parsed.error));

  const { mlClientId, mlClientSecret, mlSiteId } = parsed.data;
  const patch: Record<string, unknown> = { mlClientId, mlSiteId };
  // Campo em branco = mantém o secret já salvo (nunca é reexibido).
  if (mlClientSecret !== "") patch.mlClientSecret = mlClientSecret;

  await setSettings(patch);
  clearTokenCache(); // credenciais podem ter mudado — não reaproveita token antigo
  return ok("Credenciais do Mercado Livre salvas.");
}

export async function testMlConnectionAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  clearTokenCache(); // força uma autenticação nova em vez de reaproveitar cache
  try {
    await getAccessToken();
    return ok("Conexão autenticada com sucesso — as próximas varreduras usam a API real.");
  } catch (err) {
    if (isMLApiError(err)) {
      if (err.code === "NO_CREDENTIALS") {
        return fail("Nenhuma credencial configurada. Preencha o App ID e a Secret Key abaixo.");
      }
      return fail(`Falha ao conectar: ${err.message}`);
    }
    return fail("Falha inesperada ao testar a conexão.");
  }
}

// -------------------------------------------------------- categoria monitorada

export async function createWatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = watchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Verifique os campos destacados.", zodErrors(parsed.error));

  await createWatch(parsed.data);
  bust(TAGS.watches);
  return ok("Categoria monitorada criada.");
}

export async function updateWatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("ID inválido.");

  const parsed = watchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Verifique os campos destacados.", zodErrors(parsed.error));

  await updateWatch(id, parsed.data);
  bust(TAGS.watches);
  return ok("Categoria monitorada atualizada.");
}

export async function deleteWatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("ID inválido.");

  await deleteWatch(id);
  bust(TAGS.watches);
  return ok("Categoria excluída. Os produtos já coletados continuam no catálogo.");
}

/// Chamada direta (sem <form>) pelo Switch da tabela, com UI otimista no cliente.
export async function toggleWatchAction(id: string, enabled: boolean): Promise<ActionState> {
  try {
    await setWatchEnabled(id, enabled);
    bust(TAGS.watches);
    return ok(enabled ? "Categoria ativada." : "Categoria desativada.");
  } catch {
    return fail("Não foi possível atualizar. Tente novamente.");
  }
}

/// Profundidade da árvore percorrida a partir da raiz do nicho — cobre a
/// raiz + filhas diretas + subcategorias (ex.: Barbearia tem 14 delas).
const CATEGORY_SYNC_MAX_DEPTH = 3;

/// Busca a árvore de categorias do nicho no ML e faz upsert de uma watch por
/// categoria, preservando o que o usuário já configurou nas existentes.
export async function syncCategoryTreeAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const { criadas, atualizadas, removidas, total } = await syncCategoryTree({
      rootId: BEAUTY_ROOT,
      maxDepth: CATEGORY_SYNC_MAX_DEPTH,
    });
    bust(TAGS.watches);
    const partes = [`${criadas} criadas`, `${atualizadas} atualizadas`, `${total} no total`];
    if (removidas > 0) partes.push(`${removidas} sumiram da árvore do ML (mantidas)`);
    return ok(`Sincronização concluída: ${partes.join(", ")}.`);
  } catch {
    return fail("Não foi possível sincronizar com o Mercado Livre. Tente novamente.");
  }
}
