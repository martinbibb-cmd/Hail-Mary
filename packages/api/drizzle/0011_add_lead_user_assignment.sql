-- Add user assignment column to leads table for access control
-- This allows admins to assign specific leads/addresses to specific users
-- Users can only see and work on leads assigned to them (admins can see all)

ALTER TABLE "leads"
ADD COLUMN "assigned_user_id" INTEGER REFERENCES "users"("id");

-- Add index for faster filtering by assigned user
CREATE INDEX "idx_leads_assigned_user_id" ON "leads"("assigned_user_id");

-- Add comment to document the purpose
COMMENT ON COLUMN "leads"."assigned_user_id" IS 'User assigned to this lead for access control. NULL means unassigned (visible to all).';
