/// Cliente HTTP da API do Mercado Livre.
/// Responsabilidades: resolver o token, timeout, retry com backoff,
/// rate limiting e erros tipados.
///
/// Ordem de escolha do token:
///   1. token de usuário (authorization_code), quando há conta conectada;
///   2. client_credentials, como fallback LEGADO (ver getAppAccessToken).
///
/// O import de ./auth é circular de propósito e seguro: os dois módulos só se
/// referenciam dentro de funções, nunca no topo.

import { getSettings } from "../settings";
import { clearUserTokenCache, getUserToken, hasUserConnection } from "./auth";
import type { MLErrorBody } from "./types";

export const ML_API_BASE = "https://api.mercadolibre.com";
const TOKEN_PATH = "/oauth/token";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 8_000;
/// O token dura ~6h; renovamos com 5 min de folga.
const TOKEN_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_MAX_CONCURRENCY = 4;

// ------------------------------------------------------------------- erros

export type MLErrorCode =
  | "NO_CREDENTIALS"
  | "AUTH_FAILED"
  | "TIMEOUT"
  | "NETWORK"
  | "RATE_LIMITED"
  | "BAD_RESPONSE"
  | "HTTP_ERROR"
  | "ABORTED";

export interface MLApiErrorInit {
  status: number;
  code: MLErrorCode;
  message: string;
  cause?: unknown;
}

export class MLApiError extends Error {
  readonly status: number;
  readonly code: MLErrorCode;

  constructor(init: MLApiErrorInit) {
    super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = "MLApiError";
    this.status = init.status;
    this.code = init.code;
  }
}

export function isMLApiError(err: unknown): err is MLApiError {
  return err instanceof MLApiError;
}

// -------------------------------------------------------------- rate limit

/// Semáforo simples: no máximo N requisições em voo contra o ML.
class Semaphore {
  private max: number;
  private active = 0;
  private waiters: Array<() => void> = [];

  constructor(max: number) {
    this.max = Math.max(1, Math.floor(max));
  }

  setMax(next: number): void {
    this.max = Math.max(1, Math.floor(next));
    this.drain();
  }

  get maxConcurrency(): number {
    return this.max;
  }

  private drain(): void {
    while (this.active < this.max && this.waiters.length > 0) {
      const resolve = this.waiters.shift();
      if (!resolve) break;
      this.active += 1;
      resolve();
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active < this.max) {
      this.active += 1;
    } else {
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
    }
    try {
      return await fn();
    } finally {
      this.active -= 1;
      this.drain();
    }
  }
}

function envConcurrency(): number {
  const raw = Number(process.env.ML_MAX_CONCURRENCY);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_CONCURRENCY;
}

const gate = new Semaphore(envConcurrency());

export function setMaxConcurrency(n: number): void {
  gate.setMax(n);
}

export function getMaxConcurrency(): number {
  return gate.maxConcurrency;
}

// ------------------------------------------------------------------ token

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface CachedToken {
  /// Identifica as credenciais que geraram o token — trocar as credenciais
  /// no painel invalida o cache sem precisar reiniciar o processo.
  credsKey: string;
  token: string;
  expiresAt: number;
}

/// Cache em memória do módulo. Sobrevive entre requests no mesmo processo.
let cachedToken: CachedToken | null = null;
/// Renovação em voo — todos os chamadores concorrentes aguardam a mesma Promise.
let pendingToken: { credsKey: string; promise: Promise<string> } | null = null;

export interface MLCredentials {
  clientId: string;
  clientSecret: string;
  siteId: string;
}

export async function getCredentials(): Promise<MLCredentials | null> {
  const settings = await getSettings();
  const clientId = settings.mlClientId.trim();
  const clientSecret = settings.mlClientSecret.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, siteId: settings.mlSiteId.trim() || "MLB" };
}

