/// Modo fixture: dados de exemplo para desenvolver sem credenciais do ML.
///
/// Liga/desliga:
///   - automático: sem mlClientId/mlClientSecret => fixtures ligados
///   - ML_FIXTURES=1|true  => força fixtures mesmo com credenciais
///   - ML_FIXTURES=0|false => desliga; sem credenciais a API lança NO_CREDENTIALS
///
/// Os preços variam por "rodada" (janela de tempo) de forma determinística,
/// para que o PriceHistory tenha o que comparar durante o desenvolvimento.

import { getCredentials } from "./client";
import type { MLItem, MLSeller } from "./types";

const DEFAULT_ROUND_MS = 60_000;

export async function isFixtureMode(): Promise<boolean> {
  const flag = (process.env.ML_FIXTURES ?? "").trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return (await getCredentials()) === null;
}

// ------------------------------------------------------------------ catálogo

interface FixtureSeller {
  id: number;
  nickname: string;
  status: string | null;
  officialStoreId?: number;
}

const SELLERS: Record<string, FixtureSeller> = {
  beleza: { id: 110001, nickname: "BELEZA EXPRESS BR", status: "platinum" },
  mega: { id: 110002, nickname: "MEGA COSMETICOS", status: "gold" },
  barber: { id: 110003, nickname: "BARBEARIA STORE", status: "silver" },
  philips: { id: 110004, nickname: "PHILIPS OFICIAL", status: "platinum", officialStoreId: 2041 },
  mundo: { id: 110005, nickname: "MUNDO MASCULINO", status: null },
  drogaria: { id: 110006, nickname: "DROGARIA ONLINE BR", status: "gold", officialStoreId: 3387 },
};

/// Categorias plausíveis do MLB usadas pelas watches de beleza masculina.
export const FIXTURE_CATEGORIES = {
  cortadores: "MLB264724",
  barbeadores: "MLB265306",
  cabelo: "MLB1248",
  pele: "MLB1252",
  perfumes: "MLB197462",
  higiene: "MLB1254",
  eletroBeleza: "MLB264725",
  geral: "MLB1246",
} as const;

interface FixtureSeed {
  id: string;
  title: string;
  /// Preço "de tabela" em reais — o jitter da rodada oscila em volta dele.
  base: number;
  /// original_price declarado pelo ML, quando o anúncio tem "de/por".
  original?: number;
  category: string;
  seller: keyof typeof SELLERS;
  sold: number;
  available: number;
  freeShipping: boolean;
}

const C = FIXTURE_CATEGORIES;

