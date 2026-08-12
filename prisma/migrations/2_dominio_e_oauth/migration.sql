-- AlterTable
ALTER TABLE "Watch" ADD COLUMN     "domainId" TEXT;

-- CreateTable
CREATE TABLE "MLAuth" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "mlUserId" TEXT,
    "nickname" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MLAuth_pkey" PRIMARY KEY ("id")
);
