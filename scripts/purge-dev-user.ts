import "dotenv/config";
import { prisma } from "../src/lib/prisma";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function usage(): never {
  console.error("Usage: npm run db:purge-user -- user@example.com");
  process.exit(1);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run in production (NODE_ENV=production).");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const emailArg = process.argv[2];
  if (!emailArg) usage();

  const email = normalizeEmail(emailArg);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, clerkId: true, deletedAt: true },
  });

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const userId = user.id;

  const [events, storefronts] = await Promise.all([
    prisma.event.findMany({ where: { userId }, select: { id: true } }),
    prisma.storefront.findMany({ where: { userId }, select: { id: true } }),
  ]);

  const eventIds = events.map((e) => e.id);
  const storefrontIds = storefronts.map((s) => s.id);

  const counts = await prisma.$transaction(async (tx) => {
    const orders = await tx.order.deleteMany({ where: { organizationId: userId } });

    let orderSessions = { count: 0 };
    if (eventIds.length > 0 || storefrontIds.length > 0) {
      orderSessions = await tx.orderSession.deleteMany({
        where: {
          OR: [
            ...(eventIds.length > 0
              ? [{ contextType: "EVENT" as const, contextId: { in: eventIds } }]
              : []),
            ...(storefrontIds.length > 0
              ? [{ contextType: "STOREFRONT" as const, contextId: { in: storefrontIds } }]
              : []),
          ],
        },
      });
    }

    let pricing = { count: 0 };
    let allowedShapes = { count: 0 };
    if (eventIds.length > 0 || storefrontIds.length > 0) {
      pricing = await tx.pricing.deleteMany({
        where: {
          OR: [
            ...(eventIds.length > 0
              ? [{ contextType: "EVENT" as const, contextId: { in: eventIds } }]
              : []),
            ...(storefrontIds.length > 0
              ? [{ contextType: "STOREFRONT" as const, contextId: { in: storefrontIds } }]
              : []),
          ],
        },
      });

      allowedShapes = await tx.allowedShape.deleteMany({
        where: {
          OR: [
            ...(eventIds.length > 0
              ? [{ contextType: "EVENT" as const, contextId: { in: eventIds } }]
              : []),
            ...(storefrontIds.length > 0
              ? [{ contextType: "STOREFRONT" as const, contextId: { in: storefrontIds } }]
              : []),
          ],
        },
      });
    }

    await tx.user.delete({ where: { id: userId } });

    return {
      orders: orders.count,
      orderSessions: orderSessions.count,
      pricing: pricing.count,
      allowedShapes: allowedShapes.count,
      events: eventIds.length,
      storefronts: storefrontIds.length,
    };
  });

  console.log(`Purged seller ${email} (${userId}):`);
  console.log(`  Orders:         ${counts.orders}`);
  console.log(`  Order sessions: ${counts.orderSessions}`);
  console.log(`  Pricing rows:   ${counts.pricing}`);
  console.log(`  Allowed shapes: ${counts.allowedShapes}`);
  console.log(`  Events:         ${counts.events}`);
  console.log(`  Storefronts:    ${counts.storefronts}`);
  console.log("  User, Organization, and Customers removed via cascade.");

  if (user.deletedAt) {
    console.log("  (User was soft-deleted before purge.)");
  }

  console.log(
    "\nClerk account is separate — delete the user in Clerk Dashboard if you want a fully fresh signup.",
  );
  if (user.clerkId) {
    console.log(`  Clerk id: ${user.clerkId}`);
  }
}

main()
  .catch((err) => {
    console.error("Purge failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
