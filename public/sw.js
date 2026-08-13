/*
  Service worker do ML Searcher.

  Este é um painel com sessão e com dados que mudam o tempo todo (preço,
  oferta, clique). Guardar página ou resposta de API em cache aqui daria
  informação errada e, pior, poderia entregar tela de gente logada para
  quem não deveria ver. Então a regra é curta:

    - GUARDA: só o estático de build (/_next/static, com nome versionado),
      os ícones do app e a página de "sem conexão".
    - NÃO GUARDA: nada de HTML, nada de /api, nada de payload do React
      (as requisições com _rsc), nada que não seja GET, nada de outro
      domínio, nada de imagem otimizada de produto.

  Navegação usa rede primeiro. Se a rede falhar, cai na página de
  "sem conexão", que é honesta: avisa que está offline e oferece recarregar.

  Ao mudar o conteúdo deste arquivo, suba a VERSAO. O activate apaga todo
  cache de versão anterior, então nunca fica preso numa versão velha.
*/

const VERSAO = "v1";
const CACHE_ESTATICO = `mls-estatico-${VERSAO}`;
const CACHE_CASCA = `mls-casca-${VERSAO}`;
const CACHES_ATUAIS = [CACHE_ESTATICO, CACHE_CASCA];

const PAGINA_OFFLINE = "/offline.html";

// Arquivos garantidos já na instalação: a tela de sem conexão precisa
// funcionar mesmo que a pessoa nunca tenha aberto ela antes.
const ESSENCIAIS = [PAGINA_OFFLINE, "/icons/icone-192.png"];

/*
  Guarda os essenciais um a um, tolerando falha.

  O painel é protegido por sessão, e a rota da página de sem conexão passa
  pela mesma checagem. Se a sessão tiver expirado bem na hora da instalação,
  a resposta vem como redirecionamento para o login; guardar isso seria pior
  que não guardar nada. Nesse caso a instalação segue mesmo assim, e o
  fallback vira uma mensagem simples de texto.
*/
async function guardarEssenciais() {
  const cache = await caches.open(CACHE_CASCA);
  await Promise.all(
    ESSENCIAIS.map(async (caminho) => {
      try {
        const resposta = await fetch(caminho, { cache: "reload" });
        if (!resposta.ok || resposta.redirected) return;
        await cache.put(caminho, resposta);
      } catch {
        // Sem rede agora: tenta de novo na próxima instalação.
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(guardarEssenciais());
  // Sem skipWaiting aqui de propósito: a página decide a hora de trocar
  // (ver a mensagem "pular-espera" mais abaixo).
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((nome) => nome.startsWith("mls-") && !CACHES_ATUAIS.includes(nome))
          .map((nome) => caches.delete(nome))
      );
      await self.clients.claim();
    })()
  );
});

// A página avisa quando quer adotar a versão nova imediatamente.
self.addEventListener("message", (event) => {
  if (event.data === "pular-espera") self.skipWaiting();
});

/// Só entra em cache o que tem nome versionado pelo build ou o que é ícone
/// do próprio app. Qualquer outra coisa passa direto para a rede.
function ehEstaticoDeBuild(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  return url.pathname === "/apple-touch-icon.png" || url.pathname === "/favicon.ico";
}

async function responderNavegacao(request) {
  try {
    // Rede primeiro, sempre. A resposta não vai para cache nenhum: é HTML
    // de sessão autenticada.
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_CASCA);
    const offline = await cache.match(PAGINA_OFFLINE);
    if (offline) return offline;
    return new Response("Sem conexão.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function responderEstatico(request) {
  const cache = await caches.open(CACHE_ESTATICO);
  const guardado = await cache.match(request);
  if (guardado) return guardado;

  const resposta = await fetch(request);
  // Só guarda resposta completa e do próprio domínio. Resposta parcial
  // (206) ou opaca não serve para servir de volta depois.
  if (resposta.ok && resposta.type === "basic") {
    cache.put(request, resposta.clone());
  }
  return resposta;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Outro domínio (CDN de imagem do Mercado Livre, por exemplo): nem toca.
  if (url.origin !== self.location.origin) return;

  // Dados vivos e sessão: sempre rede, nunca cache.
  if (url.pathname.startsWith("/api/")) return;
  // Payload de navegação do React e rota de redirecionamento pública.
  if (url.searchParams.has("_rsc")) return;
  if (url.pathname.startsWith("/r/")) return;
  // Imagem de produto otimizada muda junto com a oferta.
  if (url.pathname.startsWith("/_next/image")) return;

  if (request.mode === "navigate") {
    event.respondWith(responderNavegacao(request));
    return;
  }

  if (ehEstaticoDeBuild(url)) {
    event.respondWith(responderEstatico(request));
  }
});
