-- Migration: Add visit summary field
-- Description: Adds summary field to visit_sessions table for AI-generated visit summaries

-- Add summary column to visit_sessions table
ALTER TABLE "visit_sessions" ADD COLUMN "summary" TEXT;
