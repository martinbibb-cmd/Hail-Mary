-- Media Receiver: assets + visit_events (imported media + event log)
-- Requires pgcrypto for gen_random_uuid()

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "assets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "lead_id" INTEGER REFERENCES "leads"("id") NOT NULL,
  "visit_id" INTEGER REFERENCES "visit_sessions"("id") NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "ext" VARCHAR(20) NOT NULL,
  "bytes" BIGINT,
  "sha256" TEXT,
  "storage_provider" TEXT NOT NULL DEFAULT 'local',
  "storage_key" TEXT NOT NULL,
  "original_filename" TEXT,
  "captured_at" TIMESTAMP WITH TIME ZONE,
  "device_id" VARCHAR(255),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "assets_lead_visit_created_at_idx"
  ON "assets" ("lead_id", "visit_id", "created_at");

CREATE INDEX IF NOT EXISTS "assets_visit_created_at_idx"
  ON "assets" ("visit_id", "created_at");

CREATE INDEX IF NOT EXISTS "assets_sha256_idx"
  ON "assets" ("sha256");

CREATE TABLE IF NOT EXISTS "visit_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "lead_id" INTEGER REFERENCES "leads"("id") NOT NULL,
  "visit_id" INTEGER REFERENCES "visit_sessions"("id") NOT NULL,
  "type" TEXT NOT NULL,
  "seq" INTEGER,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "device_id" VARCHAR(255),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "visit_events_lead_visit_created_at_idx"
  ON "visit_events" ("lead_id", "visit_id", "created_at");

CREATE INDEX IF NOT EXISTS "visit_events_visit_created_at_idx"
  ON "visit_events" ("visit_id", "created_at");

