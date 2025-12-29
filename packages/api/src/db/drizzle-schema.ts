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
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  numeric,
  boolean,
  jsonb,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

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
    .references(() => accounts.id),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash"), // nullable for SSO users
  authProvider: varchar("auth_provider", { length: 50 }).default("local").notNull(), // 'local' | 'google' | 'salesforce'
  externalId: varchar("external_id", { length: 255 }), // Salesforce user ID (nullable for local users)
  role: varchar("role", { length: 50 }).default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Password reset tokens for local auth password recovery
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  token: varchar("token", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Leads (single source of truth - combines lead tracking with customer contact info)
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  // User assignment for access control
  assignedUserId: integer("assigned_user_id")
    .references(() => users.id),
  // Contact information
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  city: varchar("city", { length: 255 }),
  postcode: varchar("postcode", { length: 20 }),
  country: varchar("country", { length: 100 }).default("UK"),
  // Lead information
  source: varchar("source", { length: 100 }), // e.g. "web", "phone", "referral", "existing_customer"
  status: varchar("status", { length: 50 }).default("new").notNull(), // new, contacted, qualified, quoted, won, lost
  description: text("description"),
  propertyType: varchar("property_type", { length: 100 }),
  estimatedValue: numeric("estimated_value", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
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
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(), // kept for backward compat
  addressId: uuid("address_id")
    .references(() => addresses.id, { onDelete: "set null" }), // NEW: link to addresses
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

// Appointments - scheduled visits, surveys, installations
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(),
  quoteId: integer("quote_id").references(() => quotes.id),
  type: varchar("type", { length: 50 }).notNull(), // survey, installation, follow-up
  status: varchar("status", { length: 50 }).default("scheduled").notNull(), // scheduled, completed, cancelled
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  duration: integer("duration").notNull().default(60), // in minutes
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  city: varchar("city", { length: 255 }),
  postcode: varchar("postcode", { length: 20 }),
  country: varchar("country", { length: 100 }).default("UK"),
  notes: text("notes"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================
// Visit & Survey Tables (for voice-first workflow)
// ============================================

// Visit sessions - tracks a single site visit for a lead
export const visitSessions = pgTable("visit_sessions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(), // kept for backward compat
  addressId: uuid("address_id")
    .references(() => addresses.id, { onDelete: "set null" }), // NEW: link to addresses
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  status: varchar("status", { length: 50 }).default("in_progress").notNull(), // in_progress, completed, cancelled
  summary: text("summary"), // AI-generated summary of the visit
});

// Media attachments - photos, videos, measurement screenshots
export const mediaAttachments = pgTable("media_attachments", {
  id: serial("id").primaryKey(),
  visitSessionId: integer("visit_session_id")
    .references(() => visitSessions.id)
    .notNull(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(), // kept for backward compat
  addressId: uuid("address_id")
    .references(() => addresses.id, { onDelete: "set null" }), // NEW: link to addresses
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
  leadId: integer("lead_id")
    .references(() => leads.id)
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
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(),
  text: text("text").notNull(), // raw observation from STT
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================
// Transcription System
// ============================================

// Transcript sessions - one survey visit -> one primary transcript session
export const transcriptSessions = pgTable("transcript_sessions", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id), // kept for backward compat
  addressId: uuid("address_id")
    .references(() => addresses.id, { onDelete: "set null" }), // NEW: link to addresses
  userId: integer("user_id").references(() => users.id), // user who created it
  postcode: varchar("postcode", { length: 20 }), // postcode anchor for property
  title: varchar("title", { length: 255 }), // e.g. "Transcript 2025-12-24 09:55"
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Option A ingestion metadata (live streaming)
  source: varchar("source", { length: 100 }), // e.g. "atlas", "ios", "android", "worker", "manual", "upload", "companion"
  deviceId: varchar("device_id", { length: 255 }),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  status: varchar("status", { length: 50 }).default("recording").notNull(), // recording, processing, completed, error, new, processed
  durationSeconds: integer("duration_seconds"),
  language: varchar("language", { length: 20 }).default("en-GB").notNull(),
  notes: text("notes"),
  // Paste/upload fields
  rawText: text("raw_text"), // pasted or uploaded transcript text
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"), // error message if processing failed
  summary: text("summary"), // AI-generated summary
  extractedJson: text("extracted_json"), // JSON string of extracted data from Sarah/Engineer
});

// Transcript audio chunks - chunked audio files for progressive upload
export const transcriptAudioChunks = pgTable("transcript_audio_chunks", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .references(() => transcriptSessions.id)
    .notNull(),
  index: integer("index").notNull(), // order of chunk
  startOffsetSeconds: numeric("start_offset_seconds", { precision: 10, scale: 2 }).notNull(),
  durationSeconds: numeric("duration_seconds", { precision: 10, scale: 2 }),
  storagePath: text("storage_path").notNull(), // where the audio file lives
  sttStatus: varchar("stt_status", { length: 50 }).default("pending").notNull(), // pending, processing, done, error
  transcriptText: text("transcript_text"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Transcript segments - cleaned, punctuated text with timestamps
export const transcriptSegments = pgTable("transcript_segments", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .references(() => transcriptSessions.id)
    .notNull(),
  // Option A ingestion sequence number (monotonic per session)
  // Nullable to preserve legacy chunk-based segments which do not have seq.
  seq: integer("seq"),
  // Option A timestamps (milliseconds)
  startMs: integer("start_ms"),
  endMs: integer("end_ms"),
  // Legacy chunk-based ingestion
  chunkId: integer("chunk_id").references(() => transcriptAudioChunks.id),
  startSeconds: numeric("start_seconds", { precision: 10, scale: 2 }).notNull(),
  endSeconds: numeric("end_seconds", { precision: 10, scale: 2 }).notNull(),
  speaker: varchar("speaker", { length: 100 }).default("engineer").notNull(),
  text: text("text").notNull(),
  roomTag: varchar("room_tag", { length: 100 }),
  topicTag: varchar("topic_tag", { length: 100 }),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  // Unique seq constraint for Option A segments (partial: only when seq is present)
  sessionSeqUnique: uniqueIndex("transcript_segments_session_seq_uq")
    .on(t.sessionId, t.seq)
    .where(sql`${t.seq} is not null`),
  sessionSeqIdx: index("transcript_segments_session_seq_idx")
    .on(t.sessionId, t.seq),
}));

// Transcript aggregates - optional rollup for fast polling + full text
export const transcriptAggregates = pgTable("transcript_aggregates", {
  sessionId: integer("session_id")
    .references(() => transcriptSessions.id, { onDelete: "cascade" })
    .primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
  fullText: text("full_text").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================
// User File System
// ============================================

// Files - user-uploaded files (photos, documents, exports, etc.)
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  visitId: integer("visit_id")
    .references(() => visitSessions.id), // nullable - not all files are visit-related
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: integer("size").notNull(), // file size in bytes
  storagePath: text("storage_path").notNull(), // path on disk
  category: varchar("category", { length: 50 }).default("other"), // photos, quotes, exports, other
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Photos - postcode-based property photos (PR14)
export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  addressId: uuid("address_id")
    .references(() => addresses.id, { onDelete: "set null" }), // NEW: link to addresses
  postcode: varchar("postcode", { length: 20 }).notNull(), // postcode anchor for property (kept for backward compat)
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: integer("size").notNull(), // file size in bytes
  width: integer("width"), // image width in pixels
  height: integer("height"), // image height in pixels
  storagePath: text("storage_path").notNull(), // path on disk or URL
  notes: text("notes"), // user notes/description
  tag: varchar("tag", { length: 100 }), // e.g. boiler, flue, meter, rads, cylinder, consumer_unit
  latitude: numeric("latitude", { precision: 10, scale: 7 }), // GPS latitude
  longitude: numeric("longitude", { precision: 10, scale: 7 }), // GPS longitude
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Scans - postcode-based scan sessions (PR15 - LiDAR placeholder)
export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  addressId: uuid("address_id")
    .references(() => addresses.id, { onDelete: "set null" }), // NEW: link to addresses
  postcode: varchar("postcode", { length: 20 }).notNull(), // postcode anchor for property (kept for backward compat)
  kind: varchar("kind", { length: 50 }).default("lidar").notNull(), // lidar, photogrammetry, other
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: integer("size").notNull(), // file size in bytes
  storagePath: text("storage_path").notNull(), // path on disk
  deviceId: varchar("device_id", { length: 255 }), // e.g. iPhone model
  notes: text("notes"), // user notes/description
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================
// Addresses & Appointments System
// ============================================

// Addresses - property addresses with permission-based access
export const addresses = pgTable("addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdByUserId: integer("created_by_user_id")
    .references(() => users.id)
    .notNull(),
  assignedUserId: integer("assigned_user_id")
    .references(() => users.id), // nullable - admin can assign, defaults to creator
  line1: varchar("line1", { length: 255 }).notNull(),
  line2: varchar("line2", { length: 255 }),
  town: varchar("town", { length: 100 }),
  county: varchar("county", { length: 100 }),
  postcode: varchar("postcode", { length: 20 }).notNull(),
  country: varchar("country", { length: 100 }).default("United Kingdom").notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  notes: text("notes"), // address-level summary/rollup
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  postcodeIdx: index("addresses_postcode_idx").on(t.postcode),
  createdByUserIdx: index("addresses_created_by_user_idx").on(t.createdByUserId),
  assignedUserIdx: index("addresses_assigned_user_idx").on(t.assignedUserId),
}));

// AddressAppointments - child of Address, supports multiple types per address
export const addressAppointments = pgTable("address_appointments", {
  id: uuid("id").defaultRandom().primaryKey(),
  addressId: uuid("address_id")
    .references(() => addresses.id, { onDelete: "cascade" })
    .notNull(),
  type: varchar("type", { length: 50 }).notNull(), // SURVEY, REVISIT, CALLBACK, INSTALL, SERVICE_REPAIR
  status: varchar("status", { length: 50 }).default("PLANNED").notNull(), // PLANNED, CONFIRMED, COMPLETED, CANCELLED
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }),
  createdByUserId: integer("created_by_user_id")
    .references(() => users.id)
    .notNull(),
  assignedUserId: integer("assigned_user_id")
    .references(() => users.id), // nullable - for team scheduling
  notesRichText: text("notes_rich_text"), // aggregated/concatenated notes view
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  addressIdIdx: index("address_appointments_address_id_idx").on(t.addressId),
  startAtIdx: index("address_appointments_start_at_idx").on(t.startAt),
  typeIdx: index("address_appointments_type_idx").on(t.type),
  statusIdx: index("address_appointments_status_idx").on(t.status),
  assignedUserIdx: index("address_appointments_assigned_user_idx").on(t.assignedUserId),
}));

