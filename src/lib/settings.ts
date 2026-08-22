import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { TAGS, bust } from "./cache";
import { parseWordList, type WordFilter } from "./word-filter";

export const SETTINGS_TAG = TAGS.settings;

/// Tudo que o painel deixa configurar. Os defaults valem enquanto a chave
/// não existir no banco, então a app sobe funcionando sem nenhum setup.
export const SETTINGS_SCHEMA = {
  /// Desconto mínimo (%) para uma queda de preço virar oferta.
  minDiscount: { default: 15, kind: "number" },
  /// A partir daqui a oferta é destacada como "imperdível".
  hotDiscount: { default: 30, kind: "number" },
  /// Quantas varreduras um produto precisa ter para o histórico valer como referência.
  minHistoryPoints: { default: 3, kind: "number" },
  /// Ignora ofertas de produtos abaixo deste preço (centavos). Evita lixo de R$1.
  minPrice: { default: 1000, kind: "number" },
  /// Ignora produtos que nunca venderam nada.
  minSoldQuantity: { default: 0, kind: "number" },

  /// A cada quantos minutos o ciclo de varredura automática roda.
  scrapeIntervalMinutes: { default: 30, kind: "number" },
  /// Horário-alvo da próxima varredura (ISO). Vazio = varre no próximo tick.
  /// Avança na grade do agendamento, nunca a partir de `Date.now()` — senão a
  /// duração da varredura empurra o alvo para fora do tick.
  scrapeNextRunAt: { default: "", kind: "string" },

  /// Domínio público usado ao montar os links copiáveis. Vazio = usa a URL da request.
  publicBaseUrl: { default: "", kind: "string" },

  /// Programa de afiliados: quando ativo, os links ganham os parâmetros abaixo.
  affiliateEnabled: { default: false, kind: "boolean" },
  affiliateTool: { default: "", kind: "string" },
  affiliateWord: { default: "", kind: "string" },

  /// Sessão logada do painel de afiliados do Mercado Livre (colada como curl
  /// pelo usuário), usada só para checar elegibilidade produto a produto —
  /// não existe API pública para isso. Nunca reexibida em texto puro no painel.
  affiliateSessionCookie: { default: "", kind: "string" },
  affiliateSessionCsrfToken: { default: "", kind: "string" },
  /// ISO date decodificada do JWT da sessão (nsa_rotok). Vazio = desconhecida.
  affiliateSessionExpiresAt: { default: "", kind: "string" },
  /// true quando uma checagem em ciclo detectou a sessão como inválida (ex.:
  /// 401 do Mercado Livre) — mais confiável que só olhar a data de validade,
  /// porque cobre revogação antes do prazo. Zera sozinho ao colar um curl novo.
  affiliateSessionInvalid: { default: false, kind: "boolean" },

  /// Credenciais da API do Mercado Livre. Preenchíveis pelo painel ou por env.
  mlClientId: { default: "", kind: "string" },
  mlClientSecret: { default: "", kind: "string" },
  mlSiteId: { default: "MLB", kind: "string" },

  /// Filtro por palavras, definido pelo usuário na aba "Filtro por palavras".
  /// Guardados como texto separado por vírgula (ver src/lib/word-filter.ts).
  /// Moram aqui, e não num modelo próprio, porque são configuração global igual
  /// às outras: viajam de graça no mesmo `findMany` já cacheado que alimenta a
  /// app inteira, sem uma segunda consulta em cada varredura e em cada tela.
  ///
  /// Título que bate em QUALQUER uma destas some das telas e da varredura.
  filterExcludeWords: { default: "", kind: "string" },
  /// Assuntos de interesse: com a lista preenchida, só passa o título que bate
  /// em PELO MENOS UMA. Vazia = sem restrição.
  filterRequireWords: { default: "", kind: "string" },

  /// Uazapi (fase 6).
  uazapiHost: { default: "", kind: "string" },
  /// Token de administrador da Uazapi — cria/lista instâncias. Diferente do
  /// token de cada WhatsappInstance, que autentica só aquela instância.
  uazapiAdminToken: { default: "", kind: "string" },

  /// Envio automático pro WhatsApp (fase 6).
  whatsappEnabled: { default: false, kind: "boolean" },
  /// A cada quantos minutos o ciclo de envio roda.
  whatsappIntervalMinutes: { default: 60, kind: "number" },
  /// Quantidade de ofertas por ciclo: sorteada entre min e max.
  whatsappMinPerCycle: { default: 1, kind: "number" },
  whatsappMaxPerCycle: { default: 2, kind: "number" },
  /// Link das mensagens automáticas com página de pre-sell em vez de direto.
  whatsappUsePresell: { default: false, kind: "boolean" },
  /// Modelo escolhido. Vazio (com whatsappUsePresell ativo) = usa o modelo
  /// marcado como padrão em /presells, igual ao resto do sistema.
  whatsappPresellId: { default: "", kind: "string" },
  /// Horário-alvo do próximo ciclo de envio (ISO). Vazio = envia no próximo tick.
  /// Avança na grade do agendamento, nunca a partir da hora em que o envio
  /// terminou — senão a duração do envio empurra o alvo para fora do tick.
  whatsappNextSendAt: { default: "", kind: "string" },
} as const;

