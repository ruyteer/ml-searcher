"use server";

import { setSettings } from "@/lib/settings";
import { TAGS, bust } from "@/lib/cache";
import {
  clearTokenCache,
  disconnect as disconnectMl,
  isMLApiError,
  resolveAccessToken,
} from "@/lib/ml";
import { toCents } from "@/lib/format";
import {
  createWatch,
  updateWatch,
  deleteWatches,
  setWatchEnabled,
  setWatchesEnabled,
  syncCategoryTree,
  listWatchStats,
  clearDiscardedCategories,
} from "@/lib/data/watches";
import { BEAUTY_ROOT } from "@/lib/ml/categories";
import { discoverDomains, isBeautyDomain } from "@/lib/ml/domains";
import {
  detectionSchema,
  domainSchema,
  affiliateSchema,
  mlSchema,
  watchSchema,
} from "./schemas";
import {
  type ActionState,
  type CategoriaNumerosResult,
  type DomainDiscoveryResult,
  type ExclusaoResult,
  ok,
  fail,
  zodErrors,
} from "./action-state";

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
  if (!id) return fail("Categoria inválida.");

  const parsed = watchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Verifique os campos destacados.", zodErrors(parsed.error));

  await updateWatch(id, parsed.data);
  bust(TAGS.watches);
  return ok("Categoria monitorada atualizada.");
}

function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? `1 ${um}` : `${n} ${muitos}`;
}

/// Exclui uma ou várias categorias monitoradas de uma vez, numa transação só.
/// Chamada direta pelo cliente (sem <form>) porque a seleção múltipla vive em
/// estado do React, não em campos de formulário.
export async function deleteWatchesAction(ids: string[]): Promise<ExclusaoResult> {
  const alvos = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  if (alvos.length === 0) {
    return { ...fail("Nenhuma categoria selecionada."), excluidos: [] };
  }

  try {
    const { excluidas, produtosSoltos } = await deleteWatches(alvos);
    bust(TAGS.watches);

    if (excluidas === 0) {
      return { ...fail("Essas categorias já não existem mais na lista."), excluidos: [] };
    }

    const partes = [`${plural(excluidas, "categoria excluída", "categorias excluídas")}.`];
    if (produtosSoltos > 0) {
      partes.push(
        `${plural(produtosSoltos, "produto continua", "produtos continuam")} no catálogo, agora sem categoria.`,
      );
    }
    partes.push("A sincronização automática não vai trazer essas categorias de volta.");
    return { ...ok(partes.join(" ")), excluidos: alvos };
  } catch {
    return { ...fail("Não foi possível excluir. Tente novamente."), excluidos: [] };
  }
}

/// Números de cada categoria monitorada (produtos, ofertas e leitura de nicho).
/// Carregados sob demanda pela aba, e não junto da página, para a tela abrir
/// rápido mesmo com centenas de categorias.
export async function loadCategoriaNumerosAction(): Promise<CategoriaNumerosResult> {
  try {
    const stats = await listWatchStats();
    return {
      ok: true,
      message: "",
      itens: stats.map((s) => ({
        id: s.id,
        produtos: s.produtos,
        ofertas: s.ofertas,
        nicho: s.standing,
      })),
    };
  } catch {
    return { ok: false, message: "Não foi possível carregar os números das categorias.", itens: [] };
  }
}

/// Liga ou desliga várias de uma vez (usado pelo "desligar tudo que não é
/// cuidado masculino" e pela seleção múltipla).
export async function setWatchesEnabledAction(
  ids: string[],
  enabled: boolean,
): Promise<ActionState> {
  const alvos = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  if (alvos.length === 0) return fail("Nenhuma categoria selecionada.");
  try {
    const count = await setWatchesEnabled(alvos, enabled);
    bust(TAGS.watches);
    return ok(
      `${plural(count, "categoria", "categorias")} ${enabled ? "ligada(s)" : "desligada(s)"}.`,
    );
  } catch {
    return fail("Não foi possível atualizar. Tente novamente.");
  }
}

/// Esquece as exclusões: a próxima sincronização volta a trazer tudo o que o
/// usuário já apagou. Existe para o caso de arrependimento.
export async function restaurarCategoriasDescartadasAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const quantas = await clearDiscardedCategories();
    bust(TAGS.watches);
    if (quantas === 0) return ok("Nenhuma categoria estava marcada como excluída.");
    return ok(
      `${plural(quantas, "categoria volta", "categorias voltam")} na próxima vez que você sincronizar com o Mercado Livre.`,
    );
  } catch {
    return fail("Não foi possível liberar as categorias excluídas.");
  }
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
    const { criadas, atualizadas, removidas, respeitadas, total } = await syncCategoryTree({
      rootId: BEAUTY_ROOT,
      maxDepth: CATEGORY_SYNC_MAX_DEPTH,
    });
    bust(TAGS.watches);
    const partes = [`${criadas} criadas`, `${atualizadas} atualizadas`, `${total} no total`];
    if (respeitadas > 0) {
      partes.push(`${respeitadas} que você excluiu continuaram fora`);
    }
    if (removidas > 0) partes.push(`${removidas} sumiram da lista do Mercado Livre (mantidas)`);
    return ok(`Sincronização concluída: ${partes.join(", ")}.`);
  } catch {
    return fail("Não foi possível sincronizar com o Mercado Livre. Tente novamente.");
  }
}
