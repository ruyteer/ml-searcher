// Motor de conteúdo das páginas de aquecimento (pre-sell). Função pura: sem
// banco, sem React, sem "server-only" — o editor do painel (componente
// cliente) e a página pública renderizam exatamente o mesmo resultado.
//
// A ideia central: uma pre-sell é um MODELO. Os campos de conteúdo aceitam
// variáveis do produto e, quando ficam vazios, o valor sai automaticamente do
// produto do link que abriu a página. Assim um único modelo atende centenas de
// produtos diferentes.
import { formatBRL, discountPct } from "@/lib/format";
import { renderTemplate, extractVariables, type TemplateVars } from "@/lib/message";

// -------------------------------------------------------------- variáveis

/// Variáveis aceitas nos campos do modelo. A ordem aqui é a ordem dos botões
/// de inserir variável no editor.
export const PRESELL_VARIABLE_NAMES = [
  "titulo",
  "preco",
  "precoAntigo",
  "desconto",
  "imagem",
] as const;

export type PresellVariableName = (typeof PRESELL_VARIABLE_NAMES)[number];

export interface PresellVariableDef {
  name: PresellVariableName;
  /// Rótulo curto, em português, para o botão.
  label: string;
  /// Explicação exibida ao passar o mouse.
  description: string;
  /// Valor usado quando não há produto real escolhido no preview.
  example: string;
}

export const PRESELL_VARIABLES: PresellVariableDef[] = [
  {
    name: "titulo",
    label: "Título",
    description: "Nome do produto que a pessoa vai ver",
    example: "Máquina de Cortar Cabelo Profissional",
  },
  {
    name: "preco",
    label: "Preço",
    description: "Preço da oferta, já escrito em reais",
    example: "R$ 89,90",
  },
  {
    name: "precoAntigo",
    label: "Preço antigo",
    description: "Preço de antes da promoção, já escrito em reais",
    example: "R$ 149,90",
  },
  {
    name: "desconto",
    label: "Desconto",
    description: "Quanto o produto baixou, só o número (sem o sinal de %)",
    example: "40",
  },
  {
    name: "imagem",
    label: "Foto",
    description: "Endereço da foto do produto. Use no campo de imagem",
    example: "https://http2.mlstatic.com/exemplo.jpg",
  },
];

const KNOWN = new Set<string>(PRESELL_VARIABLE_NAMES);

/// Variáveis escritas no campo que não existem na lista acima. O editor avisa
/// sobre elas para o usuário não achar que esqueceu de configurar algo.
export function unknownPresellVariables(text: string): string[] {
  return extractVariables(text).filter((name) => !KNOWN.has(name));
}

/// true quando o texto usa pelo menos uma variável. Serve para o painel dizer
/// "este campo muda conforme o produto".
export function usesVariables(text: string | null | undefined): boolean {
  if (!text) return false;
  return extractVariables(text).length > 0;
}

// ------------------------------------------------------------------ dados

/// O pedaço do produto que a página de aquecimento consome.
export interface PresellProduct {
  id: string;
  title: string;
  thumbnail: string | null;
  /// Em centavos.
  price: number;
  /// Em centavos, quando o Mercado Livre informa o "de".
  originalPrice: number | null;
}

/// Os campos crus do modelo, do jeito que estão no banco.
export interface PresellTemplate {
  /// Nome interno do modelo.
  title: string;
  headline: string | null;
  body: string | null;
  ctaText: string;
  imageUrl: string | null;
  /// Centavos. Nulo = usa o preço do produto.
  priceLabel: number | null;
  originalLabel: number | null;
  gateUrl: string | null;
  gateLabel: string;
  gateDelay: number;
}

/// Conteúdo final, pronto para virar HTML.
export interface ResolvedPresell {
  /// Título da aba do navegador e do compartilhamento.
  pageTitle: string;
  headline: string;
  body: string;
  ctaText: string;
  imageUrl: string | null;
  /// Centavos.
  priceCents: number | null;
  originalCents: number | null;
  discount: number;
  gateUrl: string | null;
  gateLabel: string;
  gateDelay: number;
}