const SEEDS: FixtureSeed[] = [
  { id: "MLB3001000001", title: "Máquina de Cortar Cabelo Philips Walita Hairclipper Series 3000 Bivolt", base: 149.9, original: 199.9, category: C.cortadores, seller: "philips", sold: 4820, available: 120, freeShipping: true },
  { id: "MLB3001000002", title: "Aparador de Pelos Philips Multigroom MG3711 13 em 1", base: 189.9, original: 249.9, category: C.cortadores, seller: "philips", sold: 2110, available: 64, freeShipping: true },
  { id: "MLB3001000003", title: "Máquina de Corte Wahl Magic Clip Cordless Profissional 110v", base: 949.0, original: 1249.0, category: C.cortadores, seller: "barber", sold: 380, available: 12, freeShipping: true },
  { id: "MLB3001000004", title: "Barbeador Elétrico Philips Norelco Series 3000 à Prova d'Água", base: 279.9, category: C.barbeadores, seller: "philips", sold: 1560, available: 45, freeShipping: true },
  { id: "MLB3001000005", title: "Máquina de Cortar Cabelo Mondial CR-07 Kit Completo com Pentes", base: 89.9, original: 129.9, category: C.cortadores, seller: "mega", sold: 9340, available: 300, freeShipping: false },
  { id: "MLB3001000006", title: "Aparador de Barba Gama Italy GBT2000 Recarregável Titanium", base: 169.9, category: C.cortadores, seller: "beleza", sold: 740, available: 38, freeShipping: true },
  { id: "MLB3001000007", title: "Kit Barba Completo Bozzano Shampoo Balm e Óleo 3 Peças", base: 54.9, original: 74.9, category: C.pele, seller: "drogaria", sold: 3120, available: 210, freeShipping: false },
  { id: "MLB3001000008", title: "Bálsamo Pós Barba Nivea Men Sensitive 100ml", base: 27.9, category: C.pele, seller: "drogaria", sold: 12800, available: 500, freeShipping: false },
  { id: "MLB3001000009", title: "Gel de Barbear Gillette Fusion 5 Ultra Sensitive 195g", base: 24.9, category: C.barbeadores, seller: "drogaria", sold: 8600, available: 420, freeShipping: false },
  { id: "MLB3001000010", title: "Aparelho de Barbear Gillette Mach3 com 4 Cargas Extras", base: 59.9, original: 84.9, category: C.barbeadores, seller: "mega", sold: 5410, available: 180, freeShipping: false },
  { id: "MLB3001000011", title: "Pomada Modeladora Capilar Efeito Matte Bozzano 60g", base: 19.9, category: C.cabelo, seller: "drogaria", sold: 15200, available: 640, freeShipping: false },
  { id: "MLB3001000012", title: "Pomada Capilar Don Alcides Barba Negra Efeito Seco 120g", base: 42.9, original: 59.9, category: C.cabelo, seller: "barber", sold: 2740, available: 96, freeShipping: false },
  { id: "MLB3001000013", title: "Minoxidil Kirkland 5% 60ml Kit com 3 Frascos Original Lacrado", base: 199.9, original: 279.9, category: C.cabelo, seller: "beleza", sold: 6120, available: 75, freeShipping: true },
  { id: "MLB3001000014", title: "Shampoo Anticaspa Clear Men Ice Cool Menthol 400ml", base: 32.9, category: C.cabelo, seller: "drogaria", sold: 9870, available: 380, freeShipping: false },
  { id: "MLB3001000015", title: "Shampoo de Cavalo Fortalecedor Haskell Cavalo Forte 500ml", base: 46.9, original: 62.9, category: C.cabelo, seller: "mega", sold: 4430, available: 155, freeShipping: false },
  { id: "MLB3001000016", title: "Kit Shampoo e Condicionador Truss Ultra Hydration 300ml", base: 229.9, original: 299.9, category: C.cabelo, seller: "beleza", sold: 890, available: 40, freeShipping: true },
  { id: "MLB3001000017", title: "Óleo para Barba Viking Terra 30ml Hidratante e Amaciante", base: 34.9, category: C.pele, seller: "barber", sold: 5230, available: 220, freeShipping: false },
  { id: "MLB3001000018", title: "Cera Modeladora Capilar Red One Aqua Hair Wax 150ml Original", base: 44.9, original: 69.9, category: C.cabelo, seller: "barber", sold: 7810, available: 260, freeShipping: false },
  { id: "MLB3001000019", title: "Desodorante Antitranspirante Rexona Men Clinical Clean 58g", base: 29.9, category: C.higiene, seller: "drogaria", sold: 21400, available: 900, freeShipping: false },
  { id: "MLB3001000020", title: "Perfume Malbec Ouro O Boticário Desodorante Colônia 100ml", base: 259.9, original: 329.9, category: C.perfumes, seller: "beleza", sold: 3350, available: 88, freeShipping: true },
  { id: "MLB3001000021", title: "Perfume Egeo Dolce Colors Masculino Desodorante Colônia 90ml", base: 119.9, category: C.perfumes, seller: "mega", sold: 2180, available: 130, freeShipping: true },
  { id: "MLB3001000022", title: "Sabonete Facial de Carvão Ativado Neutrogena Men Detox 80g", base: 25.9, category: C.pele, seller: "drogaria", sold: 6640, available: 310, freeShipping: false },
  { id: "MLB3001000023", title: "Protetor Solar Facial Antioleosidade Sundown Men FPS 60 50g", base: 42.9, original: 54.9, category: C.pele, seller: "drogaria", sold: 4980, available: 240, freeShipping: false },
  { id: "MLB3001000024", title: "Creme Hidratante Facial Nivea Men Energy Efeito Refrescante 50g", base: 22.9, category: C.pele, seller: "drogaria", sold: 11300, available: 470, freeShipping: false },
  { id: "MLB3001000025", title: "Secador de Cabelo Taiff Style 1700W Profissional 2 Velocidades", base: 169.9, original: 219.9, category: C.eletroBeleza, seller: "beleza", sold: 3910, available: 110, freeShipping: true },
  { id: "MLB3001000026", title: "Prancha Alisadora Mondial Fast Ion Cerâmica Bivolt", base: 99.9, category: C.eletroBeleza, seller: "mega", sold: 6250, available: 190, freeShipping: false },
  { id: "MLB3001000027", title: "Escova Secadora Gama Italy Glamour Blue Ion 1300W", base: 199.9, original: 269.9, category: C.eletroBeleza, seller: "beleza", sold: 5470, available: 85, freeShipping: true },
  { id: "MLB3001000028", title: "Kit Cuidados Masculinos Every Man Jack Cedro e Sândalo 4 Itens", base: 139.9, category: C.geral, seller: "mundo", sold: 320, available: 26, freeShipping: true },
  { id: "MLB3001000029", title: "Aparador de Pelos Nasal e Orelha Philips NT1620 à Prova d'Água", base: 84.9, original: 109.9, category: C.cortadores, seller: "philips", sold: 4110, available: 160, freeShipping: false },
  { id: "MLB3001000030", title: "Tônico Capilar Antiqueda Pantogar Loção Fortalecedora 60ml", base: 94.9, category: C.cabelo, seller: "mundo", sold: 1450, available: 58, freeShipping: false },
];

