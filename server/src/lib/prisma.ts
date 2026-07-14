import "../load-env";
import { PrismaClient } from "../../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || typeof connectionString !== "string") {
  throw new Error(
    "DATABASE_URL is missing or invalid. Ensure .env exists at the project root and contains DATABASE_URL.",
  );
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function resolvePrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  // Dev HMR can keep a stale singleton from before schema/client updates.
  if (
    process.env.NODE_ENV !== "production" &&
    cached &&
    !("platformNotificationLog" in cached)
  ) {
    return createPrismaClient();
  }
  return cached ?? createPrismaClient();
}

export const prisma = resolvePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
