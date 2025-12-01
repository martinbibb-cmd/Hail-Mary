/**
 * Drizzle ORM Database Client for Hail-Mary Assistant
 *
 * PostgreSQL connection using Drizzle ORM and node-postgres (pg).
 * Shares the same database as the core API.
 * 
 * Note: We define only the tables needed by the assistant service.
 * The full schema is in packages/api/src/db/drizzle-schema.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL environment variable is not set. PostgreSQL features will not work.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

// Define only the tables needed by the assistant service for inserts
// Foreign key relationships are defined but we don't query these tables directly

export const visitSessions = pgTable("visit_sessions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  customerId: integer("customer_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  status: varchar("status", { length: 50 }).default("in_progress").notNull(),
});

export const visitObservations = pgTable("visit_observations", {
  id: serial("id").primaryKey(),
  visitSessionId: integer("visit_session_id")
    .references(() => visitSessions.id)
    .notNull(),
  customerId: integer("customer_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
