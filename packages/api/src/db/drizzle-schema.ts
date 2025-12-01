/**
 * Drizzle ORM Schema for Hail-Mary Quote Tool
 *
 * PostgreSQL database schema using Drizzle ORM.
 * Core entities: accounts, users, customers, leads, products, quotes, quote_lines,
 * visit_sessions, media_attachments, survey_templates, survey_instances, survey_answers, visit_observations
 */

import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  timestamp,
  numeric,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

// Accounts / tenancies (optional but useful)
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Users (people using the system)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Customers (households / people you quote for)
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

// Leads (raw inbound interest)
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  source: varchar("source", { length: 100 }), // e.g. "web", "phone", "referral"
  status: varchar("status", { length: 50 }).default("new").notNull(), // new, contacted, qualified, closed
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Products (boilers, cylinders, filters, controls, etc.)
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Quotes (header)
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  customerId: integer("customer_id")
    .references(() => customers.id)
    .notNull(),
  leadId: integer("lead_id").references(() => leads.id),
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, sent, accepted, rejected, expired
  title: varchar("title", { length: 255 }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Quote lines (line items)
export const quoteLines = pgTable("quote_lines", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .references(() => quotes.id)
    .notNull(),
  productId: integer("product_id").references(() => products.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
});

// ============================================
// Visit & Survey Tables (for voice-first workflow)
// ============================================

// Visit sessions - tracks a single site visit for a customer
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
  status: varchar("status", { length: 50 }).default("in_progress").notNull(), // in_progress, completed, cancelled
});

// Media attachments - photos, videos, measurement screenshots
export const mediaAttachments = pgTable("media_attachments", {
  id: serial("id").primaryKey(),
  visitSessionId: integer("visit_session_id")
    .references(() => visitSessions.id)
    .notNull(),
  customerId: integer("customer_id")
    .references(() => customers.id)
    .notNull(),
  type: varchar("type", { length: 50 }).notNull(), // photo, video, measurement, other
  url: text("url").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Survey templates - user-designed survey structures
export const surveyTemplates = pgTable("survey_templates", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  schema: jsonb("schema").notNull(), // holds sections and questions
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Survey instances - a specific survey for a specific visit
export const surveyInstances = pgTable("survey_instances", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .references(() => surveyTemplates.id)
    .notNull(),
  visitSessionId: integer("visit_session_id")
    .references(() => visitSessions.id)
    .notNull(),
  customerId: integer("customer_id")
    .references(() => customers.id)
    .notNull(),
  status: varchar("status", { length: 50 }).default("in_progress").notNull(), // in_progress, complete
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Survey answers - individual answers to survey questions
export const surveyAnswers = pgTable("survey_answers", {
  id: serial("id").primaryKey(),
  instanceId: integer("instance_id")
    .references(() => surveyInstances.id)
    .notNull(),
  questionId: varchar("question_id", { length: 255 }).notNull(), // matches question id from template.schema
  value: jsonb("value"), // actual answer (string/number/bool/array)
  source: varchar("source", { length: 50 }).notNull(), // voice, manual, ai
  rawText: text("raw_text"), // original phrasing from transcript
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Visit observations - raw observations from STT during a visit
export const visitObservations = pgTable("visit_observations", {
  id: serial("id").primaryKey(),
  visitSessionId: integer("visit_session_id")
    .references(() => visitSessions.id)
    .notNull(),
  customerId: integer("customer_id")
    .references(() => customers.id)
    .notNull(),
  text: text("text").notNull(), // raw observation from STT
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
