-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "whatsappSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Offer_status_whatsappSentAt_idx" ON "Offer"("status", "whatsappSentAt");

-- CreateIndex
CREATE INDEX "SendLog_status_sentAt_idx" ON "SendLog"("status", "sentAt");
