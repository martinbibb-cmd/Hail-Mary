-- ============================================
-- Hail-Mary: Unify Customer and Lead Tables
--
-- This migration transforms Lead into the single source of truth
-- by merging customer contact information into the leads table
-- and updating all foreign key references.
--
-- Migration Date: 2024-12-13
-- ============================================

BEGIN;

-- ============================================
-- PHASE 1: Extend leads table with customer fields
-- ============================================

-- Add customer contact fields to leads
ALTER TABLE leads
  ADD COLUMN first_name VARCHAR(255),
  ADD COLUMN last_name VARCHAR(255),
  ADD COLUMN email VARCHAR(255),
  ADD COLUMN phone VARCHAR(50),
  ADD COLUMN address_line_1 VARCHAR(255),
  ADD COLUMN address_line_2 VARCHAR(255),
  ADD COLUMN city VARCHAR(255),
  ADD COLUMN postcode VARCHAR(20),
  ADD COLUMN country VARCHAR(100) DEFAULT 'UK';

-- Add lead-specific fields that were in types but not in DB
ALTER TABLE leads
  ADD COLUMN description TEXT,
  ADD COLUMN property_type VARCHAR(100),
  ADD COLUMN estimated_value DECIMAL(10, 2);

-- Add updated_at timestamp
ALTER TABLE leads
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create trigger for updated_at
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PHASE 2: Migrate customer data to leads
-- ============================================

-- Copy customer data to existing leads with customer_id
UPDATE leads l
SET
  first_name = c.first_name,
  last_name = c.last_name,
  email = c.email,
  phone = c.phone,
  address_line_1 = c.address_line_1,
  address_line_2 = c.address_line_2,
  city = c.city,
  postcode = c.postcode,
  country = c.country,
  notes = COALESCE(l.notes, '') ||
          CASE WHEN c.notes IS NOT NULL AND c.notes != ''
          THEN E'\n\nCustomer Notes:\n' || c.notes
          ELSE '' END,
  updated_at = NOW()
FROM customers c
WHERE l.customer_id = c.id;

-- Create new leads for customers that don't have a lead
-- (customers without any lead records)
INSERT INTO leads (
  account_id,
  customer_id,
  first_name,
  last_name,
  email,
  phone,
  address_line_1,
  address_line_2,
  city,
  postcode,
  country,
  source,
  status,
  notes,
  created_at,
  updated_at
)
SELECT
  c.account_id,
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.address_line_1,
  c.address_line_2,
  c.city,
  c.postcode,
  c.country,
  'existing_customer', -- source
  'contacted', -- status (existing customers are already contacted)
  c.notes,
  c.created_at,
  NOW()
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM leads l WHERE l.customer_id = c.id
);

-- ============================================
-- PHASE 3: Add lead_id to dependent tables
-- ============================================

-- Add lead_id to quotes
ALTER TABLE quotes ADD COLUMN new_lead_id INTEGER REFERENCES leads(id);
UPDATE quotes SET new_lead_id = lead_id WHERE lead_id IS NOT NULL;
-- For quotes with customer_id but no lead_id, find the lead
UPDATE quotes q
SET new_lead_id = l.id
FROM leads l
WHERE q.customer_id = l.customer_id
  AND q.new_lead_id IS NULL
  AND l.customer_id IS NOT NULL;

-- Add lead_id to appointments
ALTER TABLE appointments ADD COLUMN new_lead_id INTEGER REFERENCES leads(id);
-- Find lead for each appointment via customer_id
UPDATE appointments a
SET new_lead_id = l.id
FROM leads l
WHERE a.customer_id = l.customer_id
  AND l.customer_id IS NOT NULL;

-- Add lead_id to visit_sessions
ALTER TABLE visit_sessions ADD COLUMN new_lead_id INTEGER REFERENCES leads(id);
UPDATE visit_sessions vs
SET new_lead_id = l.id
FROM leads l
WHERE vs.customer_id = l.customer_id
  AND l.customer_id IS NOT NULL;

-- Add lead_id to media_attachments
ALTER TABLE media_attachments ADD COLUMN new_lead_id INTEGER REFERENCES leads(id);
UPDATE media_attachments ma
SET new_lead_id = l.id
FROM leads l
WHERE ma.customer_id = l.customer_id
  AND l.customer_id IS NOT NULL;

-- Add lead_id to survey_instances
ALTER TABLE survey_instances ADD COLUMN new_lead_id INTEGER REFERENCES leads(id);
UPDATE survey_instances si
SET new_lead_id = l.id
FROM leads l
WHERE si.customer_id = l.customer_id
  AND l.customer_id IS NOT NULL;

-- Add lead_id to visit_observations
ALTER TABLE visit_observations ADD COLUMN new_lead_id INTEGER REFERENCES leads(id);
UPDATE visit_observations vo
SET new_lead_id = l.id
FROM leads l
WHERE vo.customer_id = l.customer_id
  AND l.customer_id IS NOT NULL;

