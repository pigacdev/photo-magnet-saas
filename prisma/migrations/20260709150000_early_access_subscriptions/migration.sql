-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "isEarlyAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "earlyAccessExpiresAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "grantLifetimeDiscount" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "earlyAccessHeadsUpSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EarlyAccessCounter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "seatsTaken" INTEGER NOT NULL DEFAULT 0,
    "plansFlippedAt" TIMESTAMP(3),

    CONSTRAINT "EarlyAccessCounter_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row
INSERT INTO "EarlyAccessCounter" ("id", "seatsTaken") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;
