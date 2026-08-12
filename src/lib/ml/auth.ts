/// Fluxo OAuth de usuário do Mercado Livre (authorization_code).
///
/// Por que existe: a documentação oficial de autenticação só reconhece os
/// grant types `authorization_code` e `refresh_token`. O `client_credentials`
/// que o projeto usava não aparece na doc atual, funciona por tolerância
/// histórica e pode ser cortado sem aviso, como aconteceu com a API de busca
/// por site em abril de 2025.
///
/// O token de usuário fica em uma linha única da tabela MLAuth (id "default").
///
/// Import circular com ./client é intencional e seguro: os dois lados só se
/// referenciam DENTRO de funções, nunca no topo do módulo.

import "server-only";

import { prisma } from "../prisma";
import { ML_API_BASE, MLApiError, requireCredentials } from "./client";

/// O fluxo de autorização começa no domínio do país, não em api.mercadolibre.com.
/// A doc oficial só mostra o de Brasil (auth.mercadolivre.com.br, com "v", grafia
/// brasileira) e o de Argentina, e manda "trocar pelo domínio do país". Os demais
/// seguem esse padrão.
const AUTH_HOSTS: Record<string, string> = {
  MLB: "https://auth.mercadolivre.com.br",
  MLA: "https://auth.mercadolibre.com.ar",
  MLM: "https://auth.mercadolibre.com.mx",
  MCO: "https://auth.mercadolibre.com.co",
  MLC: "https://auth.mercadolibre.cl",
  MPE: "https://auth.mercadolibre.com.pe",
  MLU: "https://auth.mercadolibre.com.uy",
  MEC: "https://auth.mercadolibre.com.ec",
};

const DEFAULT_AUTH_HOST = AUTH_HOSTS.MLB;

/// Linha única: só existe uma conta conectada por instalação.
export const ML_AUTH_ROW_ID = "default";

/// A redirect URI mora em `Setting` (modelo key/value livre) em vez do
/// SETTINGS_SCHEMA porque precisa ser editável no painel sem tocar em
/// settings.ts, e porque não é um "ajuste de comportamento": é um dado do
/// cadastro da aplicação no Mercado Livre, que precisa bater byte a byte com
/// o que foi registrado lá.
export const ML_REDIRECT_URI_KEY = "mlRedirectUri";

/// Funções, não constantes: por causa do import circular com ./client, o valor
/// de ML_API_BASE ainda não existe enquanto este módulo está sendo avaliado.
const tokenUrl = () => `${ML_API_BASE}/oauth/token`;
const usersMeUrl = () => `${ML_API_BASE}/users/me`;
const TOKEN_TIMEOUT_MS = 15_000;

/// Renova quando faltar menos de 10 min para expirar.
const RENEW_SKEW_MS = 10 * 60 * 1000;
/// Só entra em ação se a resposta vier sem expires_in. A doc oscila entre
/// 10800 e 21600 no mesmo exemplo, então o valor de runtime é que manda.
const DEFAULT_TTL_S = 21_600;

// ------------------------------------------------------------------- tipos

export interface MLTokenPayload {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  user_id?: number | string;
  refresh_token?: string;
}

interface MLTokenErrorBody {
  error?: string;
  message?: string;
  error_description?: string;
  status?: number;
}

type TokenPostResult =
  | { ok: true; data: MLTokenPayload }
  | { ok: false; status: number; oauthError: string; message: string };

export interface MLAuthStatus {
  conectado: boolean;
  nickname: string | null;
  mlUserId: string | null;
  /// ISO 8601, ou null quando não há conexão.
  expiraEm: string | null;
  scope: string | null;
  /// Último motivo de falha de renovação, quando a conexão caiu sozinha.
  erro: string | null;
}

const DISCONNECTED: MLAuthStatus = {
  conectado: false,
  nickname: null,
  mlUserId: null,
  expiraEm: null,
  scope: null,
  erro: null,
};

// ------------------------------------------------------- cache em memória

interface UserTokenCache {
  token: string;
  /// Epoch ms do vencimento real (sem folga aplicada).
  expiresAt: number;
}

