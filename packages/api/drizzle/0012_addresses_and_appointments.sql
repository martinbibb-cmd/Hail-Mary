-- Add addresses, address_appointments, appointment_note_entries, appointment_files, and user_settings tables

-- Addresses table
CREATE TABLE IF NOT EXISTS "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" integer NOT NULL REFERENCES "users"("id"),
	"assigned_user_id" integer REFERENCES "users"("id"),
	"line1" varchar(255) NOT NULL,
	"line2" varchar(255),
	"town" varchar(100),
	"county" varchar(100),
	"postcode" varchar(20) NOT NULL,
	"country" varchar(100) DEFAULT 'United Kingdom' NOT NULL,
	"customer_name" varchar(255),
	"phone" varchar(50),
	"email" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Address appointments table
CREATE TABLE IF NOT EXISTS "address_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address_id" uuid NOT NULL REFERENCES "addresses"("id") ON DELETE CASCADE,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'PLANNED' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"created_by_user_id" integer NOT NULL REFERENCES "users"("id"),
	"assigned_user_id" integer REFERENCES "users"("id"),
	"notes_rich_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Appointment note entries table
CREATE TABLE IF NOT EXISTS "appointment_note_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL REFERENCES "address_appointments"("id") ON DELETE CASCADE,
	"source_type" varchar(50) NOT NULL,
	"source_name" varchar(255),
	"raw_text" text,
	"parsed_json" jsonb,
	"rendered_note" text NOT NULL,
	"created_by_user_id" integer NOT NULL REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Appointment files table
CREATE TABLE IF NOT EXISTS "appointment_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL REFERENCES "address_appointments"("id") ON DELETE CASCADE,
	"address_id" uuid REFERENCES "addresses"("id") ON DELETE CASCADE,
	"filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"created_by_user_id" integer NOT NULL REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- User settings table
CREATE TABLE IF NOT EXISTS "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE UNIQUE,
	"dock_modules" jsonb,
	"preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "addresses_postcode_idx" ON "addresses" ("postcode");
CREATE INDEX IF NOT EXISTS "addresses_created_by_user_idx" ON "addresses" ("created_by_user_id");
CREATE INDEX IF NOT EXISTS "addresses_assigned_user_idx" ON "addresses" ("assigned_user_id");

CREATE INDEX IF NOT EXISTS "address_appointments_address_id_idx" ON "address_appointments" ("address_id");
CREATE INDEX IF NOT EXISTS "address_appointments_start_at_idx" ON "address_appointments" ("start_at");
CREATE INDEX IF NOT EXISTS "address_appointments_type_idx" ON "address_appointments" ("type");
CREATE INDEX IF NOT EXISTS "address_appointments_status_idx" ON "address_appointments" ("status");
CREATE INDEX IF NOT EXISTS "address_appointments_assigned_user_idx" ON "address_appointments" ("assigned_user_id");

CREATE INDEX IF NOT EXISTS "appointment_note_entries_appt_created_idx" ON "appointment_note_entries" ("appointment_id", "created_at");

CREATE INDEX IF NOT EXISTS "appointment_files_appointment_id_idx" ON "appointment_files" ("appointment_id");
