-- GDPR compliance fields and audit log

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legalAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legalVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "erasureScheduledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingEmailsOptOut" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "consentAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "consentVersion" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "buyerPiiErasedAt" TIMESTAMP(3);

ALTER TABLE "OrderImage" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "OrderImage" ADD COLUMN IF NOT EXISTS "deletedReason" TEXT;

CREATE TABLE IF NOT EXISTS "PrivacyAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorEmail" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrivacyAuditLog_action_idx" ON "PrivacyAuditLog"("action");
CREATE INDEX IF NOT EXISTS "PrivacyAuditLog_targetId_idx" ON "PrivacyAuditLog"("targetId");
CREATE INDEX IF NOT EXISTS "PrivacyAuditLog_createdAt_idx" ON "PrivacyAuditLog"("createdAt");
