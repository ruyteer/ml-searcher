import { z } from "zod";

/// FormData só entrega string. Os Switch desta página mandam "true"/"false"
/// via hidden input (value/uncheckedValue) — por isso o preprocess manual em
/// vez de z.coerce.boolean(), que trataria "false" (string não-vazia) como true.
const zBoolFromString = z.preprocess((v) => v === "true" || v === true, z.boolean());

// ------------------------------------------------------- detecção de ofertas

export const detectionSchema = z
  .object({
    minDiscount: z.coerce.number().int().min(0).max(100),
    hotDiscount: z.coerce.number().int().min(0).max(100),
    minHistoryPoints: z.coerce.number().int().min(1).max(50),
    /// Em reais — convertido para centavos na action antes de chamar setSettings.
    minPrice: z.coerce.number().min(0).max(999_999),
    minSoldQuantity: z.coerce.number().int().min(0).max(1_000_000),
  })
  .refine((v) => v.hotDiscount >= v.minDiscount, {
    message: "Precisa ser maior ou igual ao desconto mínimo.",
    path: ["hotDiscount"],
  });

// -------------------------------------------------------------- links: domínio

export const domainSchema = z.object({
  publicBaseUrl: z
    .string()
    .trim()
    .transform((v) => v.replace(/\/+$/, ""))
    .refine((v) => v === "" || /^https?:\/\/.+/i.test(v), {
      message: "Informe uma URL http(s) válida ou deixe em branco.",
    }),
});

// ---------------------------------------------------------- links: afiliado

export const affiliateSchema = z.object({
  affiliateEnabled: zBoolFromString,
  affiliateTool: z.string().trim().max(100),
  affiliateWord: z.string().trim().max(100),
});

// ---------------------------------------------------------------- mercado livre

export const mlSchema = z.object({
  mlClientId: z.string().trim().max(200),
  /// Vazio = mantém o secret já salvo (nunca é reexibido em texto puro).
  mlClientSecret: z.string().trim().max(200),
  mlSiteId: z.string().trim().min(2).max(10),
});

// -------------------------------------------------------- categoria monitorada

export const watchSchema = z
  .object({
    label: z.string().trim().min(1, "Informe um rótulo.").max(120),
    categoryId: z
      .string()
      .trim()
      .max(30)
      .transform((v) => (v === "" ? null : v)),
    query: z
      .string()
      .trim()
      .max(200)
      .transform((v) => (v === "" ? null : v)),
    limit: z.coerce.number().int().min(10).max(1000),
    minDiscount: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.union([z.null(), z.coerce.number().int().min(0).max(90)]),
    ),
    enabled: zBoolFromString,
  })
  .refine((v) => Boolean(v.categoryId) || Boolean(v.query), {
    message: "Preencha o ID de categoria ou o termo de busca (pelo menos um).",
    path: ["query"],
  });
