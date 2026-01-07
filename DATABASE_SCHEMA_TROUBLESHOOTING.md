# Database Schema Troubleshooting Guide

## Overview

This guide helps you diagnose and fix database schema mismatch issues in Hail-Mary. These issues typically manifest as:
- "relation does not exist" errors (missing tables)
- "column does not exist" errors (missing columns)
- Features appearing broken or missing in the UI
- Empty lists or silent failures in the application

**Important**: These are NOT "database down" or "connection failed" issues. If you see schema errors, it means:
- ✅ Postgres is running
- ✅ API is running and can connect to Postgres
- ✅ API is executing SQL queries
- ❌ But the database schema is outdated or incomplete

## Quick Diagnosis

### Step 1: Check What's Actually Wrong

Review your API logs for errors like these:

```
relation "addresses" does not exist
column "assigned_user_id" does not exist
```

These tell you exactly which tables or columns are missing.

### Step 2: Use the Correct Database User

**Important**: Your database uses the `hailmary` user, not `postgres`.

Your `DATABASE_URL` in `.env` shows the correct user:
```
DATABASE_URL=postgresql://hailmary:password@hailmary-postgres:5432/hailmary
                        ^^^^^^^^ (this is your DB user)
```

If you see this error:
```
FATAL: role "postgres" does not exist
```

You're trying to connect with the wrong user. Use `hailmary` instead.

## Checking Database State

### Inspect What Tables Exist

```bash
# List all tables in the database
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\dt"

# Check the structure of a specific table (e.g., leads)
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\d leads"

# Check if addresses table exists
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\d addresses"
```

### Compare Against Expected Schema

Your migrations are located in: `packages/api/drizzle/`

Key tables that should exist after all migrations:
- `users` (migration 0000)
- `leads` with `assigned_user_id` column (migration 0011)
- `addresses` (migration 0012)
- `address_appointments` (migration 0012)
- `photos` (migration 0016)
- `scans` (migration 0016)

## Fixing Schema Mismatch

### Option 1: Run Migrations from API Container (Recommended)

This applies any pending migrations to bring your database up to date:

```bash
# Enter the API container
docker exec -it hailmary-api sh

# Navigate to the app directory
cd /app

# Check what migration scripts are available
cat package.json | grep -A 5 '"scripts"'

# Run migrations
npm run db:migrate

# Exit the container
exit
```

### Option 2: Run Migrations from Host

If you have the repository cloned locally:

```bash
# From the repository root
npm run db:migrate
```

### Option 3: Fresh Database Reset (Development Only)

⚠️ **Warning**: This deletes ALL data (leads, addresses, etc.)

Use this only if:
- You're in development
- Your data is not precious
- You want a clean slate

```bash
# Stop all services
docker compose down

# List volumes to find the postgres volume
docker volume ls | grep hailmary

# Remove the postgres data volume (name may vary)
docker volume rm hailmary-postgres-data

# Restart services (this will run migrations automatically)
docker compose up -d

# Check logs to verify migration completed
docker compose logs -f hailmary-migrator
```

## Understanding the Migrator Service

The `docker-compose.yml` includes a special `hailmary-migrator` service that runs on startup:

```yaml
hailmary-migrator:
  image: ghcr.io/martinbibb-cmd/hail-mary-api:latest
  command: npm run db:init -w packages/api
  depends_on:
    hailmary-postgres:
      condition: service_healthy
```

**What it does:**
1. Waits for Postgres to be healthy
2. Runs `npm run db:init` which:
   - Pushes the schema to the database (`db:push`)
   - Seeds initial data including admin user (`db:seed`)
