-- Option A transcription ingestion (live segments)
-- Adds session metadata + seq-based segment ingestion with idempotent upserts.

-- 1) transcript_sessions: add live ingestion columns
ALTER TABLE "transcript_sessions"
  ADD COLUMN IF NOT EXISTS "source" varchar(100),
  ADD COLUMN IF NOT EXISTS "device_id" varchar(255),
  ADD COLUMN IF NOT EXISTS "started_at" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "ended_at" timestamptz;

-- 2) transcript_segments: add seq + ms timestamps, relax chunk_id for live ingestion
ALTER TABLE "transcript_segments"
  ADD COLUMN IF NOT EXISTS "seq" integer,
  ADD COLUMN IF NOT EXISTS "start_ms" integer,
  ADD COLUMN IF NOT EXISTS "end_ms" integer;

ALTER TABLE "transcript_segments"
  ALTER COLUMN "chunk_id" DROP NOT NULL;

-- 3) Unique seq per session (partial: only when seq IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "transcript_segments_session_seq_uq"
  ON "transcript_segments" ("session_id", "seq")
  WHERE "seq" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "transcript_segments_session_seq_idx"
  ON "transcript_segments" ("session_id", "seq")
  WHERE "seq" IS NOT NULL;

-- 4) Optional aggregate table for fast reads / full transcript
CREATE TABLE IF NOT EXISTS "transcript_aggregates" (
  "session_id" integer PRIMARY KEY REFERENCES "transcript_sessions"("id") ON DELETE CASCADE,
  "last_seq" integer NOT NULL DEFAULT 0,
  "full_text" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