export type SettingKey = keyof typeof SETTINGS_SCHEMA;

type Kind<K extends SettingKey> = (typeof SETTINGS_SCHEMA)[K]["kind"];
type Value<K extends SettingKey> = Kind<K> extends "number"
  ? number
  : Kind<K> extends "boolean"
    ? boolean
    : string;

export type Settings = { [K in SettingKey]: Value<K> };

function parse<K extends SettingKey>(key: K, raw: string): Value<K> {
  const kind = SETTINGS_SCHEMA[key].kind;
  if (kind === "number") return (Number(raw) || 0) as Value<K>;
  if (kind === "boolean") return (raw === "true") as Value<K>;
  return raw as Value<K>;
}

const load = unstable_cache(
  async () => {
    const rows = await prisma.setting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    const out = {} as Settings;
    for (const key of Object.keys(SETTINGS_SCHEMA) as SettingKey[]) {
      const raw = byKey.get(key);
      // env vence o default mas perde para o que foi salvo no painel
      const fallback = envFallback(key) ?? SETTINGS_SCHEMA[key].default;
      // @ts-expect-error — a união de tipos é resolvida por `parse`
      out[key] = raw === undefined ? fallback : parse(key, raw);
    }
    return out;
  },
  ["settings"],
  { tags: [SETTINGS_TAG] },
);

/// Permite bootar via variável de ambiente no Railway sem passar pelo painel.
function envFallback(key: SettingKey): string | number | boolean | undefined {
  const map: Partial<Record<SettingKey, string | undefined>> = {
    mlClientId: process.env.ML_CLIENT_ID,
    mlClientSecret: process.env.ML_CLIENT_SECRET,
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    uazapiHost: process.env.UAZAPI_HOST,
    uazapiAdminToken: process.env.UAZAPI_ADMIN_TOKEN,
  };
  const raw = map[key];
  if (!raw) return undefined;
  return parse(key, raw);
}

export async function getSettings(): Promise<Settings> {
  return load();
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Value<K>> {
  return (await load())[key];
}

/// As duas listas de palavras já quebradas, prontas para o motor de filtro.
/// Sai do mesmo `load()` cacheado das outras configurações: nenhuma consulta
/// extra ao banco, nem na varredura nem nas telas.
export async function getWordFilter(): Promise<WordFilter> {
  const s = await load();
  return {
    excluir: parseWordList(s.filterExcludeWords),
    obrigatorias: parseWordList(s.filterRequireWords),
  };
}

export async function setSettings(patch: Partial<Record<SettingKey, unknown>>) {
  const entries = Object.entries(patch).filter(([k]) => k in SETTINGS_SCHEMA);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      }),
    ),
  );
  bust(TAGS.settings);
}
