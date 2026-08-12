import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Este arquivo é carregado tanto no BUILD (pelo `prisma generate` do
// postinstall) quanto em RUNTIME (pelo `prisma migrate deploy` na subida do
// container). No build do Docker as variáveis de runtime ainda não existem,
// e `env("DATABASE_URL")` do prisma/config lança exceção quando a variável
// falta, o que quebrava a imagem inteira no `npm ci`.
//
// `generate` não precisa de conexão: só lê o schema. Então lemos a variável
// direto de process.env e deixamos vazia quando ela não existir. Em runtime
// a variável está definida e as migrations rodam normalmente.
const databaseUrl = process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: databaseUrl,
  },
});
