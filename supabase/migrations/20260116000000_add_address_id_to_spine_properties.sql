-- Migration: Link spine_properties to canonical addresses table
-- This unifies the address system across all modules (engineer, camera, diary, etc.)
-- Date: 2026-01-16

-- Add addressId column to spine_properties with foreign key to addresses
ALTER TABLE spine_properties
ADD COLUMN address_id UUID REFERENCES addresses(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS spine_properties_address_id_idx ON spine_properties(address_id);

-- Note: Existing spine_properties records will have NULL address_id
-- A separate data migration can be run to match and link existing records if needed
