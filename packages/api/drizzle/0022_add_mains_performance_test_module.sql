-- Migration: Add mains performance test module for Atlas
-- This adds tables for capturing static/dynamic pressure, flow rate, and temperature
-- under controlled load conditions during property surveys

-- Main test entity
CREATE TABLE IF NOT EXISTS "mains_performance_tests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" integer NOT NULL REFERENCES "properties"("id"),
  "survey_id" integer REFERENCES "survey_instances"("id"),
  "source_point" text,
  "ambient_temp_c" numeric(5, 2),
  "weather_conditions" text,
  "time_of_day" varchar(20),
  "water_utility_company" text,
  "postcode" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" integer NOT NULL REFERENCES "users"("id"),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Test devices/equipment
CREATE TABLE IF NOT EXISTS "mains_test_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "test_id" uuid NOT NULL REFERENCES "mains_performance_tests"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "location" text,
  "sensor_type" text DEFAULT 'manual' NOT NULL,
  "calibration_profile_id" uuid,
  "notes" text
);

-- Test steps/sequence
CREATE TABLE IF NOT EXISTS "mains_test_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "test_id" uuid NOT NULL REFERENCES "mains_performance_tests"("id") ON DELETE CASCADE,
  "index" integer NOT NULL,
  "label" text,
  "outlet_count" integer,
  "valve_state" text,
  "duration_seconds" integer,
  "target_flow_lpm" numeric(10, 2),
  "started_at" timestamp with time zone,
  "stabilized_at" timestamp with time zone,
  "notes" text
);

-- Individual observations/measurements
CREATE TABLE IF NOT EXISTS "mains_test_observations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "test_id" uuid NOT NULL REFERENCES "mains_performance_tests"("id"),
  "step_id" uuid NOT NULL REFERENCES "mains_test_steps"("id") ON DELETE CASCADE,
  "device_id" uuid NOT NULL REFERENCES "mains_test_devices"("id") ON DELETE CASCADE,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  "pressure_bar" numeric(10, 3),
  "flow_lpm" numeric(10, 2),
  "water_temp_c" numeric(5, 2),
  "quality_flags" jsonb DEFAULT '[]'::jsonb,
  "method" text DEFAULT 'manual' NOT NULL,
  "entered_by" integer REFERENCES "users"("id")
);

-- Computed analysis results
CREATE TABLE IF NOT EXISTS "mains_test_analyses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "test_id" uuid NOT NULL UNIQUE REFERENCES "mains_performance_tests"("id"),
  "analysis_version" text NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "static_pressure_bar" numeric(10, 3),
  "dynamic_pressure_at_steps" jsonb,
  "max_flow_observed_lpm" numeric(10, 2),
  "pressure_drop_per_outlet" numeric(10, 3),
  "supply_curve_points" jsonb,
  "risk_flags" jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "mains_performance_tests_property_id_idx" ON "mains_performance_tests" ("property_id");
CREATE INDEX IF NOT EXISTS "mains_performance_tests_survey_id_idx" ON "mains_performance_tests" ("survey_id");
CREATE INDEX IF NOT EXISTS "mains_performance_tests_created_by_idx" ON "mains_performance_tests" ("created_by");
CREATE INDEX IF NOT EXISTS "mains_test_devices_test_id_idx" ON "mains_test_devices" ("test_id");
CREATE INDEX IF NOT EXISTS "mains_test_steps_test_id_idx" ON "mains_test_steps" ("test_id");
CREATE INDEX IF NOT EXISTS "mains_test_steps_test_id_index_idx" ON "mains_test_steps" ("test_id", "index");
CREATE INDEX IF NOT EXISTS "mains_test_observations_test_id_idx" ON "mains_test_observations" ("test_id");
CREATE INDEX IF NOT EXISTS "mains_test_observations_step_id_idx" ON "mains_test_observations" ("step_id");
CREATE INDEX IF NOT EXISTS "mains_test_observations_device_id_idx" ON "mains_test_observations" ("device_id");
CREATE INDEX IF NOT EXISTS "mains_test_analyses_test_id_idx" ON "mains_test_analyses" ("test_id");

-- Comments for documentation
COMMENT ON TABLE "mains_performance_tests" IS 'Mains performance tests capturing static/dynamic pressure, flow rate, and temperature under controlled load conditions';
COMMENT ON TABLE "mains_test_devices" IS 'Test equipment/sensors used during mains performance tests';
COMMENT ON TABLE "mains_test_steps" IS 'Sequence of test steps with different valve states and outlet configurations';
COMMENT ON TABLE "mains_test_observations" IS 'Individual measurements at each step/device combination';
COMMENT ON TABLE "mains_test_analyses" IS 'Computed analysis results and cached calculations for mains tests';
