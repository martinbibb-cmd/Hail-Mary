-- Migration: Add Lead Workspace normalized tables
-- Date: 2025-12-16
-- Description: Create normalized tables for lead workspace (contacts, occupancy, property, photos, etc.)

-- Lead contacts (1:1) - separated contact info from core lead
CREATE TABLE IF NOT EXISTS "lead_contacts" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL UNIQUE REFERENCES "leads"("id"),
  "name" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(50),
  "email" VARCHAR(255),
  "address_line_1" VARCHAR(255),
  "address_line_2" VARCHAR(255),
  "city" VARCHAR(255),
  "postcode" VARCHAR(20),
  "country" VARCHAR(100) DEFAULT 'UK',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Lead occupancy (1:1) - who lives there, schedule, priorities
CREATE TABLE IF NOT EXISTS "lead_occupancy" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL UNIQUE REFERENCES "leads"("id"),
  "occupants" INTEGER,
  "schedule" TEXT,
  "priorities" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Properties (1:1 per lead for MVP)
CREATE TABLE IF NOT EXISTS "properties" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL UNIQUE REFERENCES "leads"("id"),
  "type" VARCHAR(100),
  "age_band" VARCHAR(100),
  "construction" JSONB,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Property floorplans (0..n)
CREATE TABLE IF NOT EXISTS "property_floorplans" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL REFERENCES "leads"("id"),
  "file_id" INTEGER REFERENCES "files"("id"),
  "label" VARCHAR(255),
  "scale" VARCHAR(100),
  "metadata" JSONB,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Lead photos (0..n) - photos specific to a lead/property
CREATE TABLE IF NOT EXISTS "lead_photos" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL REFERENCES "leads"("id"),
  "file_id" INTEGER REFERENCES "files"("id"),
  "category" VARCHAR(100),
  "caption" TEXT,
  "taken_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Lead heat loss (1:1) - whole house heat loss calculation
CREATE TABLE IF NOT EXISTS "lead_heatloss" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL UNIQUE REFERENCES "leads"("id"),
  "whole_house_w" INTEGER,
  "method" VARCHAR(100),
  "assumptions" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Lead technologies (0..n) - existing equipment at property
CREATE TABLE IF NOT EXISTS "lead_technologies" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL REFERENCES "leads"("id"),
  "type" VARCHAR(100) NOT NULL,
  "make" VARCHAR(255),
  "model" VARCHAR(255),
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Lead interests (0..n) - what the customer is interested in
CREATE TABLE IF NOT EXISTS "lead_interests" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL REFERENCES "leads"("id"),
  "category" VARCHAR(100) NOT NULL,
  "value" VARCHAR(255),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Lead future plans (0..n) - customer's future intentions
CREATE TABLE IF NOT EXISTS "lead_future_plans" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL REFERENCES "leads"("id"),
  "plan_type" VARCHAR(100) NOT NULL,
  "timeframe" VARCHAR(100),
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Recommendations (0..n) - system recommendations for customer
CREATE TABLE IF NOT EXISTS "recommendations" (
  "id" SERIAL PRIMARY KEY,
  "lead_id" INTEGER NOT NULL REFERENCES "leads"("id"),
  "option" VARCHAR(10) NOT NULL,
  "summary" TEXT NOT NULL,
  "rationale" TEXT,
  "dependencies" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "lead_contacts_lead_id_idx" ON "lead_contacts"("lead_id");
CREATE INDEX IF NOT EXISTS "lead_occupancy_lead_id_idx" ON "lead_occupancy"("lead_id");
CREATE INDEX IF NOT EXISTS "properties_lead_id_idx" ON "properties"("lead_id");
CREATE INDEX IF NOT EXISTS "property_floorplans_lead_id_idx" ON "property_floorplans"("lead_id");
CREATE INDEX IF NOT EXISTS "lead_photos_lead_id_idx" ON "lead_photos"("lead_id");
CREATE INDEX IF NOT EXISTS "lead_heatloss_lead_id_idx" ON "lead_heatloss"("lead_id");
CREATE INDEX IF NOT EXISTS "lead_technologies_lead_id_idx" ON "lead_technologies"("lead_id");
CREATE INDEX IF NOT EXISTS "lead_interests_lead_id_idx" ON "lead_interests"("lead_id");
CREATE INDEX IF NOT EXISTS "lead_future_plans_lead_id_idx" ON "lead_future_plans"("lead_id");
CREATE INDEX IF NOT EXISTS "recommendations_lead_id_idx" ON "recommendations"("lead_id");
