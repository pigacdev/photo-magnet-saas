import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { deleteAllowedShapeSafely } from "../server/src/lib/allowedShapeLifecycle";
import { isProductionValidatedShape } from "../server/src/lib/validatedShapes";

/**
 * Removes AllowedShape rows whose print template is not production-validated
 * (see server/src/lib/validatedShapes.ts). Shapes referenced by OrderImage rows
 * are kept for historical orders (FK RESTRICT).
 *
 * Dry-run by default. Pass --apply to delete.
 *   npm run db:remove-unvalidated-shapes            (report only)
 *   npm run db:remove-unvalidated-shapes -- --apply (delete)
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const apply = process.argv.includes("--apply");

  const shapes = await prisma.allowedShape.findMany({
    select: {
      id: true,
      contextType: true,
      contextId: true,
      shapeType: true,
      widthMm: true,
      heightMm: true,
    },
  });

  const unvalidated = shapes.filter((s) => !isProductionValidatedShape(s));

  if (unvalidated.length === 0) {
    console.log("No unvalidated AllowedShape rows found. Nothing to do.");
    return;
  }

  console.log(`Found ${unvalidated.length} unvalidated shape row(s):`);
  for (const s of unvalidated) {
    const inUse = await prisma.orderImage.count({ where: { shapeId: s.id } });
    const suffix = inUse > 0 ? ` — retained (${inUse} order image(s))` : "";
    console.log(
      `  ${s.contextType} ${s.contextId} — ${s.shapeType} ${s.widthMm}x${s.heightMm} mm (${s.id})${suffix}`,
    );
  }

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to delete removable rows.");
    return;
  }

  let deleted = 0;
  let retained = 0;
  for (const shape of unvalidated) {
    const result = await deleteAllowedShapeSafely(shape.id);
    if (result.outcome === "deleted") deleted += 1;
    else retained += 1;
  }
  console.log(`\nDeleted ${deleted} row(s); retained ${retained} in-use row(s).`);
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
