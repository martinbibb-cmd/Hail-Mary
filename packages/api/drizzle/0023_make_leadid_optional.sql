-- Migration: Make leadId optional in visit_sessions, media_attachments, visit_observations, and survey_instances
-- This allows the new address/property/visit workflow to work without leads

-- Make leadId nullable in visit_sessions
ALTER TABLE visit_sessions ALTER COLUMN lead_id DROP NOT NULL;

-- Make leadId nullable in media_attachments
ALTER TABLE media_attachments ALTER COLUMN lead_id DROP NOT NULL;

-- Make leadId nullable in visit_observations
ALTER TABLE visit_observations ALTER COLUMN lead_id DROP NOT NULL;

-- Make leadId nullable in survey_instances
ALTER TABLE survey_instances ALTER COLUMN lead_id DROP NOT NULL;

-- Add comments to document the change
COMMENT ON COLUMN visit_sessions.lead_id IS 'LEGACY ONLY - Optional for backwards compatibility. New workflows use spine_visits instead.';
COMMENT ON COLUMN media_attachments.lead_id IS 'LEGACY ONLY - Optional for backwards compatibility. Link via visitSessionId or use spine_timeline_events instead.';
COMMENT ON COLUMN visit_observations.lead_id IS 'LEGACY ONLY - Optional for backwards compatibility. Link via visitSessionId instead.';
COMMENT ON COLUMN survey_instances.lead_id IS 'LEGACY ONLY - Optional for backwards compatibility. Link via visitSessionId instead.';
