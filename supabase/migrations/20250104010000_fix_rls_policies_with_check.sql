-- ============================================
-- Fix RLS Policies to Include WITH CHECK for INSERT Operations
--
-- The previous migration enabled RLS but the policies only had
-- USING (true) which works for SELECT but not INSERT/UPDATE.
-- This migration adds WITH CHECK (true) to allow INSERT operations.
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on addresses" ON addresses;
DROP POLICY IF EXISTS "Allow all operations on address_appointments" ON address_appointments;
DROP POLICY IF EXISTS "Allow all operations on appointment_note_entries" ON appointment_note_entries;
DROP POLICY IF EXISTS "Allow all operations on appointment_files" ON appointment_files;
DROP POLICY IF EXISTS "Allow all operations on user_settings" ON user_settings;

-- Create new policies with both USING and WITH CHECK clauses
CREATE POLICY "Allow all operations on addresses" ON addresses
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on address_appointments" ON address_appointments
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on appointment_note_entries" ON appointment_note_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on appointment_files" ON appointment_files
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on user_settings" ON user_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
