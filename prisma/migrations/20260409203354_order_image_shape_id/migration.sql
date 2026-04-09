-- 1) Add nullable column (existing rows need backfill)
ALTER TABLE "OrderImage" ADD COLUMN "shapeId" TEXT;

-- 2) Backfill from the committing session (same shape for all images in that order today)
UPDATE "OrderImage" o
SET "shapeId" = s."selectedShapeId"
FROM "OrderSession" s
WHERE s."orderId" = o."orderId"
  AND s."selectedShapeId" IS NOT NULL;

-- 3) Enforce presence — adjust DB manually if this fails (legacy data)
ALTER TABLE "OrderImage" ALTER COLUMN "shapeId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "OrderImage_shapeId_idx" ON "OrderImage"("shapeId");

-- AddForeignKey
ALTER TABLE "OrderImage" ADD CONSTRAINT "OrderImage_shapeId_fkey" FOREIGN KEY ("shapeId") REFERENCES "AllowedShape"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