-- Update transcript_sessions (already has lead_id, just ensure it's populated)
UPDATE transcript_sessions ts
SET lead_id = l.id
FROM leads l
WHERE ts.customer_id = l.customer_id
  AND ts.lead_id IS NULL
  AND l.customer_id IS NOT NULL;

-- ============================================
-- PHASE 4: Switch to lead_id as primary reference
-- ============================================

-- Quotes: Drop old lead_id and customer_id, rename new_lead_id
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_lead_id_fkey;
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_customer_id_fkey;
ALTER TABLE quotes DROP COLUMN lead_id;
ALTER TABLE quotes DROP COLUMN customer_id;
ALTER TABLE quotes RENAME COLUMN new_lead_id TO lead_id;
ALTER TABLE quotes ALTER COLUMN lead_id SET NOT NULL;
CREATE INDEX idx_quotes_lead_id ON quotes(lead_id);

-- Appointments: Drop customer_id, rename new_lead_id
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_customer_id_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_quote_id_fkey;
ALTER TABLE appointments DROP COLUMN customer_id;
ALTER TABLE appointments RENAME COLUMN new_lead_id TO lead_id;
ALTER TABLE appointments ALTER COLUMN lead_id SET NOT NULL;
DROP INDEX IF EXISTS idx_appointments_customer_id;
CREATE INDEX idx_appointments_lead_id ON appointments(lead_id);

-- Visit sessions: Drop customer_id, rename new_lead_id
ALTER TABLE visit_sessions DROP CONSTRAINT IF EXISTS visit_sessions_customer_id_fkey;
ALTER TABLE visit_sessions DROP COLUMN customer_id;
ALTER TABLE visit_sessions RENAME COLUMN new_lead_id TO lead_id;
ALTER TABLE visit_sessions ALTER COLUMN lead_id SET NOT NULL;
CREATE INDEX idx_visit_sessions_lead_id ON visit_sessions(lead_id);

-- Media attachments: Drop customer_id, rename new_lead_id
ALTER TABLE media_attachments DROP CONSTRAINT IF EXISTS media_attachments_customer_id_fkey;
ALTER TABLE media_attachments DROP COLUMN customer_id;
ALTER TABLE media_attachments RENAME COLUMN new_lead_id TO lead_id;
ALTER TABLE media_attachments ALTER COLUMN lead_id SET NOT NULL;
CREATE INDEX idx_media_attachments_lead_id ON media_attachments(lead_id);

-- Survey instances: Drop customer_id, rename new_lead_id
ALTER TABLE survey_instances DROP CONSTRAINT IF EXISTS survey_instances_customer_id_fkey;
ALTER TABLE survey_instances DROP COLUMN customer_id;
ALTER TABLE survey_instances RENAME COLUMN new_lead_id TO lead_id;
ALTER TABLE survey_instances ALTER COLUMN lead_id SET NOT NULL;
CREATE INDEX idx_survey_instances_lead_id ON survey_instances(lead_id);

-- Visit observations: Drop customer_id, rename new_lead_id
ALTER TABLE visit_observations DROP CONSTRAINT IF EXISTS visit_observations_customer_id_fkey;
ALTER TABLE visit_observations DROP COLUMN customer_id;
ALTER TABLE visit_observations RENAME COLUMN new_lead_id TO lead_id;
ALTER TABLE visit_observations ALTER COLUMN lead_id SET NOT NULL;
CREATE INDEX idx_visit_observations_lead_id ON visit_observations(lead_id);

-- Transcript sessions: Drop customer_id (keep lead_id)
ALTER TABLE transcript_sessions DROP CONSTRAINT IF EXISTS transcript_sessions_customer_id_fkey;
ALTER TABLE transcript_sessions DROP COLUMN customer_id;

-- ============================================
-- PHASE 5: Update leads table constraints
-- ============================================

-- Make first_name and last_name required
ALTER TABLE leads ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE leads ALTER COLUMN last_name SET NOT NULL;

-- Drop customer_id foreign key and column from leads
DROP INDEX IF EXISTS idx_leads_customer_id;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_customer_id_fkey;
ALTER TABLE leads DROP COLUMN customer_id;

-- ============================================
-- PHASE 6: Drop customers table
-- ============================================

-- Drop RLS policies
DROP POLICY IF EXISTS "Allow all operations on customers" ON customers;

-- Drop triggers
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;

-- Drop indexes
DROP INDEX IF EXISTS idx_customers_account_id;

-- Drop the table
DROP TABLE IF EXISTS customers CASCADE;

-- ============================================
-- PHASE 7: Update RLS policies for quotes
-- ============================================

-- Recreate quote policies (they were dropped with CASCADE)
DROP POLICY IF EXISTS "Allow all operations on quotes" ON quotes;
CREATE POLICY "Allow all operations on quotes" ON quotes FOR ALL USING (true);

COMMIT;
