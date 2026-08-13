import type { MetadataRoute } from "next";

/// Manifesto do app instalável, servido em /manifest.webmanifest.
///
/// Observação sobre autenticação: o painel exige sessão, e o navegador busca
/// o manifesto sem enviar cookie por padrão. Por isso o <link rel="manifest">
/// da raiz vai com crossOrigin="use-credentials" (ver src/app/layout.tsx),
/// senão a instalação falharia com uma resposta de redirecionamento.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "ML Searcher",
    short_name: "ML Searcher",
    description: "Ofertas, produtos e links de afiliado do Mercado Livre no bolso.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Mesmos tons do tema escuro (--background e --primary de globals.css).
    background_color: "#090a0d",
    theme_color: "#090a0d",
    categories: ["business", "shopping", "productivity"],
    icons: [
      {
        src: "/icons/icone-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icone-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icone-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icone-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icone.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      { name: "Ofertas", short_name: "Ofertas", url: "/ofertas" },
      { name: "Produtos", short_name: "Produtos", url: "/produtos" },
      { name: "Links", short_name: "Links", url: "/links" },
    ],
  };
}
