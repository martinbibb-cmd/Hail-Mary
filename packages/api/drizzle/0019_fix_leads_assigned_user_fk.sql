-- Fix foreign key constraint for leads.assigned_user_id
-- Add ON DELETE SET NULL to prevent orphaned references when users are deleted
-- This ensures assigned_user_id is automatically cleared when the referenced user is deleted

-- Drop the existing foreign key constraint and add new one with ON DELETE SET NULL
-- This is idempotent - safe to run multiple times
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find the constraint name for assigned_user_id that references users table
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'leads'::regclass
    AND contype = 'f'
    AND confrelid = 'users'::regclass
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
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  END IF;
  
  -- Add the new constraint with ON DELETE SET NULL
  -- Check if it already exists first
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_assigned_user_id_fkey' 
    AND conrelid = 'leads'::regclass
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_assigned_user_id_fkey
      FOREIGN KEY (assigned_user_id) REFERENCES users(id)
      ON DELETE SET NULL;
    RAISE NOTICE 'Added constraint: leads_assigned_user_id_fkey with ON DELETE SET NULL';
  ELSE
    RAISE NOTICE 'Constraint leads_assigned_user_id_fkey already exists, skipping';
  END IF;
END $$;
