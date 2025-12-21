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
    .notNull(),
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
    .notNull(),
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
  leadId: integer("lead_id").references(() => leads.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  status: varchar("status", { length: 50 }).default("recording").notNull(), // recording, processing, completed, error
  durationSeconds: integer("duration_seconds"),
  language: varchar("language", { length: 20 }).default("en-GB").notNull(),
  notes: text("notes"),
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
  chunkId: integer("chunk_id")
    .references(() => transcriptAudioChunks.id)
    .notNull(),
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
