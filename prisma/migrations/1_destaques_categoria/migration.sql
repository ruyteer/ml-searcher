-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "catalogId" TEXT;

-- AlterTable
ALTER TABLE "Watch" ADD COLUMN     "auto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentCategoryId" TEXT;

-- CreateIndex
CREATE INDEX "Product_catalogId_idx" ON "Product"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "Watch_categoryId_key" ON "Watch"("categoryId");

-- CreateIndex
CREATE INDEX "Watch_parentCategoryId_idx" ON "Watch"("parentCategoryId");
