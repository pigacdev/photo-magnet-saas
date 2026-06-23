-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "dateFormat" TEXT,
ADD COLUMN "sizeUnit" TEXT;

-- Backfill existing organizations with display defaults (UI-only prefs)
UPDATE "Organization" SET "dateFormat" = 'DMY', "sizeUnit" = 'mm' WHERE "dateFormat" IS NULL;
