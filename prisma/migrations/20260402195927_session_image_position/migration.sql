-- AlterTable: safe for existing rows (backfill order = createdAt order per session)
ALTER TABLE "SessionImage" ADD COLUMN "position" INTEGER;

UPDATE "SessionImage" s
SET "position" = sub.rn
FROM (
  SELECT
    id,
    (ROW_NUMBER() OVER (PARTITION BY "sessionId" ORDER BY "createdAt" ASC))::integer AS rn
  FROM "SessionImage"
) sub
WHERE s.id = sub.id;

ALTER TABLE "SessionImage" ALTER COLUMN "position" SET NOT NULL;

-- CreateIndex
CREATE INDEX "SessionImage_sessionId_position_idx" ON "SessionImage"("sessionId", "position");