// AppointmentNoteEntries - append-only log of notes from various sources
export const appointmentNoteEntries = pgTable("appointment_note_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  appointmentId: uuid("appointment_id")
    .references(() => addressAppointments.id, { onDelete: "cascade" })
    .notNull(),
  sourceType: varchar("source_type", { length: 50 }).notNull(), // TRANSCRIPT_FILE, TEXT_PASTE, FILE_UPLOAD, MANUAL_NOTE
  sourceName: varchar("source_name", { length: 255 }), // filename / label
  rawText: text("raw_text"), // original content
  parsedJson: jsonb("parsed_json"), // structured parsed data
  renderedNote: text("rendered_note").notNull(), // what appears in notes aggregation
  createdByUserId: integer("created_by_user_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  appointmentIdCreatedAtIdx: index("appointment_note_entries_appt_created_idx").on(t.appointmentId, t.createdAt),
}));

// FileUploads - files attached to appointments
export const appointmentFiles = pgTable("appointment_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  appointmentId: uuid("appointment_id")
    .references(() => addressAppointments.id, { onDelete: "cascade" })
    .notNull(),
  addressId: uuid("address_id")
    .references(() => addresses.id, { onDelete: "cascade" }), // optional back-reference
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  createdByUserId: integer("created_by_user_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  appointmentIdIdx: index("appointment_files_appointment_id_idx").on(t.appointmentId),
}));

