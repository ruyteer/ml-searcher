/// Início do fluxo OAuth: manda o usuário para o Mercado Livre autorizar.
///
/// A rota fica atrás do middleware de sessão (não está em PUBLIC_PREFIXES de
/// src/proxy.ts), o que é o certo: só quem já entrou no painel pode iniciar
/// uma autorização. A checagem abaixo é a validação criptográfica de fato, já
/// que o middleware só confere a presença do cookie.

import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getAuthorizeUrl, getMlRedirectUri, isMLApiError } from "@/lib/ml";
import { REDIRECT_COOKIE, STATE_COOKIE, cookieOptions, randomState, redirectWithError } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", "/configuracoes");
    return NextResponse.redirect(login, { status: 303 });
  }

  // Sem redirect URI salva, usa o callback desta própria instalação. Em
  // localhost isso não vai funcionar do lado do ML (ele exige HTTPS), e é
  // exatamente por isso que existe o modo manual no painel.
  const saved = await getMlRedirectUri();
  const redirectUri = saved || new URL("/api/ml/callback", request.url).toString();

  const state = randomState();

  let authorizeUrl: string;
  try {
    authorizeUrl = await getAuthorizeUrl(redirectUri, state);
  } catch (err) {
    if (isMLApiError(err) && err.code === "NO_CREDENTIALS") {
      return redirectWithError(
        request,
        "Preencha o App ID e a Secret Key antes de conectar a conta.",
      );
    }
    return redirectWithError(request, "Não foi possível montar a URL de autorização.");
  }

  const res = NextResponse.redirect(authorizeUrl, { status: 307 });
  res.cookies.set(STATE_COOKIE, state, cookieOptions());
  res.cookies.set(REDIRECT_COOKIE, redirectUri, cookieOptions());
  return res;
}
