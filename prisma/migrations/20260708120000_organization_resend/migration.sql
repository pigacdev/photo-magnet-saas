-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "resend_api_key_encrypted" TEXT,
ADD COLUMN "resend_from_email" TEXT,
ADD COLUMN "resend_from_name" TEXT,
ADD COLUMN "resend_configured_at" TIMESTAMP(3);
