// Espelho dos enums do prisma/schema.prisma em TypeScript puro, sem nenhum
// import do Prisma. Existe porque `import { LinkKind } from "@/generated/prisma"`
// é import de VALOR: arrasta o runtime do Prisma Client (e o driver `pg`) para
// dentro do bundle do navegador e quebra qualquer página com "use client".
//
// Regra: componentes cliente importam daqui. Código de servidor pode continuar
// usando o enum do Prisma. Os valores string são idênticos, então os dois lados
// convivem sem conversão.
//
// Se mexer nos enums do schema, atualize este arquivo junto. Não "simplifique"
// voltando a importar do Prisma.

export const LinkKind = {
  DIRECT: "DIRECT",
  TRACKED: "TRACKED",
  PRESELL: "PRESELL",
} as const;
export type LinkKind = (typeof LinkKind)[keyof typeof LinkKind];

export const OfferStatus = {
  NEW: "NEW",
  PUBLISHED: "PUBLISHED",
  IGNORED: "IGNORED",
} as const;
export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];

export const RunStatus = {
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  PARTIAL: "PARTIAL",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];
