-- AlterTable
ALTER TABLE "SessionImage" ADD COLUMN "mediaDeletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SessionImage_sessionId_mediaDeletedAt_idx" ON "SessionImage"("sessionId", "mediaDeletedAt");
