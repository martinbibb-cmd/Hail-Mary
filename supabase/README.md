# Supabase Database Setup

This directory contains the database migrations for Supabase (PostgreSQL).

## Database Schema

The following tables are created:

| Table | Description |
|-------|-------------|
| `customers` | Customer contact details and addresses |
| `leads` | Sales lead tracking with status management |
| `products` | Boilers, cylinders, parts with specifications |
| `quotes` | Multi-line quotes with automatic totals |
| `quote_lines` | Individual line items within quotes |
| `appointments` | Survey, installation, service scheduling |
| `surveys` | Property assessments, photos, measurements |
| `documents` | PDFs, proposals, handover packs |

## Applying Migrations

### Option 1: Using Supabase CLI (Recommended)

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Push the migrations:
   ```bash
   supabase db push
   ```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `migrations/20241201000000_initial_schema.sql`
4. Paste and run the SQL

## Row Level Security (RLS)

All tables have RLS enabled with default policies that allow all operations. When implementing authentication, update these policies to restrict access based on user roles.

Example policies for authenticated users:

```sql
-- Allow authenticated users to read all customers
CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert new customers
CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update customers
CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

> **Note**: When implementing user-specific access control, you'll need to add a `user_id` column to tables and reference `auth.uid()` in your policies.

## Environment Variables

To connect your API to Supabase, add these environment variables:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Schema Details

### Data Types

- **UUID**: All primary keys use UUID with auto-generation
- **TIMESTAMPTZ**: All timestamps are timezone-aware
- **JSONB**: Specifications, photos, and measurements use JSONB for flexibility
- **DECIMAL**: Monetary values use DECIMAL(10, 2) for precision

### Indexes

Indexes are created on frequently queried columns:
- Foreign key columns (customer_id, quote_id, etc.)
- Status columns for filtering
- scheduled_at for appointment queries

### Triggers

Automatic `updated_at` triggers are applied to all tables to track when records are modified.
