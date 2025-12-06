-- ============================================
-- Hail-Mary Transcription Schema for Supabase (PostgreSQL)
-- 
-- Migration to add transcription system tables for voice-first workflow.
-- Matches drizzle-schema.ts transcription tables.
-- ============================================

-- ============================================
-- Transcript Sessions Table
-- One survey visit -> one primary transcript session
-- ============================================
CREATE TABLE IF NOT EXISTS transcript_sessions (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id),
  customer_id INTEGER REFERENCES customers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(50) NOT NULL DEFAULT 'recording', -- recording, processing, completed, error
  duration_seconds INTEGER,
  language VARCHAR(20) NOT NULL DEFAULT 'en-GB',
  notes TEXT
);

-- ============================================
-- Transcript Audio Chunks Table
-- Chunked audio files for progressive upload
-- ============================================
CREATE TABLE IF NOT EXISTS transcript_audio_chunks (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES transcript_sessions(id),
  index INTEGER NOT NULL,
  start_offset_seconds DECIMAL(10, 2) NOT NULL,
  duration_seconds DECIMAL(10, 2),
  storage_path TEXT NOT NULL,
  stt_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, done, error
  transcript_text TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Transcript Segments Table
-- Cleaned, punctuated text with timestamps
-- ============================================
CREATE TABLE IF NOT EXISTS transcript_segments (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES transcript_sessions(id),
  chunk_id INTEGER NOT NULL REFERENCES transcript_audio_chunks(id),
  start_seconds DECIMAL(10, 2) NOT NULL,
  end_seconds DECIMAL(10, 2) NOT NULL,
  speaker VARCHAR(100) NOT NULL DEFAULT 'engineer',
  text TEXT NOT NULL,
  room_tag VARCHAR(100),
  topic_tag VARCHAR(100),
  confidence DECIMAL(5, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- System Spec Drafts Table
-- Stores the evolving spec during a survey
-- ============================================
CREATE TABLE IF NOT EXISTS system_spec_drafts (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES transcript_sessions(id) UNIQUE,
  active_modules JSONB NOT NULL,
  spec_data JSONB NOT NULL,
  asked_slot_ids JSONB NOT NULL,
  current_topic VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes for better query performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transcript_sessions_lead_id ON transcript_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_transcript_sessions_customer_id ON transcript_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transcript_sessions_status ON transcript_sessions(status);
CREATE INDEX IF NOT EXISTS idx_transcript_audio_chunks_session_id ON transcript_audio_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_session_id ON transcript_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_chunk_id ON transcript_segments(chunk_id);
CREATE INDEX IF NOT EXISTS idx_system_spec_drafts_session_id ON system_spec_drafts(session_id);

-- ============================================
-- Apply updated_at triggers
-- ============================================
CREATE TRIGGER update_transcript_sessions_updated_at
  BEFORE UPDATE ON transcript_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transcript_audio_chunks_updated_at
  BEFORE UPDATE ON transcript_audio_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transcript_segments_updated_at
  BEFORE UPDATE ON transcript_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_spec_drafts_updated_at
  BEFORE UPDATE ON system_spec_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE transcript_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_audio_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_spec_drafts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Default RLS policies (allow all for now)
-- ============================================
CREATE POLICY "Allow all operations on transcript_sessions" ON transcript_sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations on transcript_audio_chunks" ON transcript_audio_chunks FOR ALL USING (true);
CREATE POLICY "Allow all operations on transcript_segments" ON transcript_segments FOR ALL USING (true);
CREATE POLICY "Allow all operations on system_spec_drafts" ON system_spec_drafts FOR ALL USING (true);
