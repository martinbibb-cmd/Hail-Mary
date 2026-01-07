# Database Migration Issues & Fixes

> **📖 For comprehensive troubleshooting, see:**
> - **[DATABASE_SCHEMA_TROUBLESHOOTING.md](./DATABASE_SCHEMA_TROUBLESHOOTING.md)** - Complete diagnostic and fix guide
> - **[DATABASE_QUICK_REFERENCE.md](./DATABASE_QUICK_REFERENCE.md)** - Quick reference with copy/paste commands

## Problem Summary

The production database is missing several tables that exist in the schema but haven't been migrated yet. This causes the errors you're seeing in the mobile app.

**Important**: Use the correct database user (`hailmary`, not `postgres`) when manually inspecting the database. The API is already connecting correctly using `hailmary` as configured in `DATABASE_URL`.

## Errors Found

### 1. Photos Table Error
```
Failed query: select count(*) from "photos" where "photos"."user_id" = $1
```
**Cause**: The `photos` table exists in migration `0016_add_photos_and_scans_tables.sql` but hasn't been applied to production database.

### 2. Addresses Table Error
```
Failed query: insert into "addresses" ("id", "created_by_user_id", "assigned_user_id", ...)
```
**Cause**: The `addresses` table exists in migration `0012_addresses_and_appointments.sql` but hasn't been applied to production database.

## Solution: Run Missing Migrations

### Option 1: Run All Pending Migrations (Recommended)

Connect to your production PostgreSQL database and run these SQL files in order:

1. **0012_addresses_and_appointments.sql** - Adds addresses, appointments, user_settings tables
2. **0013_link_data_to_addresses.sql** - Links existing data to addresses
3. **0014_add_heat_loss_surveys.sql** - Adds heat loss survey tables
4. **0015_add_gc_boiler_catalog.sql** - Adds boiler catalog
5. **0016_add_photos_and_scans_tables.sql** - Adds photos and scans tables
6. **0017_add_job_graph_system.sql** - Adds job graph system
7. **0017_enable_rls_addresses.sql** - Enables RLS on addresses
8. **0018_fix_rls_policies_with_check.sql** - Fixes RLS policies

### Option 2: Run Specific Fixes

If you only want to fix the two errors shown:

**File 1: Fix Photos Table**
```sql
-- From 0016_add_photos_and_scans_tables.sql
CREATE TABLE IF NOT EXISTS "photos" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "address_id" UUID REFERENCES "addresses"("id") ON DELETE SET NULL,
  "postcode" VARCHAR(20) NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "storage_path" TEXT NOT NULL,
  "notes" TEXT,
  "tag" VARCHAR(100),
  "latitude" NUMERIC(10, 7),
  "longitude" NUMERIC(10, 7),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "photos_user_id_idx" ON "photos"("user_id");
CREATE INDEX IF NOT EXISTS "photos_address_id_idx" ON "photos"("address_id");
CREATE INDEX IF NOT EXISTS "photos_postcode_idx" ON "photos"("postcode");
```

**File 2: Fix Addresses Table**
```sql
-- From 0012_addresses_and_appointments.sql
CREATE TABLE IF NOT EXISTS "addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_by_user_id" integer NOT NULL REFERENCES "users"("id"),
  "assigned_user_id" integer REFERENCES "users"("id"),
  "line1" varchar(255) NOT NULL,
  "line2" varchar(255),
  "town" varchar(100),
  "county" varchar(100),
  "postcode" varchar(20) NOT NULL,
  "country" varchar(100) DEFAULT 'United Kingdom' NOT NULL,
  "customer_name" varchar(255),
  "phone" varchar(50),
  "email" varchar(255),
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "addresses_postcode_idx" ON "addresses" ("postcode");
CREATE INDEX IF NOT EXISTS "addresses_created_by_user_idx" ON "addresses" ("created_by_user_id");
CREATE INDEX IF NOT EXISTS "addresses_assigned_user_idx" ON "addresses" ("assigned_user_id");
```

## How to Apply

### Using Docker (Recommended):
```bash
# Run migrations from the API container
docker exec -it hailmary-api sh -c "cd /app && npm run db:migrate"
```

### Using psql (if direct database access):
```bash
# ⚠️ Note: Use 'hailmary' user, not 'postgres' (postgres role doesn't exist in this deployment)
# Connect to your production database
docker exec -it hailmary-postgres psql -U hailmary -d hailmary

# Or from host (if you have direct access)
psql -h your-db-host -U hailmary -d hailmary

# Run each migration file
\i /path/to/0012_addresses_and_appointments.sql
\i /path/to/0013_link_data_to_addresses.sql
\i /path/to/0014_add_heat_loss_surveys.sql
\i /path/to/0015_add_gc_boiler_catalog.sql
\i /path/to/0016_add_photos_and_scans_tables.sql
\i /path/to/0017_add_job_graph_system.sql
\i /path/to/0017_enable_rls_addresses.sql
\i /path/to/0018_fix_rls_policies_with_check.sql
```

### Using Database GUI (e.g., pgAdmin, TablePlus, DBeaver):
1. Connect to your production database
2. Open a SQL query window
3. Copy and paste the contents of each migration file
4. Execute them in order

## After Running Migrations

1. Refresh the app in your browser
2. The errors should be gone
3. Photos and Addresses features should work correctly

## Migration Files Location

All migration SQL files are located in:
```
/home/user/Hail-Mary/packages/api/drizzle/
```