3. Exits (it's a one-time init container)
4. Then the API service starts

**If migrations fail:**
- Check the migrator logs: `docker compose logs hailmary-migrator`
- The API service won't start until the migrator completes successfully
- Fix any issues and restart: `docker compose restart hailmary-migrator`

## Checking Migration Scripts

### List Available Scripts in API Package

```bash
# From inside the API container (requires standard package.json formatting)
docker exec -it hailmary-api sh -c "cd /app && cat package.json | sed -n '/\"scripts\"/,/}/p'"

# Alternative: use grep for more robust output
docker exec -it hailmary-api sh -c "cd /app && cat package.json | grep -A 15 '\"scripts\"'"

# Or from the repository root
cat packages/api/package.json | grep -A 10 '"scripts"'
```

**Available database scripts:**
- `db:generate` - Generate new migration files from schema changes
- `db:migrate` - Apply pending migrations to the database
- `db:push` - Push schema directly to database (used by db:init)
- `db:seed` - Seed the database with initial data
- `db:init` - Complete setup (push + seed) - used by migrator service

## Health Check Endpoints

### The CORRECT Health Endpoints

```bash
# Check health via nginx proxy (recommended from host)
curl http://localhost:3000/health/api       # Proxies to API /health
curl http://localhost:3000/health/assistant # Proxies to Assistant /health

# Direct API health endpoint (detailed info)
docker exec -it hailmary-api curl http://localhost:3001/health
docker exec -it hailmary-api curl http://localhost:3001/health/detailed
docker exec -it hailmary-api curl http://localhost:3001/health/db

# Direct Assistant health endpoint
docker exec -it hailmary-assistant curl http://localhost:3002/health
```

### What is `/health.json`?

**This is NOT a health endpoint.**

If you see this error when accessing `https://your-domain.com/health.json`:

```json
{"success":false,"error":"Invalid transcript ID"}
```

That's because `/health.json` is being routed to a transcript handler or similar endpoint that interprets it as a resource ID. The SPA (Single Page Application) routing treats any unmatched path as a potential resource, and the API may have a catch-all route that processes it.

**Do NOT use `health.json` for diagnostics.**

The actual health endpoints are:
- `/health/api` - Proxies to API service's `/health` endpoint
- `/health/assistant` - Proxies to Assistant service's `/health` endpoint

## Common Scenarios

### Scenario 1: "addresses" table missing

**Error in logs:**
```
relation "addresses" does not exist
```

**What happened:**
- Migration `0012_addresses_and_appointments.sql` hasn't been applied
- Anything that needs addresses (new lead creation, address management) will fail

**Fix:**
Run migrations as described in "Option 1" above.

### Scenario 2: "assigned_user_id" column missing on leads

**Error in logs:**
```
column "assigned_user_id" does not exist
```

**What happened:**
- Migration `0011_add_lead_user_assignment.sql` hasn't been applied
- Lead filtering and assignment features won't work

**Fix:**
Run migrations as described in "Option 1" above.

### Scenario 3: Features seem "missing" in UI

**Symptoms:**
- Empty lists everywhere
- Actions/buttons don't appear
- Silent failures when trying to create data

**What happened:**
- The API is failing to load data due to schema mismatches
- The UI reacts by hiding features that depend on that data
- Not all UI routes are missing - only those that need the missing tables/columns

**This is NOT a mobile/tablet layout issue** (though you may also have that separately).

**Fix:**
Run migrations, then refresh the browser.

## Verification After Fix

After running migrations, verify everything works:

```bash
# 1. Check migrations completed successfully
docker compose logs hailmary-migrator

# 2. Check API is running without errors
docker compose logs hailmary-api | tail -50

# 3. Verify tables exist
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\dt"

# 4. Check specific tables
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\d addresses"
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\d leads"

# 5. Test health endpoints
curl http://localhost:3000/health/api
curl http://localhost:3000/health/assistant

# 6. Check API can query database
docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "SELECT COUNT(*) FROM users;"
```

Then open the application in your browser and verify:
- You can log in
- Lists load (addresses, leads, etc.)
- You can create new records
- No errors in browser console

## Understanding Why This Happens

Database schema and application code can get out of sync when:

1. **You pulled new code** that expects schema changes, but didn't run migrations
2. **You restored an old database backup** that's missing recent schema changes
3. **The migrator service failed** during deployment and you didn't notice
4. **You're running mixed versions** (old database with new API, or vice versa)

The solution is always: **Run migrations to sync the schema with the code.**

## Prevention

To avoid schema mismatch issues in the future:

1. **Always check migrator logs after deployment:**
   ```bash
   docker compose logs hailmary-migrator
   ```

2. **Don't bypass the migrator service** - it's there for a reason

3. **When pulling new code, check if new migrations were added:**
   ```bash
   ls -la packages/api/drizzle/
   git log --oneline packages/api/drizzle/
   ```

4. **Keep your docker-compose.yml up to date** - the migrator service configuration may change

5. **Use version pinning in production:**
   ```yaml
   image: ghcr.io/martinbibb-cmd/hail-mary-api:sha-abc123
   ```
   Instead of:
   ```yaml
   image: ghcr.io/martinbibb-cmd/hail-mary-api:latest
   ```

## Getting Help

If you've followed this guide and still have issues:

1. **Collect diagnostic information:**
   ```bash
   # Save all logs
   docker compose logs > all-logs.txt
   
   # Save database table list
   docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\dt" > tables.txt
   
   # Save migration status
   docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 10;" > migrations.txt
   ```

2. **Check the migration tracking table:**
   ```bash
   docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "\d __drizzle_migrations"
   docker exec -it hailmary-postgres psql -U hailmary -d hailmary -c "SELECT * FROM __drizzle_migrations;"
   ```

3. **Share the specific error messages** from your logs (not just "it's broken")

4. **Mention what you've already tried** from this guide
