import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

/** Match Next.js dev env file order. */
const envFiles = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
];

for (const file of envFiles) {
  dotenv.config({
    path: path.join(root, file),
    override: file !== ".env",
  });
}

type KeylessClerkKeys = {
  secretKey?: string;
  publishableKey?: string;
};

function setClerkEnv(name: string, value: string | undefined): void {
  if (!value?.trim() || process.env[name]?.trim()) return;
  process.env[name] = value.trim();
}

/** Clerk keyless dev mode writes keys for Next.js; Express needs them too. */
function loadKeylessClerkKeys(): void {
  const keylessPath = path.join(root, ".clerk", ".tmp", "keyless.json");
  if (!fs.existsSync(keylessPath)) return;

  try {
    const keys = JSON.parse(
      fs.readFileSync(keylessPath, "utf8"),
    ) as KeylessClerkKeys;

    setClerkEnv("CLERK_SECRET_KEY", keys.secretKey);
    setClerkEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", keys.publishableKey);
    setClerkEnv("CLERK_PUBLISHABLE_KEY", keys.publishableKey);
  } catch {
    /* keyless file missing or invalid */
  }
}

loadKeylessClerkKeys();

export const projectRoot = root;

export function getClerkPublishableKeyFromEnv(): string | undefined {
  return (
    process.env.CLERK_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
    undefined
  );
}

export function getClerkSecretKeyFromEnv(): string | undefined {
  return process.env.CLERK_SECRET_KEY?.trim() || undefined;
}