/// Evita uma ida ao banco a cada chamada da API durante uma varredura.
let userTokenCache: UserTokenCache | null = null;
/// Renovação em voo: o ML rotaciona o refresh token a cada uso, então duas
/// renovações concorrentes com o mesmo refresh token invalidam uma à outra.
/// Todos os chamadores esperam a MESMA Promise.
let pendingRefresh: Promise<string | null> | null = null;
/// Setado por clearUserTokenCache(): força uma renovação de verdade no lugar
/// de reaproveitar o access token gravado (usado no retry de 401).
let forceRefresh = false;
/// Última falha de renovação, exibida no painel.
let lastAuthError: string | null = null;
/// Epoch ms até quando não vale a pena tentar renovar de novo. Evita bater no
/// /oauth/token a cada chamada quando a credencial está errada.
let refreshBlockedUntil = 0;

export function clearUserTokenCache(): void {
  userTokenCache = null;
  pendingRefresh = null;
  forceRefresh = true;
  refreshBlockedUntil = 0;
}

// ------------------------------------------------------------- HTTP básico

async function postToken(body: URLSearchParams): Promise<TokenPostResult> {
  let res: Response;
  try {
    res = await fetch(tokenUrl(), {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      oauthError: "network_error",
      message: `Falha de rede ao falar com o Mercado Livre: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok || parsed === null) {
    const body = (parsed ?? {}) as MLTokenErrorBody;
    const oauthError = body.error ?? `http_${res.status}`;
    const message =
      body.message ?? body.error_description ?? body.error ?? `HTTP ${res.status} em /oauth/token`;
    return { ok: false, status: res.status, oauthError, message };
  }

  const data = parsed as MLTokenPayload;
  if (!data.access_token) {
    return {
      ok: false,
      status: 502,
      oauthError: "no_access_token",
      message: "O Mercado Livre respondeu sem access_token.",
    };
  }
  return { ok: true, data };
}

/// Traduz os erros de OAuth do ML para português de leigo.
function humanizeOAuthError(oauthError: string, fallback: string): string {
  switch (oauthError) {
    case "invalid_grant":
      return "O código ou a autorização não vale mais. Isso acontece quando o código já foi usado, expirou (ele dura poucos minutos) ou a URL de redirecionamento informada é diferente da cadastrada. Autorize de novo.";
    case "invalid_client":
      return "App ID ou Secret Key incorretos. Confira as credenciais salvas nesta aba.";
    case "invalid_request":
      return "Requisição recusada pelo Mercado Livre. Confira se a URL de redirecionamento é exatamente a mesma cadastrada na aplicação.";
    case "unauthorized_client":
    case "unauthorized_application":
      return "Esta aplicação não tem permissão para o fluxo de autorização. Revise o cadastro dela no portal do Mercado Livre.";
    case "invalid_scope":
      return "As permissões pedidas não são válidas para esta aplicação. Revise o cadastro dela no portal do Mercado Livre.";
    case "invalid_operator_user_id":
      return "Você autorizou usando uma conta de colaborador ou operador. Entre com a conta administradora do Mercado Livre e autorize de novo.";
    default:
      return fallback;
  }
}

function expiresAtFrom(payload: MLTokenPayload): Date {
  const ttl = Number(payload.expires_in);
  const seconds = Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_S;
  return new Date(Date.now() + seconds * 1000);
}

/// Busca nickname e id da conta com o token recém-obtido. Falha aqui não
/// derruba a conexão: o token continua válido, só ficamos sem o apelido.
async function fetchAccountInfo(
  accessToken: string,
): Promise<{ mlUserId: string | null; nickname: string | null }> {
  try {
    const res = await fetch(usersMeUrl(), {
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
    if (!res.ok) return { mlUserId: null, nickname: null };
    const body = (await res.json()) as { id?: number | string; nickname?: string };
    return {
      mlUserId: body.id !== undefined && body.id !== null ? String(body.id) : null,
      nickname: typeof body.nickname === "string" ? body.nickname : null,
    };
  } catch {
    return { mlUserId: null, nickname: null };
  }
}

// ------------------------------------------------------------ redirect URI

/// Lida direto com `Setting` porque a chave não faz parte do SETTINGS_SCHEMA
/// (ver comentário em ML_REDIRECT_URI_KEY). Env serve só para bootar no
/// Railway sem passar pelo painel.
export async function getMlRedirectUri(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: ML_REDIRECT_URI_KEY } });
  const saved = row?.value.trim();
  if (saved) return saved;
  return (process.env.ML_REDIRECT_URI ?? "").trim();
}

export async function setMlRedirectUri(value: string): Promise<void> {
  const clean = value.trim();
  await prisma.setting.upsert({
    where: { key: ML_REDIRECT_URI_KEY },
    create: { key: ML_REDIRECT_URI_KEY, value: clean },
    update: { value: clean },
  });
}

// ---------------------------------------------------------- URL de autorização

/// Monta a URL para onde o usuário precisa ir para autorizar a aplicação.
export async function getAuthorizeUrl(redirectUri: string, state: string): Promise<string> {
  const creds = await requireCredentials();
  const host = AUTH_HOSTS[creds.siteId.toUpperCase()] ?? DEFAULT_AUTH_HOST;

  const url = new URL("/authorization", host);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  // Sem offline_access o Mercado Livre devolve só o access token, que dura
  // poucas horas, e nenhum refresh token. A conexão morreria sozinha no
  // mesmo dia e exigiria autorizar de novo toda vez.
  url.searchParams.set("scope", "offline_access read");
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

// --------------------------------------------------------------- troca do code

/// Troca o `code` recebido do Mercado Livre por access token + refresh token.
/// A redirect_uri precisa ser IDÊNTICA à usada na URL de autorização.
export async function exchangeCode(code: string, redirectUri: string): Promise<MLAuthStatus> {
  const creds = await requireCredentials();

  const result = await postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code: code.trim(),
      redirect_uri: redirectUri.trim(),
    }),
  );

  if (!result.ok) {
    throw new MLApiError({
      status: result.status || 400,
      code: "AUTH_FAILED",
      message: humanizeOAuthError(result.oauthError, result.message),
    });
  }

  const payload = result.data;
  if (!payload.refresh_token) {
    throw new MLApiError({
      status: 502,
      code: "AUTH_FAILED",
      message:
        "O Mercado Livre não devolveu o refresh token. Sem ele a conexão expiraria em poucas horas, então a conexão foi recusada. Tente autorizar de novo.",
    });
  }

  const expiresAt = expiresAtFrom(payload);
  const info = await fetchAccountInfo(payload.access_token);
  const mlUserId =
    info.mlUserId ??
    (payload.user_id !== undefined && payload.user_id !== null ? String(payload.user_id) : null);

  const row = await prisma.mLAuth.upsert({
    where: { id: ML_AUTH_ROW_ID },
    create: {
      id: ML_AUTH_ROW_ID,
      mlUserId,
      nickname: info.nickname,
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt,
      scope: payload.scope ?? null,
    },
    update: {
      mlUserId,
      nickname: info.nickname,
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt,
      scope: payload.scope ?? null,
    },
  });

  userTokenCache = { token: row.accessToken, expiresAt: row.expiresAt.getTime() };
  pendingRefresh = null;
  forceRefresh = false;
  refreshBlockedUntil = 0;
  lastAuthError = null;

  return toStatus(row);
}

// ------------------------------------------------------------------ renovação

/// Só o invalid_grant mata o refresh token de vez: os outros 4xx são problema
/// de credencial ou de cadastro da aplicação, que o usuário ainda pode corrigir
/// sem precisar reautorizar.
function isDeadGrant(oauthError: string): boolean {
  return oauthError === "invalid_grant" || oauthError === "unauthorized_application";
}

/// Quanto tempo esperar antes de tentar renovar de novo depois de uma falha
/// que não é de rede. Sem isso, cada chamada da API tentaria outra renovação.
const REFRESH_COOLDOWN_MS = 60_000;

async function doRefresh(): Promise<string | null> {
  const row = await prisma.mLAuth.findUnique({ where: { id: ML_AUTH_ROW_ID } });
  if (!row) {
    userTokenCache = null;
    return null;
  }

  const creds = await requireCredentials();
  const result = await postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: row.refreshToken,
    }),
  );

  if (!result.ok) {
    userTokenCache = null;
    forceRefresh = false;

    if (isDeadGrant(result.oauthError)) {
      // Não adianta tentar de novo: o refresh token não existe mais.
      await prisma.mLAuth.deleteMany({ where: { id: ML_AUTH_ROW_ID } });
      lastAuthError =
        "A conexão com o Mercado Livre expirou ou foi revogada. Clique em Conectar com o Mercado Livre para autorizar de novo.";
    } else {
      // Credencial errada ou instabilidade: mantém a linha (o refresh token
      // ainda pode valer) e segura novas tentativas por um tempo.
      refreshBlockedUntil = Date.now() + REFRESH_COOLDOWN_MS;
      lastAuthError = `Não foi possível renovar o token: ${humanizeOAuthError(result.oauthError, result.message)}`;
    }

    console.warn(`[ml/auth] falha ao renovar o token (${result.oauthError}): ${result.message}`);
    // Devolver null (em vez de lançar) deixa o chamador cair no token de
    // aplicação e a varredura continuar rodando.
    return null;
  }

  const payload = result.data;
  const expiresAt = expiresAtFrom(payload);

  // O ML ROTACIONA o refresh token: o antigo morre no instante em que este
  // chega. Gravar os dois campos no mesmo update é o que impede a conexão de
  // quebrar em definitivo caso o processo caia no meio.
  const updated = await prisma.mLAuth.update({
    where: { id: ML_AUTH_ROW_ID },
    data: {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? row.refreshToken,
      expiresAt,
      scope: payload.scope ?? row.scope,
    },
  });

  userTokenCache = { token: updated.accessToken, expiresAt: updated.expiresAt.getTime() };
  forceRefresh = false;
  refreshBlockedUntil = 0;
  lastAuthError = null;
  return updated.accessToken;
}

/// Renova o access token usando o refresh token gravado. Uma única renovação
/// em voo por processo. Devolve null quando não há conexão (ou quando ela
/// acabou de ser invalidada de forma definitiva).
export async function refreshAccessToken(): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh;
  if (Date.now() < refreshBlockedUntil) return null;

  const promise = doRefresh().finally(() => {
    if (pendingRefresh === promise) pendingRefresh = null;
  });
  pendingRefresh = promise;
  return promise;
}

// -------------------------------------------------------------- leitura do token

/// Access token de usuário válido, renovando sozinho quando necessário.
/// Devolve null quando não há conta conectada.
export async function getUserToken(): Promise<string | null> {
  if (!forceRefresh && userTokenCache && userTokenCache.expiresAt - RENEW_SKEW_MS > Date.now()) {
    return userTokenCache.token;
  }

  if (forceRefresh) {
    // Chegou 401 com este token: renova de verdade em vez de reler o banco.
    if (!(await hasUserConnection())) {
      forceRefresh = false;
      return null;
    }
    return refreshAccessToken();
  }

  const row = await prisma.mLAuth.findUnique({ where: { id: ML_AUTH_ROW_ID } });
  if (!row) {
    userTokenCache = null;
    return null;
  }

  if (row.expiresAt.getTime() - RENEW_SKEW_MS > Date.now()) {
    userTokenCache = { token: row.accessToken, expiresAt: row.expiresAt.getTime() };
    return row.accessToken;
  }

  return refreshAccessToken();
}

export async function hasUserConnection(): Promise<boolean> {
  const count = await prisma.mLAuth.count({ where: { id: ML_AUTH_ROW_ID } });
  return count > 0;
}

// ------------------------------------------------------------------- painel

interface MLAuthRow {
  mlUserId: string | null;
  nickname: string | null;
  expiresAt: Date;
  scope: string | null;
}

function toStatus(row: MLAuthRow): MLAuthStatus {
  return {
    conectado: true,
    nickname: row.nickname,
    mlUserId: row.mlUserId,
    expiraEm: row.expiresAt.toISOString(),
    scope: row.scope,
    erro: null,
  };
}

export async function getAuthStatus(): Promise<MLAuthStatus> {
  const row = await prisma.mLAuth.findUnique({ where: { id: ML_AUTH_ROW_ID } });
  if (!row) return { ...DISCONNECTED, erro: lastAuthError };
  return toStatus(row);
}

/// Apaga a conexão. O token em si continua válido no lado do ML até expirar;
/// para revogar de verdade o usuário precisa remover a aplicação na conta dele.
export async function disconnect(): Promise<void> {
  await prisma.mLAuth.deleteMany({ where: { id: ML_AUTH_ROW_ID } });
  userTokenCache = null;
  pendingRefresh = null;
  forceRefresh = false;
  refreshBlockedUntil = 0;
  lastAuthError = null;
}
