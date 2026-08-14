-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "affiliateCheckError" TEXT,
ADD COLUMN     "affiliateCheckedAt" TIMESTAMP(3),
ADD COLUMN     "affiliateEligible" BOOLEAN;

-- CreateIndex
CREATE INDEX "Product_affiliateEligible_idx" ON "Product"("affiliateEligible");
