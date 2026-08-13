/// Filtro por palavras configurado pelo usuário nas configurações.
///
/// Módulo PURO de propósito: sem React, sem Prisma, sem "server-only". Ele é
/// usado em três lugares que precisam concordar entre si:
///   1. a varredura (src/lib/ml/collect.ts), para descartar cedo;
///   2. as consultas (src/lib/data/*.ts), que reproduzem a MESMA regra em SQL;
///   3. a aba de configurações, que roda no navegador para mostrar as fichas.
///
/// Regra combinada com o usuário:
///   - bateu qualquer palavra da lista de excluir  -> reprova;
///   - lista de obrigatórias preenchida            -> precisa bater PELO MENOS
///     UMA delas (é uma lista de assuntos de interesse, não uma exigência
///     simultânea);
///   - lista vazia                                 -> sem restrição nenhuma.

// --------------------------------------------------------------- normalização

/// Acentos que o `translate()` do Postgres precisa conhecer para chegar no
/// mesmo resultado que a normalização do JavaScript. Ficam aqui, junto da
/// função, para as duas pontas nunca saírem de sincronia. Só minúsculas: o SQL
/// aplica `lower()` antes de traduzir.
///
/// Só entram letras que a forma NFD realmente decompõe, senão as duas pontas
/// discordariam (o "ø", por exemplo, não decompõe e vira espaço no JavaScript).
export const ACENTOS_DE = "áàâãäåçéèêëìíîïñòóôõöùúûüýÿ";
export const ACENTOS_PARA = "aaaaaaceeeeiiiinooooouuuuyy";

/// Minúsculas, sem acento, só letras e números, espaços colapsados.
///
/// Tudo que não é letra ou número vira espaço (pontuação, barra, hífen, pipe).
/// Com isso o texto normalizado nunca contém caractere especial de expressão
/// regular, o que dispensa escapar a palavra do usuário e faz a borda de
/// palavra ser simplesmente "início da string ou espaço".
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ------------------------------------------------------------- lista de palavras

/// Quantas palavras cada lista aceita. Trava de sanidade: acima disso a
/// expressão de busca no banco fica grande sem trazer benefício real.
export const MAX_PALAVRAS = 200;
/// Tamanho máximo de uma palavra (ou de uma expressão de duas ou três palavras).
export const MAX_TAMANHO_PALAVRA = 60;

/// Texto do campo -> lista limpa. Aceita vírgula E quebra de linha (e ponto e
/// vírgula, que é o que sai de planilha), tira espaço sobrando, entrada vazia e
/// repetida. A repetição é detectada pela forma normalizada, então "Óleo" e
/// "oleo" contam como a mesma palavra; o que fica guardado é a primeira grafia
/// que a pessoa escreveu, porque é ela que aparece na ficha.
export function parseWordList(texto: string): string[] {
  if (!texto) return [];
  const vistas = new Set<string>();
  const out: string[] = [];

  for (const bruto of texto.split(/[,;\r\n]+/)) {
    const palavra = bruto.trim().replace(/\s+/g, " ").slice(0, MAX_TAMANHO_PALAVRA);
    if (!palavra) continue;
    const chave = normalizeText(palavra);
    if (!chave || vistas.has(chave)) continue;
    vistas.add(chave);
    out.push(palavra);
    if (out.length >= MAX_PALAVRAS) break;
  }

  return out;
}

/// Lista -> texto guardado no banco. Vírgula porque é o que a pessoa reconhece
/// ao reabrir a configuração.
export function formatWordList(palavras: string[]): string {
  return palavras.join(", ");
}

// ------------------------------------------------------------------ casamento

export interface WordFilter {
  /// Palavras que reprovam o produto.
  excluir: string[];
  /// Assuntos de interesse: basta bater UMA. Vazia = sem restrição.
  obrigatorias: string[];
}

export const FILTRO_VAZIO: WordFilter = { excluir: [], obrigatorias: [] };

/// O filtro tem alguma palavra configurada?
export function hasWordFilter(filter: WordFilter): boolean {
  return filter.excluir.length > 0 || filter.obrigatorias.length > 0;
}

/// Trecho de expressão regular de UM pedaço da palavra, já normalizado.
///
/// Cobre plural e gênero, que é o que a pessoa espera sem ter que pensar:
///   "kit"      -> kit, kits
///   "feminino" -> feminino, feminina, femininos, femininas
///   "oleo"     -> oleo, oleos (e NÃO oleoso, que é outra palavra)
///   "kits"     -> reconhecido como plural de "kit", então pega os dois
///
/// O casamento é sempre por palavra inteira (ver `wordPattern`), então "gel"
/// não encosta em "gelatina" nem "kit" em "kitchen".
function tokenPattern(token: string): string {
  let raiz = token;

  // Plural digitado pelo usuário: guarda o "s" de volta como opcional.
  if (raiz.length >= 4 && raiz.endsWith("s")) raiz = raiz.slice(0, -1);

  // Gênero: a vogal final vira "o ou a", com plural opcional depois.
  if (raiz.length >= 4 && (raiz.endsWith("o") || raiz.endsWith("a"))) {
    return `${raiz.slice(0, -1)}[oa]s?`;
  }
  return `${raiz}s?`;
}

/// Expressão regular (em texto) que casa a palavra inteira dentro de um título
/// já normalizado. Serve para o JavaScript e para o `~` do Postgres: a sintaxe
/// usada aqui existe nos dois.
///
/// Quando a pessoa escreve uma expressão de várias palavras ("oleo de barba"),
/// só a última recebe o tratamento de plural e gênero.
export function wordPattern(palavra: string): string | null {
  const norm = normalizeText(palavra);
  if (!norm) return null;

  const tokens = norm.split(" ");
  const corpo = tokens
    .map((token, i) => (i === tokens.length - 1 ? tokenPattern(token) : token))
    .join(" ");

  return `(^| )${corpo}( |$)`;
}

/// Todas as expressões de uma lista, já sem as palavras que normalizaram vazio.
export function wordPatterns(palavras: string[]): string[] {
  const out: string[] = [];
  for (const palavra of palavras) {
    const pattern = wordPattern(palavra);
    if (pattern) out.push(pattern);
  }
  return out;
}

function bate(tituloNormalizado: string, palavra: string): boolean {
  const pattern = wordPattern(palavra);
  if (!pattern) return false;
  return new RegExp(pattern).test(tituloNormalizado);
}

/// Quais palavras da lista aparecem no título. Usado no log da varredura, para
/// o usuário saber qual palavra dele derrubou os produtos.
export function matchedWords(titulo: string, palavras: string[]): string[] {
  const norm = normalizeText(titulo);
  if (!norm) return [];
  return palavras.filter((palavra) => bate(norm, palavra));
}

/// O produto passa pelo filtro?
export function matchesFilter(titulo: string, filter: WordFilter): boolean {
  const norm = normalizeText(titulo);
  if (!norm) return filter.obrigatorias.length === 0;

  for (const palavra of filter.excluir) {
    if (bate(norm, palavra)) return false;
  }

  if (filter.obrigatorias.length === 0) return true;
  return filter.obrigatorias.some((palavra) => bate(norm, palavra));
}
