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
  // Watches — categorias e termos de busca monitorados (nicho: cuidado pessoal)
  // ============================================================================

  const watches = [
    {
      label: "Máquinas de cortar cabelo",
      categoryId: "MLB1276",
      query: "máquina de cortar cabelo",
    },
    {
      label: "Barbeadores e aparadores",
      categoryId: null,
      query: "barbeador aparador pelos",
    },
    {
      label: "Cuidados com o cabelo",
      categoryId: "MLB264724",
      query: null,
    },
    {
      label: "Pomada e cera modeladora",
      categoryId: null,
      query: "pomada modeladora cabelo",
    },
    {
      label: "Minoxidil e crescimento",
      categoryId: null,
      query: "minoxidil barba cabelo",
    },
    {
      label: "Cuidados com a barba",
      categoryId: null,
      query: "balm óleo barba",
    },
    {
      label: "Cuidados com a pele masculina",
      categoryId: "MLB263532",
      query: null,
    },
    {
      label: "Protetor solar facial",
      categoryId: null,
      query: "protetor solar facial",
    },
    {
      label: "Perfumes masculinos",
      categoryId: "MLB1246",
      query: "perfume masculino",
    },
    {
      label: "Secadores e chapinhas",
      categoryId: null,
      query: "secador de cabelo",
    },
  ];

  for (const watch of watches) {
    const identifier = seedId("watch", watch.label);

    await prisma.watch.upsert({
      where: {
        id: identifier,
      },
      update: {
        label: watch.label,
        enabled: true,
        limit: 100,
        minDiscount: null,
      },
      create: {
        id: identifier,
        label: watch.label,
        categoryId: watch.categoryId,
        query: watch.query,
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
