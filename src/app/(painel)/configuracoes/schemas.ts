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

/// Só os campos que decidem o que APARECE, para a prévia calculada enquanto a
/// pessoa mexe nos campos. Diferenças propositais em relação ao schema do
/// formulário: `minPrice` já chega em centavos (o campo é mascarado e o cliente
/// converte antes de mandar) e nada aqui reprova o envio — valor fora de faixa
/// cai no limite mais próximo, porque a prévia precisa responder mesmo com a
/// combinação ainda pela metade (ex.: "imperdível" abaixo do mínimo enquanto a
/// pessoa está no meio da digitação).
const zInteiroNaFaixa = (min: number, max: number) =>
  z.preprocess((v) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }, z.number().int());

export const detectionPreviewSchema = z.object({
  minDiscount: zInteiroNaFaixa(0, 100),
  hotDiscount: zInteiroNaFaixa(0, 100),
  minPrice: zInteiroNaFaixa(0, 99_999_900),
  minSoldQuantity: zInteiroNaFaixa(0, 1_000_000),
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

// ------------------------------------------------------ filtro por palavras

/// Teto generoso de texto cru: a lista é limpa e limitada pelo `parseWordList`
/// depois, aqui só barramos um envio absurdo.
const MAX_TEXTO_PALAVRAS = 8_000;

export const wordFilterSchema = z.object({
  filterExcludeWords: z.string().max(MAX_TEXTO_PALAVRAS),
  filterRequireWords: z.string().max(MAX_TEXTO_PALAVRAS),
});

// ---------------------------------------------------------- links: afiliado

export const affiliateSchema = z.object({
  affiliateEnabled: zBoolFromString,
  affiliateTool: z.string().trim().max(100),
  affiliateWord: z.string().trim().max(100),
});

/// Curl colado do devtools (aba Network, botão "Copy as cURL") com a sessão
/// logada do painel de afiliados. O parsing de verdade (extrair cookie e
/// x-csrf-token) acontece na action — aqui só barra um envio vazio ou absurdo.
export const affiliateSessionSchema = z.object({
  curl: z.string().trim().min(1, "Cole o comando curl da sessão.").max(20_000),
});

// ---------------------------------------------------------------- mercado livre

export const mlSchema = z.object({
  mlClientId: z.string().trim().max(200),
  /// Vazio = mantém o secret já salvo (nunca é reexibido em texto puro).
  mlClientSecret: z.string().trim().max(200),
  mlSiteId: z.string().trim().min(2).max(10),
});

/// Tipo de produto do Mercado Livre: MLB- seguido de letras, números e
/// sublinhado, por exemplo MLB-RAZOR_BLADES.
const DOMAIN_ID_RE = /^MLB-[A-Z0-9_]+$/;

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
    domainId: z
      .string()
      .trim()
      .toUpperCase()
      .max(60)
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || DOMAIN_ID_RE.test(v), {
        message: "Formato esperado: MLB- seguido de letras, números e sublinhado (ex.: MLB-RAZOR_BLADES).",
      }),
    limit: z.coerce.number().int().min(10).max(1000),
    minDiscount: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.union([z.null(), z.coerce.number().int().min(0).max(90)]),
    ),
    enabled: zBoolFromString,
  })
  .refine((v) => Boolean(v.categoryId) || Boolean(v.query), {
    message: "Preencha o código da categoria ou o termo de busca (pelo menos um).",
    path: ["query"],
  });
