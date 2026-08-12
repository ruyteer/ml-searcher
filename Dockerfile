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

# O output standalone já traz as dependências que o servidor precisa.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# O CLI do Prisma não vem no standalone, mas é necessário para rodar
# `migrate deploy` na subida do container.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
# prisma.config.ts importa dotenv, e ele não faz parte do standalone.
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

USER nextjs
EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]
