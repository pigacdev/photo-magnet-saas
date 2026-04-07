-- CreateEnum
CREATE TYPE "SessionImageStatus" AS ENUM ('UPLOADED', 'FAILED');

-- CreateTable
CREATE TABLE "SessionImage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "SessionImageStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionImage_sessionId_idx" ON "SessionImage"("sessionId");

-- AddForeignKey
ALTER TABLE "SessionImage" ADD CONSTRAINT "SessionImage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OrderSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
