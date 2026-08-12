-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('NEW', 'PUBLISHED', 'IGNORED');

-- CreateEnum
CREATE TYPE "LinkKind" AS ENUM ('DIRECT', 'TRACKED', 'PRESELL');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "categoryId" TEXT,
    "query" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minDiscount" INTEGER,
    "limit" INTEGER NOT NULL DEFAULT 100,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "mlId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnail" TEXT,
    "permalink" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "originalPrice" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "categoryId" TEXT,
    "categoryName" TEXT,
    "sellerId" TEXT,
    "sellerName" TEXT,
    "sellerStatus" TEXT,
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "soldQuantity" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "condition" TEXT,
    "officialStore" BOOLEAN NOT NULL DEFAULT false,
    "watchId" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "referencePrice" INTEGER NOT NULL,
    "referenceKind" TEXT NOT NULL,
    "discountPct" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" "OfferStatus" NOT NULL DEFAULT 'NEW',
    "runId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Link" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "LinkKind" NOT NULL DEFAULT 'TRACKED',
    "label" TEXT,
    "productId" TEXT,
    "targetUrl" TEXT NOT NULL,
    "affiliate" BOOLEAN NOT NULL DEFAULT false,
    "presellId" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Click" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "country" TEXT,
    "device" TEXT,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presell" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT,
    "ctaText" TEXT NOT NULL DEFAULT 'Liberar oferta',
    "gateUrl" TEXT,
    "gateLabel" TEXT NOT NULL DEFAULT 'Acessar link do patrocinador',
    "gateDelay" INTEGER NOT NULL DEFAULT 5,
    "imageUrl" TEXT,
    "priceLabel" INTEGER,
    "originalLabel" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phrase" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'geral',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Phrase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappInstance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "lastSync" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappGroup" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendLog" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "groupId" TEXT,
    "message" TEXT NOT NULL,
    "linkId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "watchesTotal" INTEGER NOT NULL DEFAULT 0,
    "watchesDone" INTEGER NOT NULL DEFAULT 0,
    "itemsSeen" INTEGER NOT NULL DEFAULT 0,
    "productsNew" INTEGER NOT NULL DEFAULT 0,
    "offersNew" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "log" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Watch_enabled_idx" ON "Watch"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "Product_mlId_key" ON "Product"("mlId");

-- CreateIndex
CREATE INDEX "Product_lastSeenAt_idx" ON "Product"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_blocked_idx" ON "Product"("blocked");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_capturedAt_idx" ON "PriceHistory"("productId", "capturedAt");

-- CreateIndex
CREATE INDEX "Offer_status_detectedAt_idx" ON "Offer"("status", "detectedAt");

-- CreateIndex
CREATE INDEX "Offer_score_idx" ON "Offer"("score");

-- CreateIndex
CREATE INDEX "Offer_productId_detectedAt_idx" ON "Offer"("productId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Link_slug_key" ON "Link"("slug");

-- CreateIndex
CREATE INDEX "Link_productId_idx" ON "Link"("productId");

-- CreateIndex
CREATE INDEX "Link_createdAt_idx" ON "Link"("createdAt");

-- CreateIndex
CREATE INDEX "Click_linkId_createdAt_idx" ON "Click"("linkId", "createdAt");

-- CreateIndex
CREATE INDEX "Click_createdAt_idx" ON "Click"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Presell_slug_key" ON "Presell"("slug");

-- CreateIndex
CREATE INDEX "Presell_active_idx" ON "Presell"("active");

-- CreateIndex
CREATE INDEX "Phrase_category_active_idx" ON "Phrase"("category", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappGroup_instanceId_remoteJid_key" ON "WhatsappGroup"("instanceId", "remoteJid");

-- CreateIndex
CREATE INDEX "SendLog_status_scheduledFor_idx" ON "SendLog"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "SendLog_createdAt_idx" ON "SendLog"("createdAt");

-- CreateIndex
CREATE INDEX "ScrapeRun_startedAt_idx" ON "ScrapeRun"("startedAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ScrapeRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_presellId_fkey" FOREIGN KEY ("presellId") REFERENCES "Presell"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappGroup" ADD CONSTRAINT "WhatsappGroup_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WhatsappInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendLog" ADD CONSTRAINT "SendLog_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WhatsappInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendLog" ADD CONSTRAINT "SendLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WhatsappGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
