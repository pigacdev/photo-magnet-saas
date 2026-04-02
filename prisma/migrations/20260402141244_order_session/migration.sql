-- CreateEnum
CREATE TYPE "OrderSessionStatus" AS ENUM ('ACTIVE', 'ABANDONED', 'CONVERTED');

-- CreateTable
CREATE TABLE "OrderSession" (
    "id" TEXT NOT NULL,
    "contextType" "ContextType" NOT NULL,
    "contextId" TEXT NOT NULL,
    "status" "OrderSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderSession_contextType_contextId_idx" ON "OrderSession"("contextType", "contextId");

-- CreateIndex
CREATE INDEX "OrderSession_expiresAt_idx" ON "OrderSession"("expiresAt");
