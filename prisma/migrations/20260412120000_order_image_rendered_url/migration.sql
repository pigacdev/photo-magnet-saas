-- Persist path to Sharp-rendered print file per OrderImage.

ALTER TABLE "OrderImage" ADD COLUMN "renderedUrl" TEXT;
