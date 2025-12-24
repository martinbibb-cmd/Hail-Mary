-- v2 spine: idempotent ingest support for timeline events
-- Adds optional external_id for de-duplication (e.g. companion resend).

ALTER TABLE "spine_timeline_events"
  ADD COLUMN IF NOT EXISTS "external_id" TEXT;

-- Unique only when external_id is provided
CREATE UNIQUE INDEX IF NOT EXISTS "spine_timeline_events_external_id_uq"
  ON "spine_timeline_events" ("external_id")
  WHERE "external_id" IS NOT NULL;

