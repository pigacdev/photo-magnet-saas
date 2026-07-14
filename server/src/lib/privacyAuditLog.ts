import { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";

export type AuditEventInput = {
  action: string;
  actorEmail?: string | null;
  organizationId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PrivacyAuditInput = AuditEventInput;

function compactMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  return JSON.stringify(metadata);
}

export function formatAuditLogLine(input: AuditEventInput): string {
  const parts = [`[audit] action=${input.action}`];
  const actor = input.actorEmail?.trim();
  if (actor) parts.push(`actor=${actor}`);
  const org = input.organizationId?.trim();
  if (org) parts.push(`org=${org}`);
  if (input.targetType && input.targetId) {
    parts.push(`target=${input.targetType}:${input.targetId}`);
  }
  const meta = compactMetadata(input.metadata);
  if (meta) parts.push(`metadata=${meta}`);
  return parts.join(" ");
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  const line = formatAuditLogLine(input);
  console.info(line);

  try {
    await prisma.privacyAuditLog.create({
      data: {
        action: input.action,
        actorEmail: input.actorEmail?.trim() || null,
        organizationId: input.organizationId?.trim() || null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write DB row", input.action, err);
  }
}

/** @deprecated Use logAuditEvent — kept for existing imports */
export async function logPrivacyAudit(input: AuditEventInput): Promise<void> {
  return logAuditEvent(input);
}
