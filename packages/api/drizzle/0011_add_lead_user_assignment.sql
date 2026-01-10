-- Add user assignment column to leads table for access control
-- This allows admins to assign specific leads/addresses to specific users
-- Users can only see and work on leads assigned to them (admins can see all)

-- Make this migration idempotent by checking if column exists
DO $$
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'assigned_user_id'
  ) THEN
    ALTER TABLE "leads"
    ADD COLUMN "assigned_user_id" INTEGER REFERENCES "users"("id");
    RAISE NOTICE 'Added column assigned_user_id to leads table';
  ELSE
    RAISE NOTICE 'Column assigned_user_id already exists, skipping';
  END IF;
END $$;

-- Add index for faster filtering by assigned user (idempotent)
CREATE INDEX IF NOT EXISTS "idx_leads_assigned_user_id" ON "leads"("assigned_user_id");

-- Add comment to document the purpose
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'assigned_user_id'
  ) THEN
    COMMENT ON COLUMN "leads"."assigned_user_id" IS 'User assigned to this lead for access control. NULL means unassigned (visible to all).';
  END IF;
END $$;
