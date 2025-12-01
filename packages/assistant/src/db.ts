/**
 * Drizzle ORM Database Client for Hail-Mary Assistant
 *
 * PostgreSQL connection using Drizzle ORM and node-postgres (pg).
 * Shares the same database as the core API.
 * 
 * Note: We import the compiled schema from the API package's dist folder.
 * Make sure to build the API package first.
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

// Define just the tables needed by the assistant service
// This mirrors the schema in packages/api/src/db/drizzle-schema.ts

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  town: varchar("town", { length: 255 }),
  postcode: varchar("postcode", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const visitSessions = pgTable("visit_sessions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  customerId: integer("customer_id")
    .references(() => customers.id)
    .notNull(),
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
  customerId: integer("customer_id")
    .references(() => customers.id)
    .notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
