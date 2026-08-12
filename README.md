# Mercado Libre Offers Dashboard

Dashboard de ofertas do Mercado Livre com links de afiliado, páginas de pré-venda e métricas de clique em tempo real.

## O que é

Monitora automaticamente produtos em categorias específicas do Mercado Livre, detecta quedas de preço (ofertas) e as distribui para grupos de WhatsApp com links rastreados. Oferece:

- **Monitoramento automático** de categorias e termos de busca via scraper
- **Detecção de ofertas** baseada em desconto mínimo e histórico de preços
- **Links rastreados** com contagem de cliques e deduplicação de IP
- **Páginas de pré-venda** como "gatilho mental" antes de redirecionar
- **Integração WhatsApp** via Uazapi para distribuição automática
- **Dashboard** para gerenciar watches, ofertas, templates e métricas

## Stack

- **Frontend**: Next.js 16 (React 19)
- **Backend**: Next.js API routes + cron jobs
- **Banco de dados**: PostgreSQL + Prisma 7 (PrismaPg adapter)
- **Deploy**: Railway
- **Containerização**: Docker (Nixpacks ou Dockerfile standalone)
- **Autenticação**: sessão de painel com senha única

## Como rodar local

### Pré-requisitos

- Node.js 22+
- PostgreSQL 13+
- Variáveis de ambiente configuradas

### Passos

1. **Copiar variáveis de ambiente:**
   ```bash
   cp .env.example .env
   ```
   Editar `.env` com credenciais do PostgreSQL local.

2. **Instalar dependências:**
   ```bash
   npm install
   ```

3. **Subir banco e migrations:**
   ```bash
   npx prisma migrate dev
   ```

4. **Seed do banco (inicial):**
   ```bash
   npx tsx prisma/seed.ts
   ```
   Popula 10 watches, 25 frases e 3 templates de mensagem.

5. **Iniciar servidor local:**
   ```bash
   npm run dev
   ```
   Acesso em `http://localhost:3000`

## Variáveis de ambiente

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | String de conexão PostgreSQL (Prisma) | `postgresql://user:pass@localhost:5432/mloffers` |
| `APP_PASSWORD` | Senha única do painel de controle | Trocar aqui desloga todas as sessões |
| `ML_CLIENT_ID` | ID de app do Mercado Livre (developers.mercadolivre.com.br) | Deixar vazio e preencher pelo painel |
| `ML_CLIENT_SECRET` | Secret da app ML | Deixar vazio e preencher pelo painel |
| `PUBLIC_BASE_URL` | Domínio público para montar links copiáveis | Vazio = usa host da request (Railway) |
| `UAZAPI_HOST` | URL base da Uazapi (WhatsApp) | `https://free.uazapi.com` |
| `CRON_SECRET` | Token para proteger endpoints de cron | Gerado aleatoriamente |

## Deploy no Railway

### Pré-requisitos

1. Criar projeto no Railway (railway.app)
2. Adicionar PostgreSQL via "Add Services"
3. Conectar repositório GitHub

### Variáveis no Railway

1. Copiar `DATABASE_URL` do addon PostgreSQL para `Postgres` -> `Connect` -> `DATABASE_URL`
2. Adicionar ao projeto:
   - `APP_PASSWORD`
   - `ML_CLIENT_ID` (opcional, preencher depois)
   - `ML_CLIENT_SECRET` (opcional, preencher depois)
   - `PUBLIC_BASE_URL` (domínio público ou deixar vazio)
   - `UAZAPI_HOST`
   - `CRON_SECRET`

### Build & Deploy

O `railway.json` está configurado com:
- **Builder**: Nixpacks (recomendado)
- **Start Command**: `npx prisma migrate deploy && npm run start`
- **Restart**: ON_FAILURE

Alternativamente, usar `Dockerfile` + `.dockerignore` (comentado no railway.json).

## Estrutura de arquivos

```
.
├── prisma/
│   ├── schema.prisma          # Modelos (Watch, Product, Offer, Link, etc.)
│   ├── migrations/            # Histórico de alterações do schema
│   └── seed.ts                # Seed idempotente (watches, frases, templates)
├── src/
│   ├── app/                   # Next.js 16 app router
│   ├── lib/
│   │   └── prisma.ts          # Cliente Prisma com PrismaPg
│   └── generated/prisma/      # Cliente Prisma gerado
├── railway.json               # Configuração de deploy Railway
├── Dockerfile                 # Multi-stage, standalone
├── .dockerignore              # Arquivos a ignorar na build
├── next.config.ts             # Configuração Next.js
├── package.json
└── .env.example               # Template de variáveis
```

## Notas

- O seed é **idempotente**: rodá-lo duas vezes não duplica dados.
- Watches com `enabled=true` são varridas pelo scraper.
- Templates de mensagem suportam `{{titulo}}`, `{{preco}}`, `{{precoAntigo}}`, `{{desconto}}`, `{{link}}`, `{{frase}}`.
- Frases são agrupadas por categoria: "abertura", "urgência", "cta", "emoji", "geral".
- Cliques em links são contabilizados com deduplicação de IP.
