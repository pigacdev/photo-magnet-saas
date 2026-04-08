import type { Prisma } from "../../../src/generated/prisma/client";

/**
 * Canonical list order for SessionImage rows (API lists, commit snapshot, any multi-image read).
 * Always: magnet 1 → 2 → 3 by position; createdAt breaks ties.
 */
export const SESSION_IMAGE_LIST_ORDER_BY: Prisma.SessionImageOrderByWithRelationInput[] =
  [{ position: "asc" }, { createdAt: "asc" }];

/**
 * Canonical list order for OrderImage rows (printing, dashboard, exports).
 * Must match SessionImage ordering semantics at commit time.
 */
export const ORDER_IMAGE_LIST_ORDER_BY: Prisma.OrderImageOrderByWithRelationInput[] =
  [{ position: "asc" }, { createdAt: "asc" }];
