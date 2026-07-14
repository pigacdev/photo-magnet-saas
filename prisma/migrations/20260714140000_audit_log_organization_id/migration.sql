ALTER TABLE "PrivacyAuditLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "PrivacyAuditLog_organizationId_idx" ON "PrivacyAuditLog"("organizationId");
