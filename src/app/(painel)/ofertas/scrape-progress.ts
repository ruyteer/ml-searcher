/// Tradução do que o servidor devolve sobre a varredura para o que o usuário
/// lê na tela. Fica separado do componente porque é lógica pura (texto), não
/// interface: nada aqui toca React.
///
/// Regra do projeto: nenhum termo técnico chega na tela. O log gravado no
/// banco fala "watch", os erros da API do Mercado Livre vêm com código entre
/// colchetes. Nada disso pode aparecer cru.

export interface ScrapeStatusPayload {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL";
  trigger: string;
  watchesTotal: number;
  watchesDone: number;
  itemsSeen: number;
  productsNew: number;
  offersNew: number;
  error: string | null;
  log: string[];
  startedAt: string;
  finishedAt: string | null;
  running: boolean;
  percent: number;
  durationMs: number;
}

/// Reescreve uma linha do log para português comum. O log é gravado pelo
/// scraper (fora do nosso alcance) usando "watch", códigos de erro entre
/// colchetes e mensagens da API em inglês; nada disso pode chegar na tela.
export function humanizeLogLine(line: string): string {
  const texto = line
    .replace(/ERRO fatal na varredura/gi, "Falha geral na varredura")
    .replace(/ERRO na watch/gi, "Falha na categoria")
    .replace(/\bWatch\b/g, "Categoria")
    .replace(/\bwatch\(es\)/gi, "categoria(s)")
    .replace(/\bwatches\b/gi, "categorias")
    .replace(/\bwatch\b/gi, "categoria")
    .replace(/Modo FIXTURE ativo/gi, "Modo de demonstração ativo")
    .replace(/fonte=fixtures/gi, "origem: dados de exemplo")
    .replace(/fonte=destaques/gi, "origem: destaques da categoria")
    .replace(/fonte=busca por termo/gi, "origem: busca por nome")
    .replace(/restrita ao domínio \S+/gi, "restrita ao ramo de beleza")
    .replace(/anúncio\(s\) próprio\(s\) sem catálogo/gi, "anúncio(s) fora do catálogo")
    .replace(/peneira de nicho/gi, "fora do nicho")
    .replace(/\s*\(MLB\d+\)/g, "");

  // A mensagem crua do erro (código entre colchetes, texto em inglês) vira a
  // mesma frase em português usada no resumo da falha.
  const falhaCategoria = /^(.*?Falha na categoria "[^"]+":)\s*(.+)$/.exec(texto);
  if (falhaCategoria) return `${falhaCategoria[1]} ${reasonPhrase(falhaCategoria[2])}`;

  const falhaGeral = /^(.*?Falha geral na varredura):\s*(.+)$/.exec(texto);
  if (falhaGeral) {
    return `${falhaGeral[1]}: ${reasonPhrase(falhaGeral[2], "a varredura parou por um problema inesperado")}`;
  }

  return texto;
}

/// Nome da categoria que está sendo varrida agora. O scraper registra uma
/// linha `Categoria "X": ...` assim que começa a processar X, então a última
/// linha com esse formato é a categoria corrente.
export function currentCategory(log: string[]): string | null {
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const match = /(?:Watch|Categoria)\s+"([^"]+)"/.exec(log[i]);
    if (match) return match[1];
  }
  return null;
}

/// Tempo restante estimado, em texto, ou null quando ainda não dá para ser
/// honesto. Só estima depois de duas categorias concluídas: com uma só, a
/// média é o próprio tempo dela e erra por minutos.
export function remainingEstimate(payload: {
  watchesDone: number;
  watchesTotal: number;
  durationMs: number;
  running: boolean;
}): string | null {
  const { watchesDone, watchesTotal, durationMs, running } = payload;
  if (!running) return null;
  if (watchesDone < 2 || watchesTotal <= watchesDone) return null;

  const avgMs = durationMs / watchesDone;
  if (!Number.isFinite(avgMs) || avgMs <= 0) return null;

  const remainingMs = avgMs * (watchesTotal - watchesDone);
  const minutes = Math.round(remainingMs / 60_000);
  if (remainingMs < 90_000) return "menos de 2 minutos restantes";
  if (minutes < 60) return `cerca de ${minutes} minutos restantes`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `cerca de ${hours} ${hours === 1 ? "hora" : "horas"} restantes`
    : `cerca de ${hours}h${String(rest).padStart(2, "0")} restantes`;
}

/// Traduz o motivo técnico de uma falha para uma frase que o usuário entende.
/// `fallback` é o que sobra quando a mensagem não bate com nenhum caso
/// conhecido: melhor uma frase vaga em português que um código em inglês.
function reasonPhrase(raw: string, fallback = "não foi possível concluir esta categoria"): string {
  const text = raw.toLowerCase();
  if (/429|too many|rate.?limit/.test(text)) {
    return "o Mercado Livre pediu para diminuir o ritmo das consultas";
  }
  if (/401|403|unauthor|forbidden|token/.test(text)) {
    return "o Mercado Livre recusou o acesso do painel";
  }
  if (/timeout|etimedout|econnreset|enotfound|fetch failed|network|socket/.test(text)) {
    return "a conexão com o Mercado Livre caiu no meio";
  }
  if (/5\d\d|internal|unavailable|bad gateway/.test(text)) {
    return "o Mercado Livre estava fora do ar no momento";
  }
  if (/interrompida|processo encerrado/.test(text)) {
    return "a varredura foi interrompida antes de terminar";
  }
  return fallback;
}

export interface FailureExplanation {
  /// Frase curta de topo, já em português comum.
  headline: string;
  /// Uma linha por categoria que falhou, no formato "Categoria: motivo".
  items: string[];
}

/// Monta a explicação da falha (total ou parcial) a partir do campo `error`,
/// que o scraper grava como "rótulo: mensagem | rótulo: mensagem".
export function explainFailure(
  status: ScrapeStatusPayload["status"],
  error: string | null,
): FailureExplanation | null {
  if (status !== "FAILED" && status !== "PARTIAL") return null;

  const headline =
    status === "FAILED"
      ? "Nenhuma categoria pôde ser varrida desta vez."
      : "Algumas categorias não puderam ser varridas, o resto foi varrido normalmente.";

  if (!error) return { headline, items: [] };

  const items = error
    .split(" | ")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((entry) => {
      const split = entry.indexOf(":");
      if (split === -1) return reasonPhrase(entry);
      const label = entry.slice(0, split).trim();
      const rest = entry.slice(split + 1).trim();
      return `${label}: ${reasonPhrase(rest)}`;
    });

  return { headline, items };
}

/// Contagem em português, com plural certo e sem número solto sem substantivo.
export function plural(count: number, singular: string, pluralWord: string): string {
  return `${count.toLocaleString("pt-BR")} ${count === 1 ? singular : pluralWord}`;
}
