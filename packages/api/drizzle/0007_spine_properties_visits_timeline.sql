-- v2 spine foundation: properties, visits, timeline events
-- Notes:
-- - We use new tables to avoid clashing with existing "properties" (lead workspace).
-- - UUID ids with pgcrypto gen_random_uuid()

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "spine_properties" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "address_line_1" TEXT NOT NULL,
  "address_line_2" TEXT,
  "town" TEXT,
  -- Stored normalized (uppercase, no spaces) for fast indexed lookup
  "postcode" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "spine_properties_postcode_idx"
  ON "spine_properties" ("postcode");

CREATE TABLE IF NOT EXISTS "spine_visits" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" UUID NOT NULL REFERENCES "spine_properties"("id") ON DELETE CASCADE,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ended_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "spine_visits_property_started_at_idx"
  ON "spine_visits" ("property_id", "started_at");

CREATE TABLE IF NOT EXISTS "spine_timeline_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "visit_id" UUID NOT NULL REFERENCES "spine_visits"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "ts" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { lat, lng, accuracy, timestamp }
  "geo" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "spine_timeline_events_ts_idx"
  ON "spine_timeline_events" ("ts");

CREATE INDEX IF NOT EXISTS "spine_timeline_events_visit_ts_idx"
  ON "spine_timeline_events" ("visit_id", "ts");

