-- Migration: Add photos and scans tables
-- Date: 2026-01-01
-- Description: Create missing photos and scans tables for media management

-- Photos table - property photos with metadata
CREATE TABLE IF NOT EXISTS "photos" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "address_id" UUID REFERENCES "addresses"("id") ON DELETE SET NULL,
  "postcode" VARCHAR(20) NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "storage_path" TEXT NOT NULL,
  "notes" TEXT,
  "tag" VARCHAR(100),
  "latitude" NUMERIC(10, 7),
  "longitude" NUMERIC(10, 7),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Scans table - LiDAR and photogrammetry scans
CREATE TABLE IF NOT EXISTS "scans" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "address_id" UUID REFERENCES "addresses"("id") ON DELETE SET NULL,
  "postcode" VARCHAR(20) NOT NULL,
  "kind" VARCHAR(50) DEFAULT 'lidar' NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "storage_path" TEXT NOT NULL,
  "device_id" VARCHAR(255),
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "photos_user_id_idx" ON "photos"("user_id");
CREATE INDEX IF NOT EXISTS "photos_address_id_idx" ON "photos"("address_id");
CREATE INDEX IF NOT EXISTS "photos_postcode_idx" ON "photos"("postcode");
CREATE INDEX IF NOT EXISTS "scans_user_id_idx" ON "scans"("user_id");
CREATE INDEX IF NOT EXISTS "scans_address_id_idx" ON "scans"("address_id");
CREATE INDEX IF NOT EXISTS "scans_postcode_idx" ON "scans"("postcode");
