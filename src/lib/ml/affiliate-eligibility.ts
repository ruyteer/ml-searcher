/// Checagem de elegibilidade no programa de afiliados do Mercado Livre.
///
/// Não existe API pública para isso — nem para gerar link, nem para consultar
/// elegibilidade. O único jeito real é o mesmo que o painel de afiliados usa
/// por baixo (POST /affiliate-program/api/v2/affiliates/createLink), com uma
/// sessão logada de verdade. Por isso o usuário cola o curl da sessão (do
/// devtools do navegador) e este módulo extrai o que precisa dele.
///
/// Contrato da resposta, confirmado batendo na API real:
///   sucesso:  urls[0].created === true
///   rejeição: urls[0].error_code presente (ex.: 111, "URL not allowed in
///             affiliates program") — o HTTP status continua 200 nos dois casos.

import "server-only";
import { getSettings } from "../settings";

const CREATE_LINK_URL = "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink";

// ------------------------------------------------------------- parsing do curl

export interface ParsedAffiliateSession {
  /// Header Cookie inteiro, como veio do curl — precisa de várias cookies
  /// juntas (sessão, csrf, fingerprint), não só uma.
  cookie: string;
  csrfToken: string;
  /// Decodificada do JWT nsa_rotok dentro do cookie. null = não achou/não
  /// decodificou (segue sem data conhecida; a checagem em ciclo ainda pega
  /// sessão expirada pela resposta da API).
  expiresAt: Date | null;
}

function extractCookie(raw: string): string | null {
  const flag = raw.match(/(?:-b|--cookie)\s+'([^']*)'/) ?? raw.match(/(?:-b|--cookie)\s+"([^"]*)"/);
  if (flag) return flag[1];
  const header = raw.match(/-H\s+'cookie:\s*([^']*)'/i) ?? raw.match(/-H\s+"cookie:\s*([^"]*)"/i);
  return header ? header[1] : null;
}

function extractCsrfToken(raw: string): string | null {
  const header =
    raw.match(/-H\s+'x-csrf-token:\s*([^']+)'/i) ?? raw.match(/-H\s+"x-csrf-token:\s*([^"]+)"/i);
  return header ? header[1].trim() : null;
}

function decodeJwtExpiry(jwt: string): Date | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}

/// Corta um texto colado em blocos, um por comando `curl` (o devtools às
/// vezes copia vários de uma vez, separados por `;`). Cada linha que começa
/// com "curl " abre um bloco novo.
function splitCurlBlocks(raw: string): string[] {
  const blocks = raw
    .split(/(?=^\s*curl\s)/m)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.length > 0 ? blocks : [raw];
}

function sessionFromBlock(block: string): ParsedAffiliateSession | null {
  const cookie = extractCookie(block);
  const csrfToken = extractCsrfToken(block);
  if (!cookie || !csrfToken) return null;

  const rotok = cookie.match(/nsa_rotok=([^;]+)/);
  const expiresAt = rotok ? decodeJwtExpiry(rotok[1]) : null;
  return { cookie, csrfToken, expiresAt };
}

/// Extrai cookie + csrf token de um curl colado do devtools. Quando o texto
/// tem vários curls juntos (comum ao colar direto da aba Network), cookie e
/// token são pareados DENTRO do mesmo bloco — nunca cookie de um comando com
/// token de outro, mesmo que o texto tenha vários pares válidos misturados.
/// null quando nenhum bloco tem os dois campos.
export function parseAffiliateCurl(raw: string): ParsedAffiliateSession | null {
  for (const block of splitCurlBlocks(raw)) {
    const session = sessionFromBlock(block);
    if (session) return session;
  }
  return null;
}

/// Lê a sessão salva nas configurações. null = ainda não configurada.
export async function getAffiliateSession(): Promise<ParsedAffiliateSession | null> {
  const settings = await getSettings();
  if (!settings.affiliateSessionCookie || !settings.affiliateSessionCsrfToken) return null;
  return {
    cookie: settings.affiliateSessionCookie,
    csrfToken: settings.affiliateSessionCsrfToken,
    expiresAt: settings.affiliateSessionExpiresAt ? new Date(settings.affiliateSessionExpiresAt) : null,
  };
}

// ------------------------------------------------------------------- checagem

export type EligibilityResult =
  | { outcome: "eligible" }
  | { outcome: "rejected"; message: string; errorCode: number | null }
  /// Sessão vencida ou revogada — quem chama deve marcar
  /// affiliateSessionInvalid e parar de consumir o resto do lote.
  | { outcome: "session_expired" }
  /// Falha transitória (rede, formato inesperado) — não decide nada sobre o
  /// produto, só tenta de novo no próximo ciclo.
  | { outcome: "error"; message: string };

interface CreateLinkResponseItem {
  created?: boolean;
  error_code?: number;
  message?: string;
}

interface CreateLinkResponse {
  urls?: CreateLinkResponseItem[];
}

export interface EligibilityCheckProduct {
  /// Anúncio vencedor (mlId em NormalizedProduct/Product).
  mlId: string;
  catalogId: string | null;
  permalink: string;
}

/// Chama o mesmo endpoint que o botão "Gerar link" do painel de afiliados usa.
/// `tag` no corpo é o matt_word (settings.affiliateWord) — o matt_tool não vai
/// no request, o Mercado Livre resolve ele pela sessão.
export async function checkAffiliateEligibility(
  product: EligibilityCheckProduct,
  session: ParsedAffiliateSession,
  affiliateWord: string,
  signal?: AbortSignal,
): Promise<EligibilityResult> {
  if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
    return { outcome: "session_expired" };
  }

  const urlPath = product.permalink.replace(/^https?:\/\//, "").split("?")[0];
  const type = product.catalogId ? "product" : "user_product";

  let res: Response;
  try {
    res = await fetch(CREATE_LINK_URL, {
      method: "POST",
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "content-type": "application/json",
        origin: "https://www.mercadolivre.com.br",
        referer: "https://www.mercadolivre.com.br/afiliados/hub",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        cookie: session.cookie,
        "x-csrf-token": session.csrfToken,
      },
      body: JSON.stringify({
        itemId: product.mlId,
        itemAddToList: product.mlId,
        tag: affiliateWord,
        type,
        urls: [urlPath],
        extraCommission: "false",
      }),
      signal,
    });
  } catch (err) {
    return { outcome: "error", message: err instanceof Error ? err.message : String(err) };
  }

  if (res.status === 401 || res.status === 403) return { outcome: "session_expired" };
  if (!res.ok) return { outcome: "error", message: `HTTP ${res.status}` };

  let data: CreateLinkResponse;
  try {
    data = await res.json();
  } catch {
    // resposta não é JSON — normalmente página de login, sessão caiu.
    return { outcome: "session_expired" };
  }

  const item = data.urls?.[0];
  if (item?.created) return { outcome: "eligible" };
  if (item?.error_code !== undefined) {
    return {
      outcome: "rejected",
      message: item.message ?? "Rejeitado pelo programa de afiliados.",
      errorCode: item.error_code ?? null,
    };
  }
  return { outcome: "error", message: "Resposta inesperada do gerador de link." };
}
