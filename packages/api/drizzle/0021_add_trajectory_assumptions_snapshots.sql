-- Migration: Add assumptions_snapshots table for trajectory engine
-- This table stores monthly energy prices, grid intensity, and policy flags
-- for carbon/cost projections in the trajectory engine

CREATE TABLE IF NOT EXISTS "assumptions_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "region_code" varchar(20) NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "electricity_unit_p_per_kwh" numeric(10, 2) NOT NULL,
  "electricity_offpeak_p_per_kwh" numeric(10, 2),
  "gas_unit_p_per_kwh" numeric(10, 2) NOT NULL,
  "elec_standing_charge_p_per_day" numeric(10, 2),
  "gas_standing_charge_p_per_day" numeric(10, 2),
  "grid_intensity_gco2e_per_kwh" numeric(10, 2) NOT NULL,
  "gas_intensity_gco2e_per_kwh" numeric(10, 2) NOT NULL,
  "policy_flags" jsonb,
  "source_meta" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create index for efficient region/period lookups
CREATE INDEX IF NOT EXISTS "assumptions_snapshots_region_period_idx" ON "assumptions_snapshots" ("region_code", "period_start");
