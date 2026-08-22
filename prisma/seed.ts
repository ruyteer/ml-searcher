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
  // Categorias monitoradas — nicho: CUIDADO PESSOAL MASCULINO
  //
  // Antes semeávamos a raiz inteira "Beleza e Cuidado Pessoal" (MLB1246), que
  // carrega junto Maquiagem, Manicure e Pedicure, Depilação e Farmácia. Era
  // isso que enchia o painel de produto feminino e até de gel lubrificante.
  // Agora o seed traz só um conjunto enxuto e certeiro.
  //
  // TODOS os ids abaixo foram conferidos um a um contra GET /categories/{id}
  // na API real do Mercado Livre. Não invente id: já erramos assim antes
  // (MLB1276 é "Esportes e Fitness", MLB263532 é "Ferramentas").
  //
  // Esta lista é a mesma de MALE_CARE_CATEGORIES em src/lib/ml/categories.ts,
  // que é quem o filtro de nicho da coleta consulta. Não dá para importar de
  // lá (aquele módulo é de servidor), então mexeu aqui, mexa lá também.
  // ============================================================================

  const watches: Array<{
    label: string;
    categoryId: string;
    parentCategoryId: string | null;
    depth: number;
  }> = [
    // Barbearia e o que cresce dela.
    { label: "Barbearia", categoryId: "MLB264787", parentCategoryId: null, depth: 0 },
    { label: "Barbeadores", categoryId: "MLB277980", parentCategoryId: "MLB264787", depth: 1 },
    { label: "Lâminas de barbear", categoryId: "MLB264805", parentCategoryId: "MLB264787", depth: 1 },
    { label: "Espumas de barbear", categoryId: "MLB264791", parentCategoryId: "MLB264787", depth: 1 },
    { label: "Produtos pós barba", categoryId: "MLB264789", parentCategoryId: "MLB264787", depth: 1 },
    { label: "Bálsamos, óleos e tônicos para barba", categoryId: "MLB264790", parentCategoryId: "MLB264787", depth: 1 },
    { label: "Kits para barba", categoryId: "MLB278197", parentCategoryId: "MLB264787", depth: 1 },

    // Máquinas e aparadores. O pai no ML é "Artefatos para Cabelo" (MLB455174),
    // que também guarda prancha e modelador de cachos — por isso entram só as
    // filhas certeiras, e não o ramo inteiro.
    { label: "Máquinas de cortar cabelo", categoryId: "MLB5411", parentCategoryId: null, depth: 0 },
    { label: "Aparadores de pelo", categoryId: "MLB446228", parentCategoryId: null, depth: 0 },
    { label: "Peças de barbeador elétrico", categoryId: "MLB456356", parentCategoryId: null, depth: 0 },

    // Cabelo.
    { label: "Cuidados com o cabelo", categoryId: "MLB1263", parentCategoryId: null, depth: 0 },
    { label: "Shampoos e condicionadores", categoryId: "MLB1265", parentCategoryId: "MLB1263", depth: 1 },
    { label: "Tratamentos para o cabelo", categoryId: "MLB32130", parentCategoryId: "MLB1263", depth: 1 },
    { label: "Pomadas, ceras e gel para o cabelo", categoryId: "MLB263523", parentCategoryId: "MLB1263", depth: 1 },
    { label: "Cremes de pentear", categoryId: "MLB388017", parentCategoryId: "MLB1263", depth: 1 },

    // Pele.
    { label: "Cuidados com a pele", categoryId: "MLB199407", parentCategoryId: null, depth: 0 },
    { label: "Cuidado facial", categoryId: "MLB264874", parentCategoryId: "MLB199407", depth: 1 },
    { label: "Limpeza facial", categoryId: "MLB1257", parentCategoryId: "MLB199407", depth: 1 },
    { label: "Cuidado do corpo", categoryId: "MLB1262", parentCategoryId: "MLB199407", depth: 1 },
    { label: "Proteção solar", categoryId: "MLB8133", parentCategoryId: "MLB199407", depth: 1 },

    // Perfume.
    { label: "Perfumes", categoryId: "MLB6284", parentCategoryId: null, depth: 0 },

    // Higiene do dia a dia.
    { label: "Desodorantes", categoryId: "MLB44379", parentCategoryId: null, depth: 0 },
    { label: "Sabonetes", categoryId: "MLB5382", parentCategoryId: null, depth: 0 },
    { label: "Higiene bucal", categoryId: "MLB264756", parentCategoryId: null, depth: 0 },
    { label: "Barbeadores descartáveis", categoryId: "MLB264765", parentCategoryId: null, depth: 0 },
    { label: "Cartuchos para barbeadores", categoryId: "MLB416700", parentCategoryId: null, depth: 0 },
  ];

  // Upsert por categoryId (@unique) em vez de id sintético — evita duplicata
  // se a busca automática de categorias já tiver rodado antes deste seed. A
  // atualização só toca label/parentCategoryId/depth: nunca enabled, limit ou
  // minDiscount, que o usuário pode já ter ajustado no painel.
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

  // O seed NÃO apaga nada: quem decide o que sai da lista é o usuário, pelo
  // painel. Ele semeia o conjunto certo e deixa o resto como está.
  console.log(`✓ ${watches.length} categorias de cuidado pessoal masculino criadas/atualizadas`);

  // ============================================================================
  // Phrases — ~25 frases curtas para grupo de WhatsApp de ofertas
  // ============================================================================

  // "grupo" é só uma chave interna deste script (tipo de copy: abertura/
  // urgência/cta/emoji/geral) — não existe mais no schema. Usada
  // EXCLUSIVAMENTE para preservar os ids determinísticos já semeados; não
  // é gravada no banco.
  const phrases = [
    // Abertura
    { text: "🔥 ACHADO DO DIA", grupo: "abertura" },
    { text: "🚨 SUPER OFERTA AGORA", grupo: "abertura" },
    { text: "💥 DESCE O PREÇO", grupo: "abertura" },
    { text: "🎯 VEM VER ISSO", grupo: "abertura" },
    { text: "⚡ IMPERDÍVEL", grupo: "abertura" },

    // Urgência
    { text: "Corre que é por tempo limitado ⏰", grupo: "urgencia" },
    { text: "Válido só enquanto durar estoque 🏃", grupo: "urgencia" },
    { text: "Última chance antes do preço subir 📈", grupo: "urgencia" },
    { text: "Sai de estoque rápido 🔔", grupo: "urgencia" },
    { text: "Oferecidos até meia-noite ⏳", grupo: "urgencia" },

    // CTA
    { text: "Garanta o seu pelo link 👇", grupo: "cta" },
    { text: "Clica aqui e aproveita 👆", grupo: "cta" },
    { text: "Acessa a oferta completa aqui ⬇", grupo: "cta" },
    { text: "Não deixa passar, clica no link 🔗", grupo: "cta" },
    { text: "Libera a oferta lá embaixo 👇", grupo: "cta" },
    { text: "Corre pro link antes de acabar 🏃💨", grupo: "cta" },

    // Emoji (linhas decorativas)
    { text: "🔥🔥🔥🔥🔥", grupo: "emoji" },
    { text: "⚡⚡⚡⚡⚡", grupo: "emoji" },
    { text: "💥💥💥💥💥", grupo: "emoji" },
    { text: "✨✨✨✨✨", grupo: "emoji" },
    { text: "🎯🎯🎯🎯🎯", grupo: "emoji" },
    { text: "━━━━━━━━━━", grupo: "emoji" },
    { text: "════════════", grupo: "emoji" },

    // Geral
    { text: "Melhor preço da internet 💰", grupo: "geral" },
    { text: "Frete grátis pra todo Brasil 📦", grupo: "geral" },
    { text: "Parcelado sem juros 💳", grupo: "geral" },
  ];

  // Índice na chave porque frases só de emoji não geram slug utilizável.
  for (const [i, phrase] of phrases.entries()) {
    const id = seedId("phrase", `${String(i + 1).padStart(2, "0")}-${phrase.grupo}`);
    await prisma.phrase.upsert({
      where: { id },
      update: { text: phrase.text, active: true },
      create: {
        id,
        text: phrase.text,
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
