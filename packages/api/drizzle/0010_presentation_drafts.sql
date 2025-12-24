-- PR12b: Presentation drafts (visit-based customer packs)

CREATE TABLE IF NOT EXISTS "presentation_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "visit_id" uuid NOT NULL REFERENCES "spine_visits" ("id") ON DELETE CASCADE,
  "title" text NOT NULL DEFAULT 'Customer Pack',
  "sections" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "selected_photo_event_ids" uuid[] NOT NULL DEFAULT '{}'::uuid[],
  "selected_asset_ids" uuid[] NOT NULL DEFAULT '{}'::uuid[],
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "presentation_drafts_visit_created_at_idx"
  ON "presentation_drafts" ("visit_id", "created_at" DESC);