// UserSettings - per-user preferences (including dock customization)
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  dockModules: jsonb("dock_modules"), // array of module IDs for bottom dock
  preferences: jsonb("preferences"), // other user preferences
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================
// Media Receiver: Assets + Visit Events
// ============================================

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(),
  visitId: integer("visit_id")
    .references(() => visitSessions.id)
    .notNull(),
  kind: varchar("kind", { length: 20 }).notNull(), // audio|image|text|model|other
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  ext: varchar("ext", { length: 20 }).notNull(),
  bytes: bigint("bytes", { mode: "number" }),
  sha256: text("sha256"),
  storageProvider: text("storage_provider").notNull().default("local"),
  storageKey: text("storage_key").notNull(),
  originalFilename: text("original_filename"),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  deviceId: varchar("device_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  leadVisitCreatedAtIdx: index("assets_lead_visit_created_at_idx").on(t.leadId, t.visitId, t.createdAt),
  visitCreatedAtIdx: index("assets_visit_created_at_idx").on(t.visitId, t.createdAt),
  sha256Idx: index("assets_sha256_idx").on(t.sha256),
}));

export const visitEvents = pgTable("visit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(),
  visitId: integer("visit_id")
    .references(() => visitSessions.id)
    .notNull(),
  type: text("type").notNull(), // e.g. 'asset.imported'
  seq: integer("seq"),
  payload: jsonb("payload").notNull().default({}),
  deviceId: varchar("device_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  leadVisitCreatedAtIdx: index("visit_events_lead_visit_created_at_idx").on(t.leadId, t.visitId, t.createdAt),
  visitCreatedAtIdx: index("visit_events_visit_created_at_idx").on(t.visitId, t.createdAt),
}));

