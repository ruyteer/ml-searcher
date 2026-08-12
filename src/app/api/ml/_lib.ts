/// Peças compartilhadas entre /api/ml/auth e /api/ml/callback.

import { NextResponse } from "next/server";

/// `state` da rodada de autorização em andamento. Vida curta: o usuário
/// autoriza em segundos, não em horas.
export const STATE_COOKIE = "ml_oauth_state";
/// A redirect URI usada na ida precisa ser repetida byte a byte na troca do
/// code, então viaja junto em vez de ser recalculada no callback.
export const REDIRECT_COOKIE = "ml_oauth_redirect";
export const OAUTH_COOKIE_MAX_AGE = 10 * 60;

const SETTINGS_PATH = "/configuracoes?aba=mercadolivre";

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };
}

/// Fonte aleatória para o `state`. O ML não valida esse valor, quem valida
/// somos nós: é o que impede um terceiro de plantar um code na nossa conta.
export function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function settingsUrl(request: Request, params?: Record<string, string>): URL {
  const url = new URL(SETTINGS_PATH, request.url);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }
  return url;
}

/// Volta para o painel com uma mensagem legível na querystring.
export function redirectWithError(request: Request, motivo: string): NextResponse {
  const res = NextResponse.redirect(settingsUrl(request, { ml: "erro", motivo }), { status: 303 });
  res.cookies.delete(STATE_COOKIE);
  res.cookies.delete(REDIRECT_COOKIE);
  return res;
}
