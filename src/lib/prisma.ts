import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function instance(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;

  const created = create();
  globalForPrisma.prisma = created;
  return created;
}

/// A instanciação é preguiçosa de propósito. `next build` importa as rotas
/// para coletar configuração, e no build do Docker o DATABASE_URL ainda não
/// existe: criar o client no topo do módulo derrubava a imagem inteira.
/// Com o Proxy, o client só nasce na primeira consulta de verdade, que
/// sempre acontece em runtime, quando a variável já está definida.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(instance() as object, prop, receiver);
  },
  has(_target, prop) {
    return Reflect.has(instance() as object, prop);
  },
});
