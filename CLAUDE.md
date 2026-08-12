# ML Searcher

Dashboard de ofertas do Mercado Livre (nicho: cuidado pessoal masculino) com
geração de links de afiliado, páginas de pre-sell e métricas de clique.

## Stack

Next.js 16 (App Router, `src/`) · TypeScript · Tailwind v4 · shadcn/ui v4
Prisma 7 + PostgreSQL · deploy no Railway.

## Regras do projeto

- **Não escreva nem rode testes.** O projeto não usa testes.
- **Dinheiro sempre em centavos** (`Int`) no banco. Converta só na borda, com
  `toCents` / `formatBRL` de `src/lib/format.ts`.
- **Nada de valor hardcoded que o usuário deva controlar.** Desconto mínimo,
  domínio público, tag de afiliado, categorias monitoradas — tudo vive em
  `Setting` / `Watch` e é editável pelo painel. Ver `src/lib/settings.ts`.
- **Cache**: use as tags de `src/lib/cache.ts` e chame `revalidateTag` toda vez
  que a mutação alterar o dado. Cache velho é bug.
- **Percepção de velocidade importa**: Suspense + skeletons em toda página,
  `prefetch` nos links da sidebar, UI otimista nas ações rápidas.
- Comentários curtos, em português, só onde a intenção não é óbvia.
- Sem `any`.

## Estrutura

```
src/lib/ml/         cliente da API do Mercado Livre (OAuth + busca)
src/lib/scraper/    motor de varredura e detecção de oferta
src/lib/links.ts    links rastreados, afiliado e registro de clique
src/lib/settings.ts configuração editável pelo painel
src/app/(painel)/   dashboard (protegido por senha única)
src/app/r/[slug]/   redirecionador que contabiliza clique
src/app/p/[slug]/   pre-sell pública
```

## Comandos

```bash
npm run dev
npx prisma migrate dev       # criar/aplicar migration
npx prisma generate
npx tsx prisma/seed.ts       # popular categorias, frases e templates
npx tsc --noEmit             # checagem de tipos
```

## Estado atual

Fase 0 (base) e fase 1 (motor de scraping) em construção. Fases seguintes:
produtos/ofertas, tracking e analytics, pre-sell, frases, WhatsApp (Uazapi).
Ver `docs/` para as instruções originais do usuário.
