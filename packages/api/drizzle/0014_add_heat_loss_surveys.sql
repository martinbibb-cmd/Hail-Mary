-- Migration: Add heat_loss_surveys table for Physics-First heat loss surveys
-- This table stores comprehensive heat loss survey data combining LiDAR, thermal imaging,
-- boroscope inspections, moisture readings, and manual measurements.

CREATE TABLE IF NOT EXISTS heat_loss_surveys (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  surveyor_id INTEGER REFERENCES users(id),
  survey_date TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Main survey data stored as JSONB (full HeatLossSurvey schema)
  survey_data JSONB NOT NULL,

  -- Denormalized fields for quick queries
  whole_house_heat_loss_w INTEGER,
  whole_house_heat_loss_kw NUMERIC(10, 2),
  recommended_boiler_size_kw NUMERIC(10, 2),
  calculation_method VARCHAR(50), -- MCS, room_by_room, whole_house_estimate

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX heat_loss_surveys_lead_id_idx ON heat_loss_surveys(lead_id);
CREATE INDEX heat_loss_surveys_surveyor_id_idx ON heat_loss_surveys(surveyor_id);
CREATE INDEX heat_loss_surveys_survey_date_idx ON heat_loss_surveys(survey_date);

-- GIN index for JSONB queries
CREATE INDEX heat_loss_surveys_survey_data_gin_idx ON heat_loss_surveys USING GIN (survey_data);

-- Comments for documentation
COMMENT ON TABLE heat_loss_surveys IS 'Physics-First heat loss surveys combining LiDAR, thermal imaging, boroscope, and moisture measurements';
COMMENT ON COLUMN heat_loss_surveys.survey_data IS 'Full survey data conforming to heat-loss-survey-schema.json';
COMMENT ON COLUMN heat_loss_surveys.whole_house_heat_loss_w IS 'Total heat loss in watts (denormalized for queries)';
COMMENT ON COLUMN heat_loss_surveys.calculation_method IS 'MCS, room_by_room, or whole_house_estimate';
