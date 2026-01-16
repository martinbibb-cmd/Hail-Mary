-- Migration: Make leadId optional in visit_sessions and media_attachments
-- This allows the new address/property/visit workflow to work without leads

-- Make leadId nullable in visit_sessions
ALTER TABLE visit_sessions ALTER COLUMN lead_id DROP NOT NULL;

-- Make leadId nullable in media_attachments
ALTER TABLE media_attachments ALTER COLUMN lead_id DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN visit_sessions.lead_id IS 'LEGACY ONLY - Optional for backwards compatibility. New workflows use spine_visits instead.';
COMMENT ON COLUMN media_attachments.lead_id IS 'LEGACY ONLY - Optional for backwards compatibility. Link via visitSessionId or use spine_timeline_events instead.';
