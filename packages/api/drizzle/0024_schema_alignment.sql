-- Migration 0024: Schema alignment fixes
-- Resolves discrepancies between Drizzle schema definitions and actual database state.
--
-- Changes:
-- 1. Add address_id to spine_properties (was in Drizzle schema but missing from initial migration 0007)
-- 2. Add thumbnail_url, full_url, visit_id to photos (required for photo persistence per ALIGNMENT_CHECKLIST)
-- 3. Make assets.lead_id nullable (address-only workflow support; migration 0023 missed this table)
-- 4. Make visit_events.lead_id nullable (address-only workflow support; migration 0023 missed this table)
-- 5. Add address_id to assets (Golden Path: address as primary anchor)
-- 6. Add user_id, account_id to mains_performance_tests (present in Drizzle schema but missing from migration 0022)
-- 7. Create mains_test_analyses table if not already present (was in migration 0022 SQL but verify idempotent)

-- ============================================================
-- 1. spine_properties: add address_id (idempotent - supabase migration may have already run)
-- ============================================================
ALTER TABLE "spine_properties"
  ADD COLUMN IF NOT EXISTS "address_id" UUID REFERENCES "addresses"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "spine_properties_address_id_idx"
  ON "spine_properties" ("address_id");

-- ============================================================
-- 2. photos: add thumbnail_url, full_url, visit_id
-- ============================================================
ALTER TABLE "photos"
  ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT,
  ADD COLUMN IF NOT EXISTS "full_url" TEXT,
  ADD COLUMN IF NOT EXISTS "visit_id" INTEGER REFERENCES "visit_sessions"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "photos_visit_id_idx" ON "photos" ("visit_id");

-- ============================================================
-- 3. assets: make lead_id nullable
-- ============================================================
ALTER TABLE "assets" ALTER COLUMN "lead_id" DROP NOT NULL;

COMMENT ON COLUMN "assets"."lead_id" IS 'LEGACY ONLY - nullable per migration 0024. New workflows anchor to address_id.';

-- ============================================================
-- 4. visit_events: make lead_id nullable
-- ============================================================
ALTER TABLE "visit_events" ALTER COLUMN "lead_id" DROP NOT NULL;

COMMENT ON COLUMN "visit_events"."lead_id" IS 'LEGACY ONLY - nullable per migration 0024. New workflows anchor to address_id.';

-- ============================================================
-- 5. assets: add address_id for Golden Path address anchoring
-- ============================================================
ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "address_id" UUID REFERENCES "addresses"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "assets_address_id_idx" ON "assets" ("address_id");

-- ============================================================
-- 6. mains_performance_tests: add user_id and account_id
--    (present in Drizzle schema / route code but missing from migration 0022)
-- ============================================================
ALTER TABLE "mains_performance_tests"
  ADD COLUMN IF NOT EXISTS "user_id" INTEGER REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "account_id" INTEGER REFERENCES "accounts"("id");

CREATE INDEX IF NOT EXISTS "mains_performance_tests_user_id_idx"
  ON "mains_performance_tests" ("user_id");

-- ============================================================
-- 7. mains_test_analyses: ensure table exists (was in migration 0022, idempotent)
-- ============================================================
CREATE TABLE IF NOT EXISTS "mains_test_analyses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "test_id" UUID NOT NULL UNIQUE REFERENCES "mains_performance_tests"("id") ON DELETE CASCADE,
  "analysis_version" TEXT NOT NULL,
  "computed_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "static_pressure_bar" NUMERIC(10, 3),
  "dynamic_pressure_at_steps" JSONB,
  "max_flow_observed_lpm" NUMERIC(10, 2),
  "pressure_drop_per_outlet" NUMERIC(10, 3),
  "supply_curve_points" JSONB,
  "risk_flags" JSONB
);

CREATE INDEX IF NOT EXISTS "mains_test_analyses_test_id_idx"
  ON "mains_test_analyses" ("test_id");
