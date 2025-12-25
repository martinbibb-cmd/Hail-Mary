-- Link photos, transcripts, scans, and quotes to addresses
-- Makes addresses the central entity for all property-related data

-- Add address_id to photos (keep postcode for backward compatibility)
ALTER TABLE "photos" ADD COLUMN "address_id" uuid REFERENCES "addresses"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "photos_address_id_idx" ON "photos" ("address_id");

-- Add address_id to transcript_sessions
ALTER TABLE "transcript_sessions" ADD COLUMN "address_id" uuid REFERENCES "addresses"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "transcript_sessions_address_id_idx" ON "transcript_sessions" ("address_id");

-- Add address_id to scans
ALTER TABLE "scans" ADD COLUMN "address_id" uuid REFERENCES "addresses"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "scans_address_id_idx" ON "scans" ("address_id");

-- Add address_id to quotes (keep lead_id for backward compatibility)
ALTER TABLE "quotes" ADD COLUMN "address_id" uuid REFERENCES "addresses"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "quotes_address_id_idx" ON "quotes" ("address_id");

-- Add address_id to visit_sessions
ALTER TABLE "visit_sessions" ADD COLUMN "address_id" uuid REFERENCES "addresses"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "visit_sessions_address_id_idx" ON "visit_sessions" ("address_id");

-- Add address_id to media_attachments
ALTER TABLE "media_attachments" ADD COLUMN "address_id" uuid REFERENCES "addresses"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "media_attachments_address_id_idx" ON "media_attachments" ("address_id");
