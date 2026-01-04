-- ============================================
-- Enable Row Level Security for Addresses and Related Tables
--
-- This migration enables RLS on the addresses, address_appointments,
-- appointment_note_entries, appointment_files, and user_settings tables
-- that were created via Drizzle migrations.
-- ============================================

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_note_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Default RLS policies (allow all for now)
-- These should be updated when more granular permissions are needed
-- ============================================
CREATE POLICY "Allow all operations on addresses" ON addresses FOR ALL USING (true);
CREATE POLICY "Allow all operations on address_appointments" ON address_appointments FOR ALL USING (true);
CREATE POLICY "Allow all operations on appointment_note_entries" ON appointment_note_entries FOR ALL USING (true);
CREATE POLICY "Allow all operations on appointment_files" ON appointment_files FOR ALL USING (true);
CREATE POLICY "Allow all operations on user_settings" ON user_settings FOR ALL USING (true);
