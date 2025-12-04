// packages/api/drizzle.config.ts
import "dotenv/config";
import type { Config } from "drizzle-kit";

// Use the same default as drizzle-client.ts for consistency
const DEFAULT_DATABASE_URL = "postgres://postgres@hailmary-postgres:5432/hailmary";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL environment variable is not set. Using default:", DEFAULT_DATABASE_URL);
}

export default {
  schema: "./src/db/drizzle-schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  },
} satisfies Config;
