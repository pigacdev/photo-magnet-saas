import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { isProductionValidatedShape } from "../server/src/lib/validatedShapes";

/**
 * Removes AllowedShape rows whose print template is not production-validated
 * (see server/src/lib/validatedShapes.ts). Use before inviting sellers so no
 * stale "Coming soon" shapes linger on already-configured events/storefronts.
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
    console.log(
      `  ${s.contextType} ${s.contextId} — ${s.shapeType} ${s.widthMm}x${s.heightMm} mm (${s.id})`,
    );
  }

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to delete these rows.");
    return;
  }

  const result = await prisma.allowedShape.deleteMany({
    where: { id: { in: unvalidated.map((s) => s.id) } },
  });
  console.log(`\nDeleted ${result.count} unvalidated shape row(s).`);
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
