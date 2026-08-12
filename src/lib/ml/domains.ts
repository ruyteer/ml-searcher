/// Descoberta de domínio de catálogo do Mercado Livre a partir de um termo.
///
/// GET /sites/{site}/domain_discovery/search?q=<termo>
///   -> [{ domain_id, domain_name, category_id, category_name, attributes: [...] }]
///
/// Público: responde mesmo sem token. Resolve na origem o problema do termo
/// puro trazer lixo fora do nicho (ex.: q=shampoo trazendo "Shampoo para
/// veículos Renault"): passando o domain_id certo para /products/search o
/// catálogo já vem filtrado, muito antes de qualquer chamada de detalhe.

import { mlRequest, getCredentials } from "./client";
import { isUnderCategory, BEAUTY_ROOT } from "./categories";

interface RawDomainDiscoveryEntry {
  domain_id?: string | null;
  domain_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
}

export interface DiscoveredDomain {
  domainId: string;
  domainName: string;
  categoryId: string | null;
  categoryName: string | null;
}

/// O mapeamento termo -> domínio muda muito pouco, então uma janela larga
/// evita bater na API a cada tecla do usuário na tela de configurações.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry {
  value: DiscoveredDomain[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(site: string, q: string): string {
  return `${site}:${q.trim().toLowerCase()}`;
}

export function clearDomainDiscoveryCache(): void {
  cache.clear();
}

export interface DiscoverDomainsOptions {
  siteId?: string;
  signal?: AbortSignal;
  /// Ignora o cache em memória e refaz a chamada.
  force?: boolean;
}

/// Descobre os domínios de catálogo candidatos para um termo de busca livre.
/// Resultado vazio é caso normal (termo sem domínio conhecido no ML), não erro.
export async function discoverDomains(
  q: string,
  options: DiscoverDomainsOptions = {},
): Promise<DiscoveredDomain[]> {
  const term = q.trim();
  if (!term) return [];

  const creds = await getCredentials();
  const site = options.siteId ?? creds?.siteId ?? "MLB";
  const key = cacheKey(site, term);

  if (!options.force) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
  }

  const raw = await mlRequest<RawDomainDiscoveryEntry[]>(
    `/sites/${encodeURIComponent(site)}/domain_discovery/search`,
    {
      searchParams: { q: term },
      // Endpoint público: funciona sem credenciais configuradas.
      auth: false,
      signal: options.signal,
    },
  );

  const seen = new Set<string>();
  const out: DiscoveredDomain[] = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const domainId = entry?.domain_id;
    if (!domainId || seen.has(domainId)) continue;
    seen.add(domainId);
    out.push({
      domainId,
      domainName: entry.domain_name ?? domainId,
      categoryId: entry.category_id ?? null,
      categoryName: entry.category_name ?? null,
    });
  }

  cache.set(key, { value: out, expiresAt: Date.now() + CACHE_TTL_MS });
  return out;
}

/// A categoria do domínio cai dentro de Beleza e Cuidado Pessoal (nicho do
/// projeto)? `null` quando não foi possível confirmar (categoria não resolvida
/// por falha de rede) — quem chama decide como tratar a dúvida.
export async function isBeautyDomain(
  categoryId: string | null,
  options: { signal?: AbortSignal } = {},
): Promise<boolean | null> {
  if (!categoryId) return null;
  return isUnderCategory(categoryId, BEAUTY_ROOT, options);
}
