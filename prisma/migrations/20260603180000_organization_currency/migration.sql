-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "currency" TEXT,
ADD COLUMN "initialSetupAt" TIMESTAMP(3);

-- Backfill existing organizations so they skip onboarding modal
UPDATE "Organization" SET "currency" = 'EUR', "initialSetupAt" = CURRENT_TIMESTAMP WHERE "currency" IS NULL;
