-- PR12: Customer Presentation + Admin Media Library

CREATE TABLE IF NOT EXISTS "presentation_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "tags" text[],
  "url" text NOT NULL,
  "thumb_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'presentation_assets_kind_chk'
  ) THEN
    ALTER TABLE "presentation_assets"
      ADD CONSTRAINT "presentation_assets_kind_chk"
      CHECK ("kind" IN ('image', 'video'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "presentation_assets_created_at_idx"
  ON "presentation_assets" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "presentation_assets_tags_gin"
  ON "presentation_assets" USING gin ("tags");

