-- AlterTable
ALTER TABLE "Presell" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "headline" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Presell_isDefault_idx" ON "Presell"("isDefault");
