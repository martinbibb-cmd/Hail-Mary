// packages/api/drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/drizzle-schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
} satisfies Config;
