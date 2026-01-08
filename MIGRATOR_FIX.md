# Database Migrator Fix

## Problem

The `hailmary-migrator` service was failing with exit code 1, which prevented:
- Database schema creation (missing tables: addresses, photos, scans, bug_reports, etc.)
- API service from starting (depends on migrator completing successfully)
- UI features from appearing (due to missing database tables)

## Root Cause

The migrator was using the command:
```bash
npm run db:init -w packages/api
```

This command runs:
1. `npm run db:push` - Uses drizzle-kit's push command
2. `npm run db:seed` - Seeds initial data

### Why `db:push` Failed

The `db:push` command uses drizzle-kit, which:
1. Reads TypeScript schema files at runtime (`src/db/drizzle-schema.ts`)
2. Compares the schema with the current database state
3. Generates migration SQL on-the-fly
4. Applies the changes

This approach can fail due to:
- TypeScript compilation issues in the container
- Schema file path resolution problems
- Drizzle-kit configuration issues
- Mismatch between schema and database state
- Missing or incorrect environment variables

## Solution

Changed the migrator command to:
```bash
sh -c "npm run db:migrate -w packages/api && npm run db:seed -w packages/api"
```

This approach:
1. **`db:migrate`**: Runs `src/db/migrate.ts` which applies pre-generated SQL migrations from the `drizzle/` folder
2. **`db:seed`**: Runs `src/db/seed.ts` to populate initial data

### Why This Works Better

1. **Pre-generated migrations**: The SQL migration files in `drizzle/` are already generated and tested
2. **No runtime schema parsing**: No need to parse TypeScript files at runtime
3. **Deterministic**: Always applies the same migrations in the same order
4. **Better error messages**: The migrate.ts script provides clear output
5. **Idempotent**: Can be run multiple times safely

## Migration Files

The following migration files are applied in order:
- `0000_init.sql` - Initial schema
- `0001_add_lead_workspace_tables.sql`
- `0002_add_knowledge_system.sql`
- `0003_add_system_recommendations.sql`
- `0004_add_visit_summary.sql`
- `0005_option_a_transcripts.sql`
- `0006_assets_and_visit_events.sql`
- `0007_spine_properties_visits_timeline.sql`
- `0008_spine_timeline_events_external_id.sql`
- `0009_presentation_assets_and_drafts.sql`
- `0010_presentation_drafts.sql`
- `0011_add_lead_user_assignment.sql`
- `0012_addresses_and_appointments.sql`
- `0013_link_data_to_addresses.sql`
- `0014_add_heat_loss_surveys.sql`
- `0015_add_gc_boiler_catalog.sql`
- `0016_add_photos_and_scans_tables.sql`
- `0017_add_job_graph_system.sql`
- `0017_enable_rls_addresses.sql`
- `0018_fix_rls_policies_with_check.sql`

## Files Changed

All docker-compose files were updated with the new migrator command:
- `docker-compose.yml` - Main production deployment
- `docker-compose.local.yml` - Local development with build
- `docker-compose.prod.yml` - Production with image tags
- `docker-compose.unraid.yml` - Unraid NAS deployment
- `docker-compose.unraid-build.yml` - Unraid with local build

## Manual Migration (If Needed)

If the migrator fails or you need to run migrations manually:

### 1. Start the database
```bash
docker compose up -d hailmary-postgres
```

### 2. Run migrations manually
```bash
docker exec -it hailmary-api sh -c "cd /app && npm run db:migrate -w packages/api"
```

### 3. Seed the database
```bash
docker exec -it hailmary-api sh -c "cd /app && npm run db:seed -w packages/api"
```

### 4. Verify tables exist
```bash
docker exec -it hailmary-postgres psql -U postgres -d hailmary -c "\dt"
```

## Troubleshooting

### Check Migrator Logs
```bash
docker logs --tail 200 hailmary-migrator
```

### Check Migrator Status
```bash
docker ps -a | grep hailmary-migrator
```

### Start Services Without Migrator
If the migrator is blocking the entire stack, you can start individual services:
```bash
docker compose up -d hailmary-postgres hailmary-api hailmary-assistant hailmary-pwa
```

### Common Issues

1. **DATABASE_URL not set**
   - Ensure `.env` file exists with proper DATABASE_URL
   - Format: `postgres://user:password@host:port/database`

2. **Database not ready**
   - The migrator waits for postgres health check
   - If it starts too early, increase health check retries

3. **Permission errors**
   - Ensure database user has CREATE privileges
   - For postgres user: `ALTER USER postgres CREATEDB;`

4. **Migration already applied**
   - Migrations are idempotent
   - Re-running is safe

## Related Scripts

### In package.json (packages/api)
```json
{
  "scripts": {
    "db:migrate": "ts-node src/db/migrate.ts",
    "db:seed": "ts-node src/db/seed.ts",
    "db:push": "drizzle-kit push --force",
    "db:init": "npm run db:push && npm run db:seed",
    "db:generate": "drizzle-kit generate"
  }
}
```

### Migration Script (src/db/migrate.ts)
- Uses Drizzle's programmatic migration API
- Reads SQL files from `drizzle/` folder
- Applies them in order
- Tracks applied migrations in `__drizzle_migrations` table

### Seed Script (src/db/seed.ts)
- Creates initial account
- Creates demo lead (if no leads exist)
- Seeds sample products (if no data exists)
- Creates admin user (from env vars)
- Creates guest user (from env vars)
- Idempotent - safe to run multiple times

## When to Use Each Command

### `db:migrate` (Recommended for Production)
- Uses pre-generated SQL migrations
- Deterministic and tested
- Better for CI/CD pipelines
- Required for this fix

### `db:push` (Development Only)
- Generates migrations on-the-fly from schema
- Quick for prototyping
- Not reliable in containers
- **Do not use in production**

### `db:generate`
- Generates new migration files from schema changes
- Used by developers when schema changes
- Output goes to `drizzle/` folder
- Commit generated files to git

## Future Improvements

Consider these enhancements:
1. Add migration rollback support
2. Add migration status check command
3. Separate migrator retry logic from app startup
4. Add pre-migration database backup
5. Add post-migration validation checks
