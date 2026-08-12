import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não configurada");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/// ID estável e legível para os registros de seed: rodar o seed de novo
/// atualiza o mesmo registro em vez de criar duplicata.
function seedId(prefix: string, part: string) {
  const slug = part
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `seed-${prefix}-${slug}`;
}

async function main() {
  console.log("Iniciando seed...");

  // ============================================================================
  // Watches — categorias monitoradas (nicho: Beleza e Cuidado Pessoal)
  //
  // IDs confirmados um a um contra a API real do ML (os antigos eram
  // inventados — MLB1276 é "Esportes e Fitness", MLB263532 é "Ferramentas",
  // MLB264724 nem existe). A API de busca está bloqueada (403) para esta
  // aplicação, então nenhuma watch usa `query` — só coleta por categoria.
  // ============================================================================

  const BEAUTY_ROOT = "MLB1246";

  const watches: Array<{
    label: string;
    categoryId: string;
    parentCategoryId: string | null;
    depth: number;
  }> = [
    { label: "Beleza e Cuidado Pessoal", categoryId: BEAUTY_ROOT, parentCategoryId: null, depth: 0 },
    { label: "Artefatos para Cabelo", categoryId: "MLB455174", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Artigos para Cabeleireiros", categoryId: "MLB264751", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Barbearia", categoryId: "MLB264787", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Cuidados com a Pele", categoryId: "MLB199407", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Cuidados com o Cabelo", categoryId: "MLB1263", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Depilação", categoryId: "MLB5383", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Farmácia", categoryId: "MLB431646", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Higiene Pessoal", categoryId: "MLB198312", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Manicure e Pedicure", categoryId: "MLB29884", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Maquiagem", categoryId: "MLB1248", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Outros", categoryId: "MLB1275", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Perfumes", categoryId: "MLB6284", parentCategoryId: BEAUTY_ROOT, depth: 1 },
    { label: "Tratamentos de Beleza", categoryId: "MLB278194", parentCategoryId: BEAUTY_ROOT, depth: 1 },
  ];

  // Upsert por categoryId (agora @unique) em vez de id sintético — é mais
  // correto e evita duplicata se a sincronização automática da árvore
  // (syncCategoryTree) já tiver rodado antes deste seed. Como essas watches
  // são idênticas às que a sincronização geraria (auto: true), a atualização
  // só toca label/parentCategoryId/depth — nunca enabled/limit/minDiscount,
  // que o usuário pode já ter ajustado no painel.
  for (const watch of watches) {
    await prisma.watch.upsert({
      where: { categoryId: watch.categoryId },
      update: {
        label: watch.label,
        parentCategoryId: watch.parentCategoryId,
        depth: watch.depth,
        auto: true,
      },
      create: {
        label: watch.label,
        categoryId: watch.categoryId,
        query: null,
        parentCategoryId: watch.parentCategoryId,
        depth: watch.depth,
        auto: true,
        enabled: true,
        limit: 100,
        minDiscount: null,
      },
    });
  }

  console.log("✓ Watches criadas/atualizadas");

  // ============================================================================
  // Phrases — ~25 frases curtas para grupo de WhatsApp de ofertas
  // ============================================================================

  const phrases = [
    // Abertura
    { text: "🔥 ACHADO DO DIA", category: "abertura" },
    { text: "🚨 SUPER OFERTA AGORA", category: "abertura" },
    { text: "💥 DESCE O PREÇO", category: "abertura" },
    { text: "🎯 VEM VER ISSO", category: "abertura" },
    { text: "⚡ IMPERDÍVEL", category: "abertura" },

    // Urgência
    { text: "Corre que é por tempo limitado ⏰", category: "urgencia" },
    { text: "Válido só enquanto durar estoque 🏃", category: "urgencia" },
    { text: "Última chance antes do preço subir 📈", category: "urgencia" },
    { text: "Sai de estoque rápido 🔔", category: "urgencia" },
    { text: "Oferecidos até meia-noite ⏳", category: "urgencia" },

    // CTA
    { text: "Garanta o seu pelo link 👇", category: "cta" },
    { text: "Clica aqui e aproveita 👆", category: "cta" },
    { text: "Acessa a oferta completa aqui ⬇", category: "cta" },
    { text: "Não deixa passar, clica no link 🔗", category: "cta" },
    { text: "Libera a oferta lá embaixo 👇", category: "cta" },
    { text: "Corre pro link antes de acabar 🏃💨", category: "cta" },

    // Emoji (linhas decorativas)
    { text: "🔥🔥🔥🔥🔥", category: "emoji" },
    { text: "⚡⚡⚡⚡⚡", category: "emoji" },
    { text: "💥💥💥💥💥", category: "emoji" },
    { text: "✨✨✨✨✨", category: "emoji" },
    { text: "🎯🎯🎯🎯🎯", category: "emoji" },
    { text: "━━━━━━━━━━", category: "emoji" },
    { text: "════════════", category: "emoji" },

    // Geral
    { text: "Melhor preço da internet 💰", category: "geral" },
    { text: "Frete grátis pra todo Brasil 📦", category: "geral" },
    { text: "Parcelado sem juros 💳", category: "geral" },
  ];

  // Índice na chave porque frases só de emoji não geram slug utilizável.
  for (const [i, phrase] of phrases.entries()) {
    const id = seedId("phrase", `${String(i + 1).padStart(2, "0")}-${phrase.category}`);
    await prisma.phrase.upsert({
      where: { id },
      update: { text: phrase.text, category: phrase.category, active: true },
      create: {
        id,
        text: phrase.text,
        category: phrase.category,
        active: true,
      },
    });
  }

  console.log("✓ Phrases criadas/atualizadas");

  // ============================================================================
  // MessageTemplates — 3 templates com formatos diferentes
  // ============================================================================

  const templates = [
    {
      id: "template-curto",
      name: "Template Curto",
      body: `{{frase}}

*{{titulo}}*

~{{precoAntigo}}~ → *{{preco}}*
💸 {{desconto}}%

👉 {{link}}`,
      isDefault: true,
    },
    {
      id: "template-completo",
      name: "Template Completo",
      body: `{{frase}}

🎁 *{{titulo}}*

Preço anterior: ~{{precoAntigo}}~
Preço agora: *{{preco}}*
Economia: {{desconto}}% de desconto 💸

Aproveita a oferta antes que acabe ⏰

👉 {{link}}`,
      isDefault: false,
    },
    {
      id: "template-urgencia",
      name: "Template Urgência",
      body: `⚡ {{frase}}

*{{titulo}}*

🔥 SUPER PROMOÇÃO 🔥
~{{precoAntigo}}~
→ *{{preco}}*
({{desconto}}% OFF)

⏳ Corre, é por tempo limitado!

👉 {{link}}

#Oferta #Desconto #Imperdível`,
      isDefault: false,
    },
  ];

  for (const template of templates) {
    await prisma.messageTemplate.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        body: template.body,
        isDefault: template.isDefault,
      },
      create: {
        id: template.id,
        name: template.name,
        body: template.body,
        isDefault: template.isDefault,
      },
    });
  }

  console.log("✓ MessageTemplates criadas/atualizadas");

  console.log("\n✅ Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
