-- AlterTable
ALTER TABLE "OrderImage" ADD COLUMN     "printed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "printedAt" TIMESTAMP(3);
