import { api } from "@/lib/api";
import {
  hasUnvalidatedAllowedShapes,
  isProductionValidatedShape,
} from "@/lib/shapePresets";

type AllowedShapeRecord = {
  id: string;
  shapeType: string;
  widthMm: number;
  heightMm: number;
};

/**
 * Deletes AllowedShape rows that are no longer production-validated (legacy data
 * from before the square-only early-access catalog).
 */
export async function removeStaleUnvalidatedAllowedShapes(
  context: "event" | "storefront",
  contextId: string,
  shapes: AllowedShapeRecord[],
): Promise<boolean> {
  const stale = shapes.filter((s) => !isProductionValidatedShape(s));
  if (stale.length === 0) return false;

  const base =
    context === "event"
      ? `/api/events/${contextId}`
      : `/api/storefronts/${contextId}`;

  for (const shape of stale) {
    await api(`${base}/shapes/${shape.id}`, { method: "DELETE" });
  }

  return true;
}

export { hasUnvalidatedAllowedShapes };
