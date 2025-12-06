-- Drizzle ORM Initial Migration for Hail-Mary
-- PostgreSQL database schema

-- accounts / tenancies
CREATE TABLE IF NOT EXISTS "accounts" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- users (people using the system)
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "account_id" INTEGER REFERENCES "accounts"("id"),
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "name" VARCHAR(255) NOT NULL,
  "password_hash" TEXT,
  "auth_provider" VARCHAR(50) DEFAULT 'local' NOT NULL,
  "external_id" VARCHAR(255),
  "role" VARCHAR(50) DEFAULT 'user' NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- password reset tokens for local auth password recovery
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
  "token" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "used_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- customers (households / people you quote for)
CREATE TABLE IF NOT EXISTS "customers" (
  "id" SERIAL PRIMARY KEY,
  "account_id" INTEGER REFERENCES "accounts"("id") NOT NULL,
  "first_name" VARCHAR(255) NOT NULL,
  "last_name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255),
  "phone" VARCHAR(50),
  "address_line_1" VARCHAR(255),
  "address_line_2" VARCHAR(255),
  "city" VARCHAR(255),
  "postcode" VARCHAR(20),
  "country" VARCHAR(100) DEFAULT 'UK',
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- leads (raw inbound interest)
CREATE TABLE IF NOT EXISTS "leads" (
  "id" SERIAL PRIMARY KEY,
  "account_id" INTEGER REFERENCES "accounts"("id") NOT NULL,
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "source" VARCHAR(100),
  "status" VARCHAR(50) DEFAULT 'new' NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- products (boilers, cylinders, filters, controls, etc.)
CREATE TABLE IF NOT EXISTS "products" (
  "id" SERIAL PRIMARY KEY,
  "account_id" INTEGER REFERENCES "accounts"("id") NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "base_price" NUMERIC(10, 2) NOT NULL,
  "is_active" BOOLEAN DEFAULT TRUE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- quotes (header)
CREATE TABLE IF NOT EXISTS "quotes" (
  "id" SERIAL PRIMARY KEY,
  "account_id" INTEGER REFERENCES "accounts"("id") NOT NULL,
  "customer_id" INTEGER REFERENCES "customers"("id") NOT NULL,
  "lead_id" INTEGER REFERENCES "leads"("id"),
  "status" VARCHAR(50) DEFAULT 'draft' NOT NULL,
  "title" VARCHAR(255),
  "valid_until" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- quote lines (line items)
CREATE TABLE IF NOT EXISTS "quote_lines" (
  "id" SERIAL PRIMARY KEY,
  "quote_id" INTEGER REFERENCES "quotes"("id") NOT NULL,
  "product_id" INTEGER REFERENCES "products"("id"),
  "description" TEXT NOT NULL,
  "quantity" INTEGER DEFAULT 1 NOT NULL,
  "unit_price" NUMERIC(10, 2) NOT NULL,
  "discount" NUMERIC(10, 2) DEFAULT '0' NOT NULL,
  "line_total" NUMERIC(10, 2) NOT NULL
);

-- appointments - scheduled visits, surveys, installations
CREATE TABLE IF NOT EXISTS "appointments" (
  "id" SERIAL PRIMARY KEY,
  "account_id" INTEGER REFERENCES "accounts"("id") NOT NULL,
  "customer_id" INTEGER REFERENCES "customers"("id") NOT NULL,
  "quote_id" INTEGER REFERENCES "quotes"("id"),
  "type" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) DEFAULT 'scheduled' NOT NULL,
  "scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "duration" INTEGER DEFAULT 60 NOT NULL,
  "address_line_1" VARCHAR(255),
  "address_line_2" VARCHAR(255),
  "city" VARCHAR(255),
  "postcode" VARCHAR(20),
  "country" VARCHAR(100) DEFAULT 'UK',
  "notes" TEXT,
  "assigned_to" VARCHAR(255),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- visit sessions - tracks a single site visit for a customer
CREATE TABLE IF NOT EXISTS "visit_sessions" (
  "id" SERIAL PRIMARY KEY,
  "account_id" INTEGER REFERENCES "accounts"("id") NOT NULL,
  "customer_id" INTEGER REFERENCES "customers"("id") NOT NULL,
  "started_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "ended_at" TIMESTAMP WITH TIME ZONE,
  "status" VARCHAR(50) DEFAULT 'in_progress' NOT NULL
);

-- media attachments - photos, videos, measurement screenshots
CREATE TABLE IF NOT EXISTS "media_attachments" (
  "id" SERIAL PRIMARY KEY,
  "visit_session_id" INTEGER REFERENCES "visit_sessions"("id") NOT NULL,
  "customer_id" INTEGER REFERENCES "customers"("id") NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "url" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- survey templates - user-designed survey structures
CREATE TABLE IF NOT EXISTS "survey_templates" (
  "id" SERIAL PRIMARY KEY,
  "account_id" INTEGER REFERENCES "accounts"("id") NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "schema" JSONB NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- survey instances - a specific survey for a specific visit
CREATE TABLE IF NOT EXISTS "survey_instances" (
  "id" SERIAL PRIMARY KEY,
  "template_id" INTEGER REFERENCES "survey_templates"("id") NOT NULL,
  "visit_session_id" INTEGER REFERENCES "visit_sessions"("id") NOT NULL,
  "customer_id" INTEGER REFERENCES "customers"("id") NOT NULL,
  "status" VARCHAR(50) DEFAULT 'in_progress' NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- survey answers - individual answers to survey questions
CREATE TABLE IF NOT EXISTS "survey_answers" (
  "id" SERIAL PRIMARY KEY,
  "instance_id" INTEGER REFERENCES "survey_instances"("id") NOT NULL,
  "question_id" VARCHAR(255) NOT NULL,
  "value" JSONB,
  "source" VARCHAR(50) NOT NULL,
  "raw_text" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- visit observations - raw observations from STT during a visit
CREATE TABLE IF NOT EXISTS "visit_observations" (
  "id" SERIAL PRIMARY KEY,
  "visit_session_id" INTEGER REFERENCES "visit_sessions"("id") NOT NULL,
  "customer_id" INTEGER REFERENCES "customers"("id") NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- transcript sessions - one survey visit -> one primary transcript session
CREATE TABLE IF NOT EXISTS "transcript_sessions" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER REFERENCES "leads"("id"),
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "status" VARCHAR(50) DEFAULT 'recording' NOT NULL,
  "duration_seconds" INTEGER,
  "language" VARCHAR(20) DEFAULT 'en-GB' NOT NULL,
  "notes" TEXT
);

-- transcript audio chunks - chunked audio files for progressive upload
CREATE TABLE IF NOT EXISTS "transcript_audio_chunks" (
  "id" SERIAL PRIMARY KEY,
  "session_id" INTEGER REFERENCES "transcript_sessions"("id") NOT NULL,
  "index" INTEGER NOT NULL,
  "start_offset_seconds" NUMERIC(10, 2) NOT NULL,
  "duration_seconds" NUMERIC(10, 2),
  "storage_path" TEXT NOT NULL,
  "stt_status" VARCHAR(50) DEFAULT 'pending' NOT NULL,
  "transcript_text" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- transcript segments - cleaned, punctuated text with timestamps
CREATE TABLE IF NOT EXISTS "transcript_segments" (
  "id" SERIAL PRIMARY KEY,
  "session_id" INTEGER REFERENCES "transcript_sessions"("id") NOT NULL,
  "chunk_id" INTEGER REFERENCES "transcript_audio_chunks"("id") NOT NULL,
  "start_seconds" NUMERIC(10, 2) NOT NULL,
  "end_seconds" NUMERIC(10, 2) NOT NULL,
  "speaker" VARCHAR(100) DEFAULT 'engineer' NOT NULL,
  "text" TEXT NOT NULL,
  "room_tag" VARCHAR(100),
  "topic_tag" VARCHAR(100),
  "confidence" NUMERIC(5, 4),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- files - user-uploaded files (photos, documents, exports, etc.)
CREATE TABLE IF NOT EXISTS "files" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
  "visit_id" INTEGER REFERENCES "visit_sessions"("id"),
  "filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "storage_path" TEXT NOT NULL,
  "category" VARCHAR(50) DEFAULT 'other',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- system spec drafts - stores the evolving spec during a survey
CREATE TABLE IF NOT EXISTS "system_spec_drafts" (
  "id" SERIAL PRIMARY KEY,
  "session_id" INTEGER REFERENCES "transcript_sessions"("id") NOT NULL UNIQUE,
  "active_modules" JSONB NOT NULL,
  "spec_data" JSONB NOT NULL,
  "asked_slot_ids" JSONB NOT NULL,
  "current_topic" VARCHAR(100),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
