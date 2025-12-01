/**
 * Drizzle ORM Database Client for Hail-Mary
 *
 * PostgreSQL connection using Drizzle ORM and node-postgres (pg).
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./drizzle-schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
