-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "ordersThisMonth" INTEGER NOT NULL DEFAULT 0,
    "orderLimit" INTEGER NOT NULL DEFAULT 10,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- One Organization per User; same id as User for stable Order.organizationId FK
INSERT INTO "Organization" ("id", "plan", "ordersThisMonth", "orderLimit", "currentPeriodStart", "currentPeriodEnd", "stripeCustomerId", "stripeSubscriptionId")
SELECT
    u."id",
    'FREE'::"Plan",
    0,
    10,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + interval '1 month',
    u."stripeCustomerId",
    NULL
FROM "User" u;

CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Order belongs to Organization instead of User
ALTER TABLE "Order" DROP CONSTRAINT "Order_organizationId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "User_stripeCustomerId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "stripeCustomerId";
