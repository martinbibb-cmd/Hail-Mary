-- Fix foreign key constraint for leads.assigned_user_id
-- Add ON DELETE SET NULL to prevent orphaned references when users are deleted
-- This makes the constraint consistent with addresses.assigned_user_id and other similar patterns

-- Drop the existing foreign key constraint
-- PostgreSQL auto-generates constraint names, so we need to find it dynamically
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find the constraint name for assigned_user_id
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'leads'::regclass
    AND contype = 'f'
    AND array_length(conkey, 1) = 1
    AND conkey[1] = (
      SELECT attnum
      FROM pg_attribute
      WHERE attrelid = 'leads'::regclass
        AND attname = 'assigned_user_id'
    );

  -- Drop the constraint if found
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE leads DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Add the foreign key constraint with ON DELETE SET NULL
ALTER TABLE leads
  ADD CONSTRAINT leads_assigned_user_id_fkey
  FOREIGN KEY (assigned_user_id) REFERENCES users(id)
  ON DELETE SET NULL;
