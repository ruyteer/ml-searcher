import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway roda o servidor standalone — reduz muito o tamanho da imagem.
  output: "standalone",

  images: {
    // Thumbnails dos produtos vêm dos CDNs do Mercado Livre.
    remotePatterns: [
      { protocol: "https", hostname: "http2.mlstatic.com" },
      { protocol: "https", hostname: "**.mlstatic.com" },
    ],
  },

  // O client do Prisma é gerado em src/generated/prisma; não deve ser
  // empacotado pelo bundler do servidor.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],

  async headers() {
    return [
      {
        // O arquivo do app instalado não pode ficar preso em cache do
        // navegador: é ele quem anuncia que existe versão nova. E o
        // cabeçalho de escopo permite que ele valha para o site inteiro.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/offline.html",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
