/// Funções puras de máscara e normalização de campos de formulário. Sem
/// React, sem DOM: recebem o texto atual do campo e devolvem o texto
/// mascarado. Cada função é idempotente (aplicar duas vezes dá o mesmo
/// resultado) para que o cursor não pule enquanto o usuário digita.
///
/// Dinheiro é a exceção que precisa de um par: o banco guarda centavos (ver
/// src/lib/format.ts), então além de mascarar a digitação também exportamos
/// moneyToCents/centsToMasked para converter entre o texto mascarado e os
/// centavos que os schemas zod e o Prisma esperam.

// ------------------------------------------------------------------ dinheiro

/// Formata um valor em centavos (inteiro, >= 0) como "1.234,56".
export function centsToMasked(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
  const digits = String(safe).padStart(3, "0");
  const centsPart = digits.slice(-2);
  const intPart = digits.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withThousands},${centsPart}`;
}

/// Digitação progressiva de dinheiro em pt-BR: o usuário só enxerga dígitos
/// (os últimos dois viram centavos), então tanto digitar quanto colar texto
/// ("R$ 1.234,56", "1234.56"...) convergem para o mesmo resultado.
export function maskMoney(input: string): string {
  if (!input) return "";
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  return centsToMasked(parseInt(digits, 10));
}

/// Texto mascarado ("1.234,56") -> número em REAIS.
export function unmaskMoney(masked: string): number {
  return moneyToCents(masked) / 100;
}

/// Texto mascarado ("1.234,56") -> número inteiro em CENTAVOS (o que o banco guarda).
export function moneyToCents(masked: string): number {
  if (!masked) return 0;
  const digits = masked.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

// ------------------------------------------------------------------ inteiros

/// Inteiro sem sinal, sem casas decimais, com corte opcional de faixa. Nunca
/// impõe o mínimo enquanto digita (senão o usuário nunca conseguiria digitar
/// "1" de "15" com min=10) — o mínimo é responsabilidade da validação.
export function maskInteger(input: string, opts?: { min?: number; max?: number }): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  let n = parseInt(digits, 10);
  if (opts?.max != null && n > opts.max) n = opts.max;
  return String(n);
}

/// Inteiro de 0 a 100 (percentual). Implementado em cima de maskInteger.
export function maskPercent(input: string): string {
  return maskInteger(input, { min: 0, max: 100 });
}

// ----------------------------------------------------------------------- url

const URL_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

/// Apara espaços e completa "https://" quando o usuário não digitou nenhum
/// protocolo. Não mexe em URLs que já vieram com protocolo próprio.
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (URL_PROTOCOL_RE.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// ---------------------------------------------------------------------- slug

/// Marcas diacríticas (acentos, til, cedilha decomposta) depois de
/// String.normalize("NFD") — faixa Unicode ̀-ͯ.
const DIACRITIC_RE = /[̀-ͯ]/g;

/// Minúsculas, sem acento, espaço vira hífen, remove o que não for
/// letra/número/hífen e nunca deixa hífen duplicado ou no início.
export function maskSlug(input: string): string {
  const withoutAccents = input.normalize("NFD").replace(DIACRITIC_RE, "");
  return withoutAccents
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
}

// ---------------------------------------------------------- ID de categoria

/// IDs de categoria do Mercado Livre são um prefixo de site (MLB, MLA, MCO...)
/// seguido de dígitos. Aqui só forçamos maiúsculas e bloqueamos caractere
/// inválido enquanto digita — o formato exato é responsabilidade do zod.
export function maskCategoryId(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
