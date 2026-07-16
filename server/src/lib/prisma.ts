import "../load-env";
import { PrismaClient } from "../../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

/**
 * Lazy Prisma singleton. Importing this module must not throw during
 * `next build` page-data collection when DATABASE_URL is unset in Docker.
 */
function resolvePrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  // Dev HMR can keep a stale singleton from before schema/client updates.
  if (
    process.env.NODE_ENV !== "production" &&
    cached &&
    !("platformNotificationLog" in cached)
  ) {
  const connectionString =
    process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL;
  if (!connectionString || typeof connectionString !== "string") {
    throw new Error(
      "DATABASE_URL is missing or invalid. On Railway, set DATABASE_URL from the Postgres plugin (not localhost).",
    );
  }
  return createPrismaClient(connectionString);
  }

  if (cached) return cached;

  const connectionString =
    process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL;
  if (!connectionString || typeof connectionString !== "string") {
    throw new Error(
      "DATABASE_URL is missing or invalid. On Railway, set DATABASE_URL from the Postgres plugin (not localhost).",
    );
  }

  return createPrismaClient(connectionString);
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = resolvePrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    } else if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = client;
    }
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
