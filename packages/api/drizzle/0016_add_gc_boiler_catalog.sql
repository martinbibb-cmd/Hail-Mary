-- Migration: Add GC Boiler Catalog System
-- Description: Adds tables for GC-based boiler truth layer, including catalog, sources, enrichment queue, and aliases

-- Boiler GC catalog - canonical boiler facts keyed by GC number
CREATE TABLE IF NOT EXISTS "boiler_gc_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gc_number" text UNIQUE NOT NULL,
  "manufacturer" text,
  "brand" text,
  "model" text,
  "variant" text,
  "boiler_type" varchar(50),
  "fuel" varchar(50),
  "ch_output_kw_nominal" numeric(10, 2),
  "dhw_output_kw_nominal" numeric(10, 2),
  "modulation_min_kw" numeric(10, 2),
  "modulation_max_kw" numeric(10, 2),
  "erp_efficiency_percent" numeric(5, 2),
  "erp_class" text,
  "pump_overrun_required" boolean,
  "permanent_live_required" boolean,
  "overrun_handled_by" varchar(50),
  "typical_fuse_a" integer,
  "controls_supported" jsonb,
  "internal_pump_present" boolean,
  "internal_diverter_present" boolean,
  "plate_hex_present" boolean,
  "expansion_vessel_present" boolean,
  "height_mm" integer,
  "width_mm" integer,
  "depth_mm" integer,
  "weight_kg" numeric(10, 2),
  "flue_diameter_mm" integer,
  "max_flue_length_m" numeric(10, 2),
  "plume_kit_compatible" boolean,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" varchar(50) DEFAULT 'active' NOT NULL,
  "quality_score" numeric(3, 2),
  "notes" text
);

-- Boiler GC sources - provenance tracking
CREATE TABLE IF NOT EXISTS "boiler_gc_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gc_catalog_id" uuid NOT NULL,
  "source_type" varchar(50) NOT NULL,
  "source_ref" text,
  "extracted_by" varchar(50) NOT NULL,
  "extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "fields_covered" jsonb,
  "confidence" numeric(3, 2),
  "raw_snippet" text,
  "checksum" text
);

-- Boiler GC enrichment queue - missing GC workflow
CREATE TABLE IF NOT EXISTS "boiler_gc_enrichment_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gc_number" text NOT NULL,
  "requested_by_user_id" integer,
  "requested_from_lead_id" integer,
  "context" jsonb,
  "status" varchar(50) DEFAULT 'pending' NOT NULL,
  "search_attempts" integer DEFAULT 0 NOT NULL,
  "last_search_at" timestamp with time zone,
  "candidates" jsonb,
  "chosen_candidate" jsonb,
  "reviewer_user_id" integer,
  "reviewer_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Boiler GC aliases - handle formatting variants
CREATE TABLE IF NOT EXISTS "boiler_gc_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gc_number_canonical" text NOT NULL,
  "alias" text UNIQUE NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "boiler_gc_sources" ADD CONSTRAINT "boiler_gc_sources_gc_catalog_id_fkey" 
  FOREIGN KEY ("gc_catalog_id") REFERENCES "boiler_gc_catalog"("id") ON DELETE cascade;

ALTER TABLE "boiler_gc_enrichment_queue" ADD CONSTRAINT "boiler_gc_enrichment_queue_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id");

ALTER TABLE "boiler_gc_enrichment_queue" ADD CONSTRAINT "boiler_gc_enrichment_queue_requested_from_lead_id_fkey"
  FOREIGN KEY ("requested_from_lead_id") REFERENCES "leads"("id");

ALTER TABLE "boiler_gc_enrichment_queue" ADD CONSTRAINT "boiler_gc_enrichment_queue_reviewer_user_id_fkey"
  FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id");

ALTER TABLE "boiler_gc_aliases" ADD CONSTRAINT "boiler_gc_aliases_gc_number_canonical_fkey"
  FOREIGN KEY ("gc_number_canonical") REFERENCES "boiler_gc_catalog"("gc_number") ON DELETE cascade;

-- Create indexes
CREATE INDEX IF NOT EXISTS "boiler_gc_catalog_gc_number_idx" ON "boiler_gc_catalog"("gc_number");
CREATE INDEX IF NOT EXISTS "boiler_gc_catalog_manufacturer_idx" ON "boiler_gc_catalog"("manufacturer");

CREATE INDEX IF NOT EXISTS "boiler_gc_sources_gc_catalog_id_idx" ON "boiler_gc_sources"("gc_catalog_id");

CREATE INDEX IF NOT EXISTS "boiler_gc_enrichment_queue_gc_number_idx" ON "boiler_gc_enrichment_queue"("gc_number");
CREATE INDEX IF NOT EXISTS "boiler_gc_enrichment_queue_status_idx" ON "boiler_gc_enrichment_queue"("status");
CREATE INDEX IF NOT EXISTS "boiler_gc_enrichment_queue_created_at_idx" ON "boiler_gc_enrichment_queue"("created_at");

CREATE INDEX IF NOT EXISTS "boiler_gc_aliases_canonical_idx" ON "boiler_gc_aliases"("gc_number_canonical");
CREATE INDEX IF NOT EXISTS "boiler_gc_aliases_alias_idx" ON "boiler_gc_aliases"("alias");
