-- Migration: Add System Recommendations table
-- Description: Adds persistence for system recommendation outputs per lead

-- Lead system recommendations - persisted system recommendation outputs
CREATE TABLE IF NOT EXISTS "lead_system_recommendations" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL REFERENCES "leads"("id"),
  "ruleset_version" VARCHAR(20) NOT NULL,
  "input_json" JSONB NOT NULL,
  "output_json" JSONB NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "created_by_user_id" INTEGER REFERENCES "users"("id")
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_lead_system_recommendations_lead_id" ON "lead_system_recommendations"("lead_id");
CREATE INDEX IF NOT EXISTS "idx_lead_system_recommendations_lead_id_created_at" ON "lead_system_recommendations"("lead_id", "created_at" DESC);
