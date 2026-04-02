-- AlterTable
ALTER TABLE "OrderSession" ADD COLUMN     "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "OrderSession_lastActiveAt_idx" ON "OrderSession"("lastActiveAt");
