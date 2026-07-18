-- CreateTable
CREATE TABLE "PlatformAlertSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "newUserAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "planChangeAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAlertSettings_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row
INSERT INTO "PlatformAlertSettings" ("id", "newUserAlertsEnabled", "planChangeAlertsEnabled", "updatedAt")
VALUES (1, true, true, CURRENT_TIMESTAMP);