// ------------------------------------------------------------------- jitter

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand01(seed: string): number {
  return hash32(seed) / 4294967296;
}

/// Identificador da rodada atual. Muda a cada janela de tempo, então duas
/// watches da mesma varredura veem os mesmos preços.
export function fixtureRound(now: Date = new Date()): number {
  const windowMs = Number(process.env.ML_FIXTURE_ROUND_MS) || DEFAULT_ROUND_MS;
  return Math.floor(now.getTime() / windowMs);
}

function jitteredPrice(seed: FixtureSeed, round: number): number {
  // oscilação normal de ±8% em torno do preço de tabela
  const wobble = (rand01(`${seed.id}:${round}:w`) - 0.5) * 0.16;
  // ~1 em 9 rodadas o item entra em promoção forte, para gerar ofertas
  const promo = hash32(`${seed.id}:${round}:p`) % 9 === 0 ? 0.24 : 0;
  const price = seed.base * (1 + wobble) * (1 - promo);
  return Math.max(1, Math.round(price * 100) / 100);
}

function toMLItem(seed: FixtureSeed, round: number): MLItem {
  const seller = SELLERS[seed.seller];
  const price = jitteredPrice(seed, round);
  const mlSeller: MLSeller = {
    id: seller.id,
    nickname: seller.nickname,
    seller_reputation: { power_seller_status: seller.status },
  };

  return {
    id: seed.id,
    title: seed.title,
    thumbnail: `https://http2.mlstatic.com/D_NQ_NP_${seed.id}-V.webp`,
    secure_thumbnail: `https://http2.mlstatic.com/D_NQ_NP_2X_${seed.id}-F.webp`,
    permalink: `https://produto.mercadolivre.com.br/${seed.id.replace("MLB", "MLB-")}`,
    price,
    original_price: seed.original ?? null,
    currency_id: "BRL",
    available_quantity: seed.available,
    // as vendas crescem devagar entre rodadas, como no mundo real
    sold_quantity: seed.sold + (hash32(`${seed.id}:${round}:s`) % 7),
    condition: "new",
    category_id: seed.category,
    seller: mlSeller,
    shipping: { free_shipping: seed.freeShipping },
    official_store_id: seller.officialStoreId ?? null,
  };
}

// ------------------------------------------------------------------- busca

/// Faixa dos sinais diacríticos combinantes gerados pelo NFD.
const COMBINING_MARKS = /[̀-ͯ]/g;

function deburr(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase();
}

export interface FixtureQuery {
  categoryId?: string | null;
  query?: string | null;
  limit?: number | null;
}

function matches(seed: FixtureSeed, filter: FixtureQuery): boolean {
  if (filter.categoryId && seed.category !== filter.categoryId) return false;
  if (filter.query) {
    const haystack = deburr(seed.title);
    const tokens = deburr(filter.query).split(/\s+/).filter(Boolean);
    if (!tokens.every((t) => haystack.includes(t))) return false;
  }
  return true;
}

/// Resultado de busca em modo fixture, já no shape cru da API.
export function fixtureSearch(filter: FixtureQuery = {}, now: Date = new Date()): MLItem[] {
  const round = fixtureRound(now);
  let picked = SEEDS.filter((seed) => matches(seed, filter));
  // Filtro que não casa com nada deixaria o painel vazio em desenvolvimento;
  // nesse caso devolvemos o catálogo inteiro.
  if (picked.length === 0) picked = SEEDS;

  const limit = filter.limit && filter.limit > 0 ? filter.limit : picked.length;
  return picked.slice(0, limit).map((seed) => toMLItem(seed, round));
}

export function fixtureCount(): number {
  return SEEDS.length;
}
