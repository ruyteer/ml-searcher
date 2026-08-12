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
};

export default nextConfig;
