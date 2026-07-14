-- CreateTable
CREATE TABLE "PlatformNotificationLog" (
    "id" TEXT NOT NULL,
    "sentByEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "skippedOptOutCount" INTEGER NOT NULL,
    "includeOptedOut" BOOLEAN NOT NULL,
    "selectionMode" TEXT NOT NULL,
    "filterSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformNotificationLog_createdAt_idx" ON "PlatformNotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformNotificationLog_sentByEmail_idx" ON "PlatformNotificationLog"("sentByEmail");
