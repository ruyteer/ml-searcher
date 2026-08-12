/// Retorno do Mercado Livre depois que o usuário autoriza a aplicação.
///
/// Também fica atrás do middleware de sessão. Como o ML redireciona o MESMO
/// navegador que iniciou o fluxo, o cookie de sessão viaja junto e a rota
/// abre normalmente. Não foi preciso afrouxar src/proxy.ts.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAuthenticated } from "@/lib/auth";
import { exchangeCode, isMLApiError } from "@/lib/ml";
import { REDIRECT_COOKIE, STATE_COOKIE, redirectWithError, settingsUrl } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", "/configuracoes");
    return NextResponse.redirect(login, { status: 303 });
  }

  const params = new URL(request.url).searchParams;
  const denied = params.get("error");
  if (denied) {
    const detalhe = params.get("error_description") ?? denied;
    return redirectWithError(request, `O Mercado Livre recusou a autorização: ${detalhe}`);
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code) {
    return redirectWithError(request, "O Mercado Livre não devolveu o código de autorização.");
  }

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  const redirectUri = jar.get(REDIRECT_COOKIE)?.value;

  // Proteção contra CSRF: só aceitamos o code se ele voltou da mesma rodada
  // que nós começamos. O ML não valida o state, quem valida é a aplicação.
  if (!expectedState || !state || state !== expectedState) {
    return redirectWithError(
      request,
      "A verificação de segurança falhou. Comece a conexão de novo pelo botão Conectar com o Mercado Livre.",
    );
  }

  if (!redirectUri) {
    return redirectWithError(
      request,
      "A sessão de autorização expirou. Comece a conexão de novo pelo botão Conectar com o Mercado Livre.",
    );
  }

  try {
    await exchangeCode(code, redirectUri);
  } catch (err) {
    const motivo = isMLApiError(err)
      ? err.message
      : "Falha inesperada ao trocar o código pelo token de acesso.";
    return redirectWithError(request, motivo);
  }

  const res = NextResponse.redirect(settingsUrl(request, { ml: "ok" }), { status: 303 });
  res.cookies.delete(STATE_COOKIE);
  res.cookies.delete(REDIRECT_COOKIE);
  return res;
}
