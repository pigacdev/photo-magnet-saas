import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaHostLogged?: boolean;
};

function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function resolveConnectionString(): string {
  const connectionString =
    process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL;
  if (!connectionString || typeof connectionString !== "string") {
    throw new Error(
      "DATABASE_URL is missing or invalid. On Railway, set web DATABASE_URL from the Postgres plugin Variable Reference (not localhost).",
    );
  }
  return connectionString;
}

function logDbHostOnce(connectionString: string): void {
  if (globalForPrisma.prismaHostLogged) return;
  globalForPrisma.prismaHostLogged = true;
  try {
    const host = new URL(connectionString).hostname || "(unknown)";
    console.info(`[web/prisma] Connecting to Postgres host: ${host}`);
  } catch {
    console.info("[web/prisma] Connecting to Postgres (host unparseable)");
  }
}

/**
 * Lazy Prisma singleton so Next.js can import API routes during build
 * without requiring DATABASE_URL at image-build time.
 */
function resolvePrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = resolveConnectionString();
  logDbHostOnce(connectionString);
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
