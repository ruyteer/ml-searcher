import { NextResponse, type NextRequest } from "next/server";

// Precisa bater com SESSION_COOKIE em src/lib/auth.ts. Duplicado aqui de
// propósito: o middleware roda em Edge e não pode importar aquele módulo
// (usa "server-only" + Web Crypto assíncrono via next/headers). A validação
// criptográfica de fato acontece no layout do painel (server component).
const SESSION_COOKIE = "mls_session";

// Prefixos que não exigem sessão: login, redirecionador público, pre-sells
// públicas, rotas de auth/cron e os assets internos do Next.
const PUBLIC_PREFIXES = ["/login", "/r/", "/p/", "/api/auth/", "/api/cron/"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  return (
    pathname === "/favicon.ico" ||
    pathname.startsWith("/_next/") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml)$/.test(pathname)
  );
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Repassa o pathname atual para os server components (o layout do painel
  // usa isso para renderizar o título da página no topbar sem precisar de
  // um client component escutando a navegação).
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
