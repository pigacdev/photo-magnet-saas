-- AlterTable
ALTER TABLE "Event" ADD COLUMN "notificationEmail" TEXT,
ADD COLUMN "sendOrderEmails" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Storefront" ADD COLUMN "notificationEmail" TEXT,
ADD COLUMN "sendOrderEmails" BOOLEAN NOT NULL DEFAULT false;
