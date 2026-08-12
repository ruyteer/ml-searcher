"use server";

import { setSettings } from "@/lib/settings";
import { TAGS, bust } from "@/lib/cache";
import {
  clearTokenCache,
  disconnect as disconnectMl,
  exchangeCode,
  isMLApiError,
  resolveAccessToken,
  setMlRedirectUri,
} from "@/lib/ml";
import { toCents } from "@/lib/format";
import { createWatch, updateWatch, deleteWatch, setWatchEnabled, syncCategoryTree } from "@/lib/data/watches";
import { BEAUTY_ROOT } from "@/lib/ml/categories";
import { discoverDomains, isBeautyDomain } from "@/lib/ml/domains";
import {
  detectionSchema,
  domainSchema,
  affiliateSchema,
  mlSchema,
  mlManualCodeSchema,
  mlRedirectUriSchema,
  watchSchema,
} from "./schemas";
import { type ActionState, type DomainDiscoveryResult, ok, fail, zodErrors } from "./action-state";

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
    const { source } = await resolveAccessToken();
    if (source === "usuario") {
      return ok("Conectado com o token da conta autorizada. É o caminho oficial e recomendado.");
    }
    return ok(
      "Conectado com o token da aplicação. Funciona, mas é um caminho legado: conecte uma conta para usar o fluxo oficial.",
    );
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

/// Guarda a URL de redirecionamento cadastrada na aplicação do Mercado Livre.
/// Fica em `Setting` (modelo key/value livre) com a chave `mlRedirectUri`, e
/// não no SETTINGS_SCHEMA: é dado do cadastro da aplicação, não um ajuste de
/// comportamento, e precisa bater byte a byte com o que foi registrado lá.
export async function updateMlRedirectUriAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = mlRedirectUriSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Verifique os campos destacados.", zodErrors(parsed.error));

  await setMlRedirectUri(parsed.data.mlRedirectUri);
  return ok("URL de redirecionamento salva.");
}

/// Conexão manual: o usuário cola o `code` que apareceu na barra de endereço
/// depois de autorizar. Existe porque o Mercado Livre só aceita redirect URI
/// em HTTPS, e o painel ainda roda em http://localhost. Sem isto não daria
/// para conectar a conta hoje.
export async function connectMlWithCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = mlManualCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Verifique os campos destacados.", zodErrors(parsed.error));

  const { mlRedirectUri, mlCode } = parsed.data;
  // A troca só funciona com a MESMA redirect URI usada na autorização, então
  // salvamos antes: o que está no campo é o que vale.
  await setMlRedirectUri(mlRedirectUri);

  try {
    // Sem clearTokenCache aqui: exchangeCode já deixa o token novo em cache, e
    // invalidá-lo forçaria uma renovação imediata, queimando o refresh token
    // recém-emitido à toa (o ML rotaciona ele a cada uso).
    const status = await exchangeCode(mlCode, mlRedirectUri);
    const quem = status.nickname ?? status.mlUserId ?? "sua conta";
    return ok(`Conta conectada: ${quem}. As próximas chamadas já usam o token de usuário.`);
  } catch (err) {
    if (isMLApiError(err)) return fail(err.message);
    return fail("Falha inesperada ao concluir a conexão. Tente autorizar de novo.");
  }
}

export async function disconnectMlAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await disconnectMl();
  return ok(
    "Conta desconectada. Para revogar o acesso de vez, remova a aplicação nas permissões da sua conta do Mercado Livre.",
  );
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

/// Chamada direta (sem <form>) pelo botão "Descobrir domínio" do diálogo de
/// categoria: usa o termo que a pessoa já digitou no campo de busca e devolve
/// os domínios candidatos, marcando quais caem dentro de Beleza e Cuidado
/// Pessoal. Termo vazio ou sem domínio conhecido não é erro, é lista vazia.
export async function discoverDomainsAction(q: string): Promise<DomainDiscoveryResult> {
  const term = q.trim();
  if (!term) return { ok: true, message: "Digite um termo de busca antes de descobrir o domínio.", domains: [] };

  try {
    const found = await discoverDomains(term);
    const domains = await Promise.all(
      found.map(async (d) => ({ ...d, beauty: await isBeautyDomain(d.categoryId) })),
    );
    return { ok: true, message: "", domains };
  } catch (err) {
    if (isMLApiError(err)) return { ok: false, message: `Não foi possível descobrir o domínio: ${err.message}`, domains: [] };
    return { ok: false, message: "Falha inesperada ao descobrir o domínio.", domains: [] };
  }
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