// ============================================
// PR12: Customer Presentation + Admin Media Library
// ============================================

export const presentationAssets = pgTable("presentation_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(), // 'image' | 'video' (enforced by DB check)
  title: text("title").notNull(),
  description: text("description"),
  tags: text("tags").array(),
  url: text("url").notNull(),
  thumbUrl: text("thumb_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  createdAtIdx: index("presentation_assets_created_at_idx").on(t.createdAt),
  // tags gin index exists in SQL migration; drizzle doesn't currently model gin here.
}));

export const presentationDrafts = pgTable("presentation_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  visitId: uuid("visit_id")
    .references(() => spineVisits.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull().default("Customer Pack"),
  sections: jsonb("sections").notNull().default([]),
  selectedPhotoEventIds: uuid("selected_photo_event_ids").array().notNull().default(sql`'{}'::uuid[]`),
  selectedAssetIds: uuid("selected_asset_ids").array().notNull().default(sql`'{}'::uuid[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  visitCreatedAtIdx: index("presentation_drafts_visit_created_at_idx").on(t.visitId, t.createdAt),
}));

// ============================================
// v2 Spine: Property / Visit / Timeline
// ============================================

export const spineProperties = pgTable("spine_properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  town: text("town"),
  // Stored normalized (uppercase, no spaces) for fast indexed lookup
  postcode: text("postcode").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  postcodeIdx: index("spine_properties_postcode_idx").on(t.postcode),
}));

export const spineVisits = pgTable("spine_visits", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .references(() => spineProperties.id, { onDelete: "cascade" })
    .notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  propertyStartedAtIdx: index("spine_visits_property_started_at_idx").on(t.propertyId, t.startedAt),
}));

export const spineTimelineEvents = pgTable("spine_timeline_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  visitId: uuid("visit_id")
    .references(() => spineVisits.id, { onDelete: "cascade" })
    .notNull(),
  // Optional external id for idempotent ingest (e.g. companion resend)
  externalId: text("external_id"),
  type: text("type").notNull(),
  ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
  payload: jsonb("payload").notNull().default({}),
  geo: jsonb("geo"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  tsIdx: index("spine_timeline_events_ts_idx").on(t.ts),
  visitTsIdx: index("spine_timeline_events_visit_ts_idx").on(t.visitId, t.ts),
  externalIdUnique: uniqueIndex("spine_timeline_events_external_id_uq")
    .on(t.externalId)
    .where(sql`${t.externalId} is not null`),
}));

// ============================================
// Survey Helper System - SystemSpecDraft
// ============================================

// System spec drafts - stores the evolving spec during a survey
export const systemSpecDrafts = pgTable("system_spec_drafts", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .references(() => transcriptSessions.id)
    .notNull()
    .unique(),
  activeModules: jsonb("active_modules").notNull().$type<string[]>(), // ['core', 'central_heating', 'heat_pump', etc.]
  specData: jsonb("spec_data").notNull(), // The full SystemSpecDraft JSON
  askedSlotIds: jsonb("asked_slot_ids").notNull().$type<string[]>(), // Slots already asked
  currentTopic: varchar("current_topic", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================
// Lead Workspace - Normalized Data Model
// ============================================

// Lead contacts (1:1) - separated contact info from core lead
export const leadContacts = pgTable("lead_contacts", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull()
    .unique(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  city: varchar("city", { length: 255 }),
  postcode: varchar("postcode", { length: 20 }),
  country: varchar("country", { length: 100 }).default("UK"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Lead occupancy (1:1) - who lives there, schedule, priorities
export const leadOccupancy = pgTable("lead_occupancy", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull()
    .unique(),
  occupants: integer("occupants"),
  schedule: text("schedule"), // e.g. "Work from home", "Out 9-5"
  priorities: text("priorities"), // structured notes about what matters to them
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Properties (1:1 per lead for MVP)
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull()
    .unique(),
  type: varchar("type", { length: 100 }), // detached, semi, terraced, flat, bungalow
  ageBand: varchar("age_band", { length: 100 }), // pre-1919, 1919-1944, 1945-1964, etc.
  construction: jsonb("construction"), // { walls: "cavity", roof: "pitched", floors: "suspended" }
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Property floorplans (0..n)
export const propertyFloorplans = pgTable("property_floorplans", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(),
  fileId: integer("file_id").references(() => files.id),
  label: varchar("label", { length: 255 }), // "Ground Floor", "First Floor"
  scale: varchar("scale", { length: 100 }), // e.g. "1:50"
  metadata: jsonb("metadata"), // any additional data
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Lead photos (0..n) - photos specific to a lead/property
export const leadPhotos = pgTable("lead_photos", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(),
  fileId: integer("file_id").references(() => files.id),
  category: varchar("category", { length: 100 }), // "boiler", "cylinder", "property", "other"
  caption: text("caption"),
  takenAt: timestamp("taken_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Lead heat loss (1:1) - whole house heat loss calculation
export const leadHeatloss = pgTable("lead_heatloss", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull()
    .unique(),
  wholeHouseW: integer("whole_house_w"), // Total heat loss in watts
  method: varchar("method", { length: 100 }), // "MCS", "room-by-room", "estimate"
  assumptions: text("assumptions"), // Notes about calculation assumptions
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Lead technologies (0..n) - existing equipment at property
export const leadTechnologies = pgTable("lead_technologies", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(),
  type: varchar("type", { length: 100 }).notNull(), // boiler, cylinder, pv, battery, ev_charger, etc.
  make: varchar("make", { length: 255 }),
  model: varchar("model", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Lead interests (0..n) - what the customer is interested in
export const leadInterests = pgTable("lead_interests", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(),
  category: varchar("category", { length: 100 }).notNull(), // heat_pump, solar, battery, insulation, etc.
  value: varchar("value", { length: 255 }), // optional specific value/detail
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Lead future plans (0..n) - customer's future intentions
export const leadFuturePlans = pgTable("lead_future_plans", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(),
  planType: varchar("plan_type", { length: 100 }).notNull(), // extension, loft_conversion, etc.
  timeframe: varchar("timeframe", { length: 100 }), // "next_year", "2-5_years", etc.
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Recommendations (0..n) - system recommendations for customer
export const recommendations = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(),
  option: varchar("option", { length: 10 }).notNull(), // A, B, C
  summary: text("summary").notNull(),
  rationale: text("rationale"), // why this option
  dependencies: text("dependencies"), // what needs to happen first
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================
// Rocky & Sarah - Voice Notes Architecture
// ============================================

// Voice Notes - Refactored to use Rocky/Sarah architecture
// Natural Notes: verbatim transcript (editable)
// Automatic Notes: Rocky-generated structured notes
// Engineer Basics: Rocky-generated fixed format
// RockyFacts: Versioned JSON contract
export const voiceNotes = pgTable("voice_notes", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .references(() => transcriptSessions.id)
    .notNull()
    .unique(),
  
  // Natural Notes (verbatim, editable)
  naturalNotesRaw: text("natural_notes_raw").notNull(), // Original transcript
  naturalNotesEdited: text("natural_notes_edited"), // User-edited version
  naturalNotesHash: varchar("natural_notes_hash", { length: 64 }).notNull(), // SHA-256 hash for auditability
  
  // Rocky Outputs
  rockyFactsVersion: varchar("rocky_facts_version", { length: 20 }).notNull(), // e.g., "1.0.0"
  rockyFacts: jsonb("rocky_facts").notNull(), // RockyFactsV1 JSON
  automaticNotes: jsonb("automatic_notes").notNull(), // AutomaticNotes JSON
  engineerBasics: jsonb("engineer_basics").notNull(), // EngineerBasics JSON
  
  // Processing metadata
  rockyProcessedAt: timestamp("rocky_processed_at", { withTimezone: true }).notNull(),
  rockyProcessingTimeMs: integer("rocky_processing_time_ms"),
  
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Sarah Explanations - Generated on-demand from RockyFacts
export const sarahExplanations = pgTable("sarah_explanations", {
  id: serial("id").primaryKey(),
  voiceNoteId: integer("voice_note_id")
    .references(() => voiceNotes.id)
    .notNull(),
  
  // Request parameters
  audience: varchar("audience", { length: 50 }).notNull(), // customer, engineer, surveyor, manager, admin
  tone: varchar("tone", { length: 50 }).notNull(), // professional, friendly, technical, simple, urgent
  
  // Sarah output
  explanation: jsonb("explanation").notNull(), // SarahExplanation JSON
  rockyFactsVersion: varchar("rocky_facts_version", { length: 20 }).notNull(), // Version of facts used
  
  // Processing metadata
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
  processingTimeMs: integer("processing_time_ms"),
  
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================
// Knowledge Ingest System (PDF → Citations)
// ============================================

// Knowledge documents - uploaded PDF manuals, guides, compliance docs
export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  source: varchar("source", { length: 100 }).default("upload").notNull(), // upload, manual, scraped
  tags: jsonb("tags"), // array of tags for categorization
  manufacturer: varchar("manufacturer", { length: 255 }), // e.g. Worcester, Vaillant
  modelRange: varchar("model_range", { length: 255 }), // e.g. 4000 series
  documentType: varchar("document_type", { length: 100 }), // manual, installation_guide, compliance_doc
  originalFilePath: text("original_file_path"), // path to original PDF file
  pageCount: integer("page_count"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Knowledge pages - individual pages from documents with extracted text
export const knowledgePages = pgTable("knowledge_pages", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .references(() => knowledgeDocuments.id, { onDelete: "cascade" })
    .notNull(),
  pageNumber: integer("page_number").notNull(),
  text: text("text"), // extracted text from page
  imagePath: text("image_path"), // path to page image (PNG/JPEG)
  imageUrl: text("image_url"), // public URL to page image
  hasText: boolean("has_text").default(false), // whether native text was extracted
  isOcred: boolean("is_ocred").default(false), // whether OCR was performed
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Knowledge chunks - text chunks with embeddings for semantic search
export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .references(() => knowledgeDocuments.id, { onDelete: "cascade" })
    .notNull(),
  pageNumber: integer("page_number").notNull(),
  chunkIndex: integer("chunk_index").notNull(), // sequence within page
  text: text("text").notNull(), // chunk content
  embedding: jsonb("embedding"), // vector embedding (stored as JSON array for now, migrate to pgvector later)
  metadata: jsonb("metadata"), // { section: "Flue", model: "Worcester 4000", ... }
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================
// System Recommendations (for leads)
// ============================================

// Lead system recommendations - persisted system recommendation outputs
export const leadSystemRecommendations = pgTable("lead_system_recommendations", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id)
    .notNull(),
  rulesetVersion: varchar("ruleset_version", { length: 20 }).notNull(), // version of recommendation logic used
  inputJson: jsonb("input_json").notNull(), // SystemRecInput data
  outputJson: jsonb("output_json").notNull(), // SystemRecOutput data
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdByUserId: integer("created_by_user_id")
    .references(() => users.id), // nullable - may be from API or UI
});

// ============================================
// Heat Loss Surveys - Physics-First Approach
// ============================================

// Heat loss surveys - comprehensive physics-based heat loss surveys
export const heatLossSurveys = pgTable("heat_loss_surveys", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  surveyorId: integer("surveyor_id")
    .references(() => users.id),
  surveyDate: timestamp("survey_date", { withTimezone: true }).notNull(),
  // Main survey data stored as JSONB (full HeatLossSurvey schema)
  surveyData: jsonb("survey_data").notNull(),
  // Denormalized fields for quick queries
  wholeHouseHeatLossW: integer("whole_house_heat_loss_w"),
  wholeHouseHeatLossKw: numeric("whole_house_heat_loss_kw", { precision: 10, scale: 2 }),
  recommendedBoilerSizeKw: numeric("recommended_boiler_size_kw", { precision: 10, scale: 2 }),
  calculationMethod: varchar("calculation_method", { length: 50 }), // MCS, room_by_room, whole_house_estimate
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  leadIdIdx: index("heat_loss_surveys_lead_id_idx").on(t.leadId),
  surveyorIdIdx: index("heat_loss_surveys_surveyor_id_idx").on(t.surveyorId),
  surveyDateIdx: index("heat_loss_surveys_survey_date_idx").on(t.surveyDate),
}));

// ============================================
// Trajectory Engine - Carbon/Cost Projections
// ============================================

// Assumptions snapshots - monthly energy prices, grid intensity, policy flags
export const assumptionsSnapshots = pgTable("assumptions_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  regionCode: varchar("region_code", { length: 20 }).notNull(), // e.g. "UK-GB"
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(), // month bucket start
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(), // month bucket end
  electricityUnitPPerKwh: numeric("electricity_unit_p_per_kwh", { precision: 10, scale: 2 }).notNull(),
  electricityOffpeakPPerKwh: numeric("electricity_offpeak_p_per_kwh", { precision: 10, scale: 2 }),
  gasUnitPPerKwh: numeric("gas_unit_p_per_kwh", { precision: 10, scale: 2 }).notNull(),
  elecStandingChargePPerDay: numeric("elec_standing_charge_p_per_day", { precision: 10, scale: 2 }),
  gasStandingChargePPerDay: numeric("gas_standing_charge_p_per_day", { precision: 10, scale: 2 }),
  gridIntensityGco2ePerKwh: numeric("grid_intensity_gco2e_per_kwh", { precision: 10, scale: 2 }).notNull(),
  gasIntensityGco2ePerKwh: numeric("gas_intensity_gco2e_per_kwh", { precision: 10, scale: 2 }).notNull(),
  policyFlags: jsonb("policy_flags"), // { "BUS_available": true, "BUS_grant_gbp": 7500, ... }
  sourceMeta: jsonb("source_meta"), // provenance, urls, etc
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  regionPeriodIdx: index("assumptions_snapshots_region_period_idx").on(t.regionCode, t.periodStart),
}));

// Property models - heat loss & fabric characteristics
export const propertyModels = pgTable("property_models", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id), // nullable - can exist without lead
  propertyId: integer("property_id")
    .references(() => properties.id), // nullable - can exist without property
  modelVersion: integer("model_version").notNull().default(1),
  floorAreaM2: numeric("floor_area_m2", { precision: 10, scale: 2 }),
  ageBand: varchar("age_band", { length: 100 }), // pre-1919, 1919-1944, etc.
  construction: jsonb("construction"), // wall/roof/floor/windows U-values or category
  infiltrationAch: numeric("infiltration_ach", { precision: 5, scale: 2 }), // air changes per hour
  zones: jsonb("zones"), // array of zone objects with heat_loss_w_per_k
  defaultSetpoints: jsonb("default_setpoints"), // { living: 21, bedrooms: 18 }
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  leadIdIdx: index("property_models_lead_id_idx").on(t.leadId),
}));

// Occupancy profiles - who's home when, comfort priorities
export const occupancyProfiles = pgTable("occupancy_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id), // nullable
  propertyId: integer("property_id")
    .references(() => properties.id), // nullable
  preset: varchar("preset", { length: 50 }).notNull(), // "WFH", "9to5_out", "shift", "always_home"
  schedule: jsonb("schedule"), // hourly or blocks
  internalGainsW: numeric("internal_gains_w", { precision: 10, scale: 2 }),
  comfortPriority: varchar("comfort_priority", { length: 50 }).default("balanced"), // "comfort", "balanced", "saver"
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  leadIdIdx: index("occupancy_profiles_lead_id_idx").on(t.leadId),
}));

// DHW profiles - hot water usage patterns
export const dhwProfiles = pgTable("dhw_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id), // nullable
  propertyId: integer("property_id")
    .references(() => properties.id), // nullable
  occupants: integer("occupants").notNull(),
  showersPerDay: numeric("showers_per_day", { precision: 5, scale: 2 }).notNull(),
  bathsPerWeek: numeric("baths_per_week", { precision: 5, scale: 2 }).notNull(),
  targetTempC: numeric("target_temp_c", { precision: 5, scale: 2 }).default("50").notNull(),
  coldInletTempC: numeric("cold_inlet_temp_c", { precision: 5, scale: 2 }),
  mixergyEnabled: boolean("mixergy_enabled").default(false).notNull(),
  mixergyStrategy: jsonb("mixergy_strategy"), // { "topup_temp":45, "offpeak_window":"00:30-04:30" }
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  leadIdIdx: index("dhw_profiles_lead_id_idx").on(t.leadId),
}));

// Scenarios - tech stack + control strategy combinations
export const scenarios = pgTable("scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id), // nullable
  propertyId: integer("property_id")
    .references(() => properties.id), // nullable
  name: varchar("name", { length: 255 }).notNull(),
  techStack: jsonb("tech_stack").notNull(), // { space_heat: [...], dhw: [...], cooling: {...} }
  controlStrategy: jsonb("control_strategy").notNull(), // lockout temps, zoning, priority, etc
  capex: jsonb("capex"), // { "low": 3500, "mid": 5200, "high": 7800 }
  disruptionScore: integer("disruption_score"), // 1-5
  assumptionsOverrides: jsonb("assumptions_overrides"), // optional per-scenario overrides
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  leadIdIdx: index("scenarios_lead_id_idx").on(t.leadId),
}));

// Journeys - staged retrofit paths over time
export const journeys = pgTable("journeys", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: integer("lead_id")
    .references(() => leads.id), // nullable
  propertyId: integer("property_id")
    .references(() => properties.id), // nullable
  name: varchar("name", { length: 255 }).notNull(),
  steps: jsonb("steps").notNull(), // [ { step:1, scenario_id:"uuid-a", start_date:"2026-02-01" }, ... ]
  reportPins: jsonb("report_pins"), // { "assumptions_snapshot_id": "...", "grid_decarb_path": "central" }
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  leadIdIdx: index("journeys_lead_id_idx").on(t.leadId),
}));