export async function requireCredentials(): Promise<MLCredentials> {
  const creds = await getCredentials();
  if (!creds) {
    throw new MLApiError({
      status: 0,
      code: "NO_CREDENTIALS",
      message:
        "Credenciais do Mercado Livre não configuradas (mlClientId/mlClientSecret). " +
        "Preencha no painel ou via ML_CLIENT_ID/ML_CLIENT_SECRET.",
    });
  }
  return creds;
}

function credsKeyOf(creds: MLCredentials): string {
  return `${creds.clientId}:${creds.clientSecret.length}`;
}

async function requestToken(creds: MLCredentials): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  let payload: TokenResponse;
  try {
    payload = await executeWithRetry<TokenResponse>(`${ML_API_BASE}${TOKEN_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: body.toString(),
    });
  } catch (err) {
    if (isMLApiError(err) && err.status >= 400 && err.status < 500) {
      throw new MLApiError({
        status: err.status,
        code: "AUTH_FAILED",
        message: `Falha ao autenticar no Mercado Livre: ${err.message}`,
        cause: err,
      });
    }
    throw err;
  }

  if (!payload?.access_token) {
    throw new MLApiError({
      status: 502,
      code: "AUTH_FAILED",
      message: "Resposta de token sem access_token.",
    });
  }

  const ttlMs = (Number(payload.expires_in) || 21_600) * 1000;
  cachedToken = {
    credsKey: credsKeyOf(creds),
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(60_000, ttlMs - TOKEN_SKEW_MS),
  };
  return payload.access_token;
}

/// CAMINHO LEGADO. `client_credentials` não consta na documentação oficial de
/// autenticação do Mercado Livre (que só reconhece `authorization_code` e
/// `refresh_token`) e responde `unsupported_grant_type` a qualquer momento que
/// o ML decidir cortar a tolerância. Só é usado enquanto não houver conta
/// conectada pelo fluxo de usuário.
export async function getAppAccessToken(): Promise<string> {
  const creds = await requireCredentials();
  const key = credsKeyOf(creds);

  if (cachedToken && cachedToken.credsKey === key && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  // Uma única renovação em voo por conjunto de credenciais.
  if (pendingToken && pendingToken.credsKey === key) return pendingToken.promise;

  const promise = requestToken(creds).finally(() => {
    if (pendingToken?.promise === promise) pendingToken = null;
  });
  pendingToken = { credsKey: key, promise };
  return promise;
}

/// De onde vem o token usado nas chamadas.
export type MLTokenSource = "usuario" | "aplicacao" | "nenhum";

export interface ResolvedToken {
  token: string;
  source: Exclude<MLTokenSource, "nenhum">;
}

/// Token válido mais o rótulo da origem, para o painel poder mostrar.
export async function resolveAccessToken(): Promise<ResolvedToken> {
  const userToken = await getUserToken();
  if (userToken) return { token: userToken, source: "usuario" };
  return { token: await getAppAccessToken(), source: "aplicacao" };
}

export async function getAccessToken(): Promise<string> {
  return (await resolveAccessToken()).token;
}

/// O que a próxima chamada usaria, sem disparar nenhuma autenticação.
export async function getTokenSource(): Promise<MLTokenSource> {
  if (await hasUserConnection()) return "usuario";
  return (await getCredentials()) ? "aplicacao" : "nenhum";
}

export function clearTokenCache(): void {
  cachedToken = null;
  pendingToken = null;
  clearUserTokenCache();
}

// ------------------------------------------------------------------- fetch

interface RawInit {
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/// Retry-After vem em segundos ou como data HTTP.
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

function backoffDelay(attempt: number): number {
  const base = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1));
  // jitter para não sincronizar retries concorrentes
  return base + Math.floor(Math.random() * 250);
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

async function fetchWithTimeout(url: string, init: RawInit): Promise<Response> {
  const controller = new AbortController();
  const external = init.signal;
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) {
      throw new MLApiError({ status: 0, code: "ABORTED", message: "Requisição cancelada." });
    }
    external.addEventListener("abort", onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (timedOut) {
      throw new MLApiError({
        status: 408,
        code: "TIMEOUT",
        message: `Tempo esgotado (${REQUEST_TIMEOUT_MS}ms) em ${url}`,
        cause: err,
      });
    }
    if (external?.aborted) {
      throw new MLApiError({ status: 0, code: "ABORTED", message: "Requisição cancelada." });
    }
    throw new MLApiError({
      status: 0,
      code: "NETWORK",
      message: `Falha de rede em ${url}: ${err instanceof Error ? err.message : String(err)}`,
      cause: err,
    });
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onExternalAbort);
  }
}

async function readErrorBody(res: Response): Promise<MLErrorBody> {
  try {
    const text = await res.text();
    if (!text) return {};
    return JSON.parse(text) as MLErrorBody;
  } catch {
    return {};
  }
}

/// Executa a chamada aplicando timeout e retry (429/5xx/rede).
async function executeWithRetry<T>(url: string, init: RawInit): Promise<T> {
  let lastError: MLApiError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let res: Response;
    try {
      res = await fetchWithTimeout(url, init);
    } catch (err) {
      const apiErr = isMLApiError(err)
        ? err
        : new MLApiError({
            status: 0,
            code: "NETWORK",
            message: err instanceof Error ? err.message : String(err),
            cause: err,
          });
      if (apiErr.code === "ABORTED" || attempt === MAX_ATTEMPTS) throw apiErr;
      lastError = apiErr;
      await sleep(backoffDelay(attempt));
      continue;
    }

    if (res.ok) {
      try {
        return (await res.json()) as T;
      } catch (err) {
        throw new MLApiError({
          status: res.status,
          code: "BAD_RESPONSE",
          message: `Resposta não é JSON válido em ${url}`,
          cause: err,
        });
      }
    }

    const body = await readErrorBody(res);
    const message = body.message || body.error || `HTTP ${res.status} em ${url}`;

    if (isRetriableStatus(res.status) && attempt < MAX_ATTEMPTS) {
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      lastError = new MLApiError({
        status: res.status,
        code: res.status === 429 ? "RATE_LIMITED" : "HTTP_ERROR",
        message,
      });
      await sleep(retryAfter ?? backoffDelay(attempt));
      continue;
    }

    throw new MLApiError({
      status: res.status,
      code: res.status === 429 ? "RATE_LIMITED" : "HTTP_ERROR",
      message,
    });
  }

  throw (
    lastError ??
    new MLApiError({ status: 0, code: "NETWORK", message: `Falha desconhecida em ${url}` })
  );
}

// ------------------------------------------------------------ API pública

export type QueryValue = string | number | boolean | undefined | null;

export interface MLRequestOptions {
  method?: "GET" | "POST";
  searchParams?: Record<string, QueryValue>;
  /// Corpo já serializado (form-urlencoded ou JSON).
  body?: string;
  contentType?: string;
  /// false para chamadas públicas, sem Authorization.
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, searchParams?: Record<string, QueryValue>): string {
  const url = new URL(path.startsWith("http") ? path : `${ML_API_BASE}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/// Ponto único de saída para a API do ML.
export async function mlRequest<T>(path: string, options: MLRequestOptions = {}): Promise<T> {
  const useAuth = options.auth !== false;
  const url = buildUrl(path, options.searchParams);

  return gate.run(async () => {
    const send = async (token: string | null): Promise<T> => {
      const headers: Record<string, string> = { accept: "application/json" };
      if (token) headers.authorization = `Bearer ${token}`;
      if (options.body) headers["content-type"] = options.contentType ?? "application/json";

      return executeWithRetry<T>(url, {
        method: options.method ?? "GET",
        headers,
        body: options.body,
        signal: options.signal,
      });
    };

    if (!useAuth) return send(null);

    const token = await getAccessToken();
    try {
      return await send(token);
    } catch (err) {
      // Token revogado antes de expirar: descarta o cache e tenta uma vez mais.
      if (isMLApiError(err) && (err.status === 401 || err.status === 403)) {
        clearTokenCache();
        const fresh = await getAccessToken();
        return send(fresh);
      }
      throw err;
    }
  });
}
