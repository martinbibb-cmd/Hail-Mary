-- Enable Row Level Security for Addresses and Related Tables

-- Enable RLS on addresses and related tables
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "address_appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_note_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;

-- Create permissive policies that allow all operations
-- These policies can be refined later for more granular access control
CREATE POLICY "Allow all operations on addresses" ON "addresses" FOR ALL USING (true);
CREATE POLICY "Allow all operations on address_appointments" ON "address_appointments" FOR ALL USING (true);
CREATE POLICY "Allow all operations on appointment_note_entries" ON "appointment_note_entries" FOR ALL USING (true);
CREATE POLICY "Allow all operations on appointment_files" ON "appointment_files" FOR ALL USING (true);
CREATE POLICY "Allow all operations on user_settings" ON "user_settings" FOR ALL USING (true);
