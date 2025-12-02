/**
 * Drizzle ORM Database Client for Hail-Mary
 *
 * PostgreSQL connection using Drizzle ORM and node-postgres (pg).
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./drizzle-schema";

const DEFAULT_DATABASE_URL = "postgres://postgres@hailmary-postgres:5432/hailmary";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL environment variable is not set. Using default:", DEFAULT_DATABASE_URL);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
});

export const db = drizzle(pool, { schema });
