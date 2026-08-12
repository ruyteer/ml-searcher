# Alternativa ao Nixpacks. Para usar, troque o builder em railway.json
# para "DOCKERFILE".

# ---------------------------------------------------------------- deps
FROM node:22-alpine AS deps
WORKDIR /app

# prisma.config.ts e o schema precisam existir antes do npm ci, porque o
# postinstall do projeto roda `prisma generate`.
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# --------------------------------------------------------------- build
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ------------------------------------------------------------- runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# O output standalone traz o servidor e as dependências que ele precisa.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# O CLI do Prisma roda `migrate deploy` na subida do container e NÃO vem no
# standalone. Copiamos o node_modules inteiro de propósito: a árvore de
# dependências do CLI é grande e recortá-la à mão quebra de formas difíceis
# de prever (já custou três correções seguidas: @prisma/config faltando,
# dotenv faltando, e o symlink de .bin/prisma virando arquivo solto no COPY).
# Isso engorda a imagem, e é uma troca consciente por previsibilidade.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

USER nextjs
EXPOSE 3000

# Chamamos o entrypoint real do CLI em vez de node_modules/.bin/prisma:
# aquele é um symlink, e o COPY do Docker o transformaria num arquivo solto
# cujo `require("./cli.js")` aponta para dentro de .bin, onde não há nada.
CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js migrate deploy && node server.js"]
