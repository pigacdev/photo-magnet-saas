import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Railway may expose DATABASE_PRIVATE_URL for private-network Postgres.
    url:
      process.env["DATABASE_URL"] ||
      process.env["DATABASE_PRIVATE_URL"] ||
      undefined,
  },
});

