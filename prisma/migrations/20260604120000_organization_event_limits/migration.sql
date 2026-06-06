-- Monthly event creation limits (billing period; see saas.ts)
ALTER TABLE "Organization" ADD COLUMN "eventsCreatedThisMonth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN "eventLimit" INTEGER NOT NULL DEFAULT 1;
