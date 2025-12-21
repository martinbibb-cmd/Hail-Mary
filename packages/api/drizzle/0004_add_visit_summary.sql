-- Migration: Add visit summary field
-- Description: Adds summary field to visit_sessions table for AI-generated visit summaries

-- Add summary column to visit_sessions table
ALTER TABLE "visit_sessions" ADD COLUMN "summary" TEXT;

-- Add index for searching visits with summaries
CREATE INDEX IF NOT EXISTS "idx_visit_sessions_summary" ON "visit_sessions"("id") WHERE "summary" IS NOT NULL;
