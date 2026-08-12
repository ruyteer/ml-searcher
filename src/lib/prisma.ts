import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function create() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