// ------------------------------------------------------------- resolução

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/// Monta os valores das variáveis a partir do produto. Sem produto, devolve
/// objeto vazio: as variáveis somem do texto e as linhas que ficaram só com
/// elas são removidas por renderTemplate.
export function presellVars(product: PresellProduct | null): TemplateVars {
  if (!product) return {};

  const vars: Record<string, string> = { titulo: product.title, preco: formatBRL(product.price) };

  if (product.originalPrice != null && product.originalPrice > product.price) {
    vars.precoAntigo = formatBRL(product.originalPrice);
    vars.desconto = String(discountPct(product.price, product.originalPrice));
  }
  if (product.thumbnail) vars.imagem = product.thumbnail;

  return vars as TemplateVars;
}

/// Valores de exemplo, usados no preview quando nenhum produto real foi
/// escolhido.
export function examplePresellVars(): TemplateVars {
  const vars: Record<string, string> = {};
  for (const v of PRESELL_VARIABLES) vars[v.name] = v.example;
  return vars as TemplateVars;
}

/// Regra de ouro do modelo:
/// - campo preenchido com texto puro vale como está;
/// - campo preenchido com variáveis é trocado pelos dados do produto;
/// - campo vazio cai no dado do produto (quando existe).
export function resolvePresell(
  template: PresellTemplate,
  product: PresellProduct | null,
  /// Variáveis já prontas. Só o preview passa isto, para usar os exemplos
  /// quando não há produto real escolhido.
  overrideVars?: TemplateVars,
): ResolvedPresell {
  const vars = overrideVars ?? presellVars(product);
  const render = (value: string) => renderTemplate(value, vars).trim();

  // Sem produto e sem valores de exemplo (o modelo aberto sozinho no
  // navegador), um campo escrito com variáveis não tem como ser preenchido:
  // renderizá-lo deixaria sobras sem sentido, tipo "por" solto. Nesse caso o
  // campo é tratado como vazio.
  const semDados = !product && !overrideVars;
  const usable = (value: string) => (semDados && usesVariables(value) ? "" : value);

  const rawHeadline = usable(clean(template.headline));
  const headline = rawHeadline ? render(rawHeadline) : (product?.title ?? "");

  const rawBody = usable(clean(template.body));
  const body = rawBody ? renderTemplate(rawBody, vars) : "";

  const rawImage = usable(clean(template.imageUrl));
  const image = rawImage ? render(rawImage) : (product?.thumbnail ?? "");

  const priceCents = template.priceLabel ?? product?.price ?? null;
  const originalCents = template.originalLabel ?? product?.originalPrice ?? null;

  const discount =
    priceCents != null && originalCents != null && originalCents > priceCents
      ? discountPct(priceCents, originalCents)
      : 0;

  const ctaText = render(template.ctaText) || "Liberar oferta";

  return {
    pageTitle: product?.title ?? headline ?? template.title,
    headline: headline || template.title,
    body,
    ctaText,
    imageUrl: image || null,
    priceCents,
    originalCents,
    discount,
    gateUrl: clean(template.gateUrl) || null,
    gateLabel: clean(template.gateLabel) || "Acessar link do patrocinador",
    gateDelay: template.gateDelay,
  };
}

/// As instruções numeradas que a página mostra ao visitante. Ficam aqui para
/// a página pública e o preview do painel nunca divergirem.
export function presellSteps(resolved: Pick<ResolvedPresell, "gateUrl" | "gateLabel" | "ctaText">): string[] {
  return resolved.gateUrl
    ? [
        `Toque em "${resolved.gateLabel}" para acessar o parceiro.`,
        "Aguarde alguns segundos, é rapidinho.",
        `Toque em "${resolved.ctaText}" para ver a oferta no Mercado Livre.`,
      ]
    : [
        `Toque em "${resolved.ctaText}" abaixo.`,
        "Você será levado direto para a oferta no Mercado Livre.",
      ];
}
