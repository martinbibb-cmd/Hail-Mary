-- ============================================
-- Hail-Mary Database Schema Extension for Supabase (PostgreSQL)
-- 
-- Migration to add visit sessions, media attachments, and
-- flexible survey templates/instances/answers for voice-first workflow.
-- ============================================

-- ============================================
-- Visit Sessions Table
-- Tracks a single site visit for a customer
-- ============================================
CREATE TABLE IF NOT EXISTS visit_sessions (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress' -- in_progress, completed, cancelled
);

-- ============================================
-- Media Attachments Table
-- Photos, videos, measurement screenshots linked to visits
-- ============================================
CREATE TABLE IF NOT EXISTS media_attachments (
  id SERIAL PRIMARY KEY,
  visit_session_id INTEGER NOT NULL REFERENCES visit_sessions(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  type VARCHAR(50) NOT NULL, -- photo, video, measurement, other
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Survey Templates Table
-- User-designed survey structures (sections + questions)
-- ============================================
CREATE TABLE IF NOT EXISTS survey_templates (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  schema JSONB NOT NULL, -- holds sections and questions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Survey Instances Table
-- A specific survey for a specific visit
-- ============================================
CREATE TABLE IF NOT EXISTS survey_instances (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES survey_templates(id),
  visit_session_id INTEGER NOT NULL REFERENCES visit_sessions(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress', -- in_progress, complete
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Survey Answers Table
-- Individual answers to survey questions
-- ============================================
CREATE TABLE IF NOT EXISTS survey_answers (
  id SERIAL PRIMARY KEY,
  instance_id INTEGER NOT NULL REFERENCES survey_instances(id),
  question_id VARCHAR(255) NOT NULL, -- matches question id from template.schema
  value JSONB, -- actual answer (string/number/bool/array)
  source VARCHAR(50) NOT NULL, -- voice, manual, ai
  raw_text TEXT, -- original phrasing from transcript
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Visit Observations Table
-- Raw observations from STT during a visit
-- ============================================
CREATE TABLE IF NOT EXISTS visit_observations (
  id SERIAL PRIMARY KEY,
  visit_session_id INTEGER NOT NULL REFERENCES visit_sessions(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  text TEXT NOT NULL, -- raw observation from STT
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes for better query performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_visit_sessions_customer_id ON visit_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_visit_sessions_account_id ON visit_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_visit_sessions_status ON visit_sessions(status);
CREATE INDEX IF NOT EXISTS idx_media_attachments_visit_session_id ON media_attachments(visit_session_id);
CREATE INDEX IF NOT EXISTS idx_media_attachments_customer_id ON media_attachments(customer_id);
CREATE INDEX IF NOT EXISTS idx_survey_templates_account_id ON survey_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_survey_instances_template_id ON survey_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_survey_instances_visit_session_id ON survey_instances(visit_session_id);
CREATE INDEX IF NOT EXISTS idx_survey_instances_customer_id ON survey_instances(customer_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_instance_id ON survey_answers(instance_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_question_id ON survey_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_visit_observations_visit_session_id ON visit_observations(visit_session_id);
CREATE INDEX IF NOT EXISTS idx_visit_observations_customer_id ON visit_observations(customer_id);

-- ============================================
-- Trigger function for updated_at (reuse existing if available)
-- ============================================
-- The update_updated_at_column function should already exist from initial migration

-- ============================================
-- Apply updated_at triggers to relevant tables
-- ============================================
CREATE TRIGGER update_survey_templates_updated_at
  BEFORE UPDATE ON survey_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_survey_instances_updated_at
  BEFORE UPDATE ON survey_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Enable Row Level Security (RLS) for new tables
-- ============================================
ALTER TABLE visit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_observations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Default RLS policies (allow all for now)
-- These should be updated when authentication is implemented
-- ============================================
CREATE POLICY "Allow all operations on visit_sessions" ON visit_sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations on media_attachments" ON media_attachments FOR ALL USING (true);
CREATE POLICY "Allow all operations on survey_templates" ON survey_templates FOR ALL USING (true);
CREATE POLICY "Allow all operations on survey_instances" ON survey_instances FOR ALL USING (true);
CREATE POLICY "Allow all operations on survey_answers" ON survey_answers FOR ALL USING (true);
CREATE POLICY "Allow all operations on visit_observations" ON visit_observations FOR ALL USING (true);

-- ============================================
-- Add foreign key to files table for visit_id
-- (files table created in auth_schema migration)
-- ============================================
ALTER TABLE files 
  ADD CONSTRAINT fk_files_visit_sessions 
  FOREIGN KEY (visit_id) REFERENCES visit_sessions(id);
