import { prisma } from "./prisma";
import {
  filterProductionValidatedShapes,
  type ShapeKeyInput,
} from "./validatedShapes";

export { filterProductionValidatedShapes };

/** Shapes the seller can configure / offer (production-validated catalog only). */
export function shapesForSellerCatalog<T extends ShapeKeyInput>(shapes: T[]): T[] {
  return filterProductionValidatedShapes(shapes);
}

export type DeleteAllowedShapeResult =
  | { outcome: "deleted" }
  | { outcome: "retained"; reason: "in_use" };

/**
 * Deletes an AllowedShape when safe. Rows referenced by committed OrderImage
 * rows are retained (FK RESTRICT) so historical orders stay intact.
 */
export async function deleteAllowedShapeSafely(
  shapeId: string,
): Promise<DeleteAllowedShapeResult> {
  const orderImageCount = await prisma.orderImage.count({
    where: { shapeId },
  });
  if (orderImageCount > 0) {
    return { outcome: "retained", reason: "in_use" };
  }

  await prisma.allowedShape.delete({ where: { id: shapeId } });
  return { outcome: "deleted" };
}
