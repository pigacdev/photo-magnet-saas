-- AlterEnum
ALTER TYPE "Plan" ADD VALUE 'HOBBY';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "clerkSubscriptionId" TEXT,
ADD COLUMN "clerkPlanSlug" TEXT;

-- CreateTable
CREATE TABLE "ProcessedClerkEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedClerkEvent_pkey" PRIMARY KEY ("id")
);
