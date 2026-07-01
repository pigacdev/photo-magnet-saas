-- Clerk subscription payment period (separate from monthly usage quota window).

ALTER TABLE "Organization"
ADD COLUMN "subscriptionPeriodStart" TIMESTAMP(3),
ADD COLUMN "subscriptionPeriodEnd" TIMESTAMP(3);
