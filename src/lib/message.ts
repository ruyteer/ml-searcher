// Motor de template das mensagens de oferta — função pura, sem dependência
// de banco nem de React. A fase de WhatsApp reusa isto para montar a
// mensagem final antes de enviar pro grupo.
import { formatBRL } from "./format";

/// Variáveis suportadas nos templates. A ordem aqui é a ordem em que os
/// botões de inserir variável aparecem na UI.
export const TEMPLATE_VARIABLE_NAMES = [
  "titulo",
  "preco",
  "precoAntigo",
  "desconto",
  "link",
  "frase",
] as const;

export type TemplateVariableName = (typeof TEMPLATE_VARIABLE_NAMES)[number];

export interface TemplateVariableDef {
  name: TemplateVariableName;
  /// Rótulo curto para os botões de inserir variável.
  label: string;
  /// Legenda em português explicando o que a variável representa.
  description: string;
  /// Valor de exemplo usado no preview ao vivo.
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVariableDef[] = [
  {
    name: "titulo",
    label: "Título",
    description: "Nome do produto anunciado",
    example: "Máquina de Cortar Cabelo Profissional",
  },
  {
    name: "preco",
    label: "Preço",
    description: "Preço atual da oferta, já formatado em reais",
    example: "R$ 89,90",
  },
  {
    name: "precoAntigo",
    label: "Preço antigo",
    description: "Preço anterior/original, já formatado em reais",
    example: "R$ 149,90",
  },
  {
    name: "desconto",
    label: "Desconto",
    description: "Percentual de desconto (só o número, sem o símbolo %)",
    example: "40",
  },
  {
    name: "link",
    label: "Link",
    description: "Link de afiliado/rastreado que leva até a oferta",
    example: "https://exemplo.com/r/abc123",
  },
  {
    name: "frase",
    label: "Frase",
    description: "Frase de abertura, urgência ou CTA sorteada do banco de frases",
    example: "🔥 ACHADO DO DIA",
  },
];

const KNOWN_VARIABLE_NAMES = new Set<string>(TEMPLATE_VARIABLE_NAMES);

export function isKnownVariable(name: string): name is TemplateVariableName {
  return KNOWN_VARIABLE_NAMES.has(name);
}

/// Casa {{titulo}}, {{ titulo }}, {{  titulo  }} etc — aceita espaços dentro
/// das chaves.
const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type TemplateVars = Partial<Record<TemplateVariableName, string>>;

/// Substitui as variáveis do template pelo valor correspondente em `vars`.
/// Variável não fornecida vira string vazia. Uma linha que tinha conteúdo
/// (ex.: só a variável {{frase}}) e ficou inteiramente em branco depois da
/// substituição é removida — senão a mensagem final sai cheia de buracos.
/// Linhas que já eram em branco no template original (espaçamento
/// intencional entre parágrafos) são preservadas.
export function renderTemplate(body: string, vars: TemplateVars): string {
  const lines = body.split("\n").map((line) => {
    const wasBlank = line.trim() === "";
    const substituted = line.replace(VARIABLE_RE, (_match, name: string) => {
      return vars[name as TemplateVariableName] ?? "";
    });
    const isBlankNow = substituted.trim() === "";
    if (!wasBlank && isBlankNow) return null;
    return substituted;
  });

  return lines.filter((line): line is string => line !== null).join("\n");
}

/// Lista (sem duplicatas, na ordem de primeira ocorrência) dos nomes de
/// variável usados no corpo de um template — inclusive nomes desconhecidos,
/// para a UI poder avisar sobre eles.
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(VARIABLE_RE)) {
    found.add(match[1]);
  }
  return [...found];
}

/// Variáveis usadas no template que não existem em TEMPLATE_VARIABLES.
export function extractUnknownVariables(body: string): string[] {
  return extractVariables(body).filter((name) => !isKnownVariable(name));
}

export interface BuildMessageVarsInput {
  titulo?: string | null;
  /// Preço atual, em centavos.
  precoCents?: number | null;
  /// Preço anterior/original, em centavos.
  precoAntigoCents?: number | null;
  /// Percentual de desconto (0-100).
  desconto?: number | null;
  link?: string | null;
  frase?: string | null;
}

/// Monta o objeto de variáveis pronto para renderTemplate, já formatando os
/// preços em reais (formatBRL) e o desconto como texto. Campos ausentes
/// simplesmente não entram no objeto — renderTemplate trata o resto.
export function buildMessageVars(input: BuildMessageVarsInput): TemplateVars {
  const vars: TemplateVars = {};

  if (input.titulo) vars.titulo = input.titulo;
  if (typeof input.precoCents === "number" && Number.isFinite(input.precoCents)) {
    vars.preco = formatBRL(input.precoCents);
  }
  if (typeof input.precoAntigoCents === "number" && Number.isFinite(input.precoAntigoCents)) {
    vars.precoAntigo = formatBRL(input.precoAntigoCents);
  }
  if (typeof input.desconto === "number" && Number.isFinite(input.desconto)) {
    vars.desconto = String(Math.round(input.desconto));
  }
  if (input.link) vars.link = input.link;
  if (input.frase) vars.frase = input.frase;

  return vars;
}

/// Vars de exemplo (TEMPLATE_VARIABLES[].example) — usadas no preview ao
/// vivo do editor de template quando não há uma oferta real selecionada.
export function exampleVars(): TemplateVars {
  const vars: TemplateVars = {};
  for (const v of TEMPLATE_VARIABLES) vars[v.name] = v.example;
  return vars;
}
