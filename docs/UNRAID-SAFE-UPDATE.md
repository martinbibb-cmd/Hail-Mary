# Unraid Safe Update Script

## Overview

The `unraid-safe-update.sh` script provides a **safe, automated way to update Hail-Mary on Unraid** with automatic database migrations. This eliminates the manual steps that previously caused issues.

## Why This Script Exists

### The Problem
Previously, updates required manual steps:
1. Pull images
2. Restart containers
3. Manually run migrations via `docker exec`
4. Restart services again
5. Check health endpoints

**This caused issues:**
- Forgotten migration steps → broken deployments
- Wrong directory paths → script failures
- No health checks → silent failures

### The Solution
This script **automates everything safely**:
- ✅ Pulls latest images automatically
- ✅ Runs migrations after PostgreSQL is ready
- ✅ Restarts services to apply changes
- ✅ Performs health checks
- ✅ Reports success/failure clearly

## Installation (Unraid User Script)

### Step 1: Copy the Script

1. Open Unraid Web UI
2. Go to **Settings → User Scripts**
3. Click **Add New Script**
4. Name it: `Update PHM (safe + migrate)`
5. Click the script name to edit it

### Step 2: Paste the Script Content

Copy the entire contents of `scripts/unraid-safe-update.sh` and paste it into the script editor.

### Step 3: Configure Schedule (Optional)

Choose when to run:
- **Custom** - Manual trigger only (recommended for testing)
- **At First Array Start Only** - Run once after reboot
- **Daily/Weekly** - Automated updates (advanced users)

### Step 4: Save and Test

1. Click **Save Changes**
2. Click **Run Script** to test
3. Watch the output in real-time

## What the Script Does

### Detailed Flow

```
1. Pull Latest Images
   ├─ docker compose pull
   └─ Downloads latest versions from GHCR

2. Start/Update Containers
   ├─ docker compose up -d
   └─ Applies new images to running stack

3. Wait for PostgreSQL
   ├─ Loop: pg_isready check
   └─ Timeout: 60 seconds

4. Run Database Migrations
   ├─ docker exec hailmary-api
   ├─ npm -w @hail-mary/api run db:migrate
   └─ Applies schema changes safely

5. Restart Services
   ├─ docker restart hailmary-api
   ├─ docker restart hailmary-assistant
   └─ Ensures migrations take effect

6. Health Checks
   ├─ http://127.0.0.1:3001/health (API)
   ├─ http://127.0.0.1:3001/health/db (Database)
   └─ http://127.0.0.1:3000/ (PWA)
```

### Safe Failure Modes

If anything fails, the script:
- ✅ **Exits immediately** (set -e)
- ✅ **Shows clear error messages**
- ✅ **Doesn't leave the system in a broken state**

## Configuration

### Environment Variables (Optional)

You can customize the script by setting these at the top of the script:

```bash
# Project name in Compose Manager (default: hailmary)
PROJECT_NAME="hailmary"

# Container names (if you customized them)
API_CONTAINER="hailmary-hailmary-api-1"
ASSISTANT_CONTAINER="hailmary-hailmary-assistant-1"
POSTGRES_CONTAINER="hailmary-hailmary-postgres-1"

# Timeouts
POSTGRES_TIMEOUT=60          # Wait up to 60s for PostgreSQL
HEALTH_CHECK_TIMEOUT=30      # Wait up to 30s for health checks
```

### Default Paths

The script uses Unraid Compose Manager's standard paths:

```bash
/boot/config/plugins/compose.manager/projects/hailmary/
  ├─ docker-compose.yml           # Main compose file
  └─ docker-compose.override.yml  # Optional overrides
```

## Usage

### Manual Update (Recommended)

1. Go to **Settings → User Scripts**
2. Find **Update PHM (safe + migrate)**
3. Click **Run Script**
4. Watch the output

### Scheduled Update (Advanced)

1. Edit script schedule
2. Choose frequency (Daily, Weekly, etc.)
3. Save
4. Script runs automatically on schedule

### Command Line (SSH)

If you prefer SSH:

```bash
# Run the script directly
bash /boot/config/plugins/user.scripts/scripts/update-phm-safe-migrate/script

# Or copy it locally and run
cd /mnt/user/appdata/hailmary
bash scripts/unraid-safe-update.sh
```

## Troubleshooting

### "Project path not found"

**Error:**
```
ERROR: Project path not found: /boot/config/plugins/compose.manager/projects/hailmary
```

**Solution:**
Check your project name in Compose Manager. Update `PROJECT_NAME` in the script if different.

```bash
# List available projects
ls /boot/config/plugins/compose.manager/projects/
```

### "API container not found"

**Error:**
```
ERROR: API container not found: hailmary-hailmary-api-1
```

**Solution:**
Find the actual container name and update the script:

```bash
# List Hail-Mary containers
docker ps -a | grep hailmary

# Update script with actual name
API_CONTAINER="your-actual-container-name"
```

### "PostgreSQL did not become healthy"

**Error:**
```
ERROR: PostgreSQL did not become healthy within 60s
```

**Solution:**
1. Check PostgreSQL logs: `docker logs hailmary-hailmary-postgres-1`
2. Increase `POSTGRES_TIMEOUT` in script
3. Verify database volume is accessible

### "Database migrations failed"

**Error:**
```
ERROR: Database migrations failed
```

**Solution:**
1. Check API container logs: `docker logs hailmary-hailmary-api-1`
2. Verify database connection string is correct
3. Try running migration manually:
   ```bash
   docker exec hailmary-hailmary-api-1 sh -lc "cd /app && npm -w @hail-mary/api run db:migrate"
   ```

### Health checks failing

**Warning:**
```
⚠️ API Service health check failed or timed out
```

**Solution:**
- This is a **warning, not an error** - the update completed
- Check if services are actually running: `docker ps`
- Check logs: `docker logs hailmary-hailmary-api-1`
- Verify health endpoints manually:
  ```bash
  curl http://127.0.0.1:3001/health
  curl http://127.0.0.1:3001/health/db
  ```

## Example Output

### Successful Update

```
[2024-12-17 20:15:00] ==========================================
[2024-12-17 20:15:00] Hail-Mary Safe Update Script
[2024-12-17 20:15:00] ==========================================
[2024-12-17 20:15:00] 
[2024-12-17 20:15:00] Project path: /boot/config/plugins/compose.manager/projects/hailmary
[2024-12-17 20:15:00] Using compose file: /boot/config/plugins/compose.manager/projects/hailmary/docker-compose.yml
[2024-12-17 20:15:00] 
[2024-12-17 20:15:00] Step 1/6: Pulling latest Docker images...
[2024-12-17 20:15:05] ✅ Images pulled successfully
[2024-12-17 20:15:05] 
[2024-12-17 20:15:05] Step 2/6: Starting containers with latest images...
[2024-12-17 20:15:10] ✅ Containers started successfully
[2024-12-17 20:15:10] 
[2024-12-17 20:15:10] Step 3/6: Waiting for PostgreSQL to be healthy...
[2024-12-17 20:15:12] ✅ PostgreSQL is healthy
[2024-12-17 20:15:12] 
[2024-12-17 20:15:12] Step 4/6: Running database migrations...
[2024-12-17 20:15:12] Executing: npm -w @hail-mary/api run db:migrate
[2024-12-17 20:15:15] ✅ Database migrations completed successfully
[2024-12-17 20:15:15] 
[2024-12-17 20:15:15] Step 5/6: Restarting API and Assistant containers...
[2024-12-17 20:15:16] ✅ API container restarted
[2024-12-17 20:15:17] ✅ Assistant container restarted
[2024-12-17 20:15:17] Waiting for services to initialize (5s)...
[2024-12-17 20:15:22] 
[2024-12-17 20:15:22] Step 6/6: Performing health checks...
[2024-12-17 20:15:22] 
[2024-12-17 20:15:22] Health check: API Service (http://127.0.0.1:3001/health)...
[2024-12-17 20:15:23] ✅ API Service is healthy
[2024-12-17 20:15:23] Health check: Database Connection (http://127.0.0.1:3001/health/db)...
[2024-12-17 20:15:24] ✅ Database Connection is healthy
[2024-12-17 20:15:24] Health check: PWA Frontend (http://127.0.0.1:3000/)...
[2024-12-17 20:15:25] ✅ PWA Frontend is healthy
[2024-12-17 20:15:25] 
[2024-12-17 20:15:25] ==========================================
[2024-12-17 20:15:25] ✅ Update completed successfully!
[2024-12-17 20:15:25] ==========================================
```

## Integration with Existing Workflow

This script **replaces** these manual steps:

### Before (Manual)
```bash
# 1. Pull images
docker compose pull

# 2. Update containers
docker compose up -d

# 3. Wait... how long? ¯\_(ツ)_/¯

# 4. Run migrations (hope you remember!)
docker exec hailmary-api sh -lc "cd /app && npm -w @hail-mary/api run db:migrate"

# 5. Restart (hope you remember this too!)
docker restart hailmary-api hailmary-assistant

# 6. Check health (probably forget this)
curl http://localhost:3001/health
```

### After (Automated)
```bash
# Run script
bash /path/to/unraid-safe-update.sh

# That's it! ✅
```

## Future Enhancements

Potential additions:
- [ ] Backup database before migrations
- [ ] Rollback on migration failure
- [ ] Email/notification on completion
- [ ] Slack/Discord webhook integration
- [ ] Pre-update health check
- [ ] Post-update smoke tests

## Related Documentation

- [Getting Started: NAS Updates](../GETTING-STARTED-NAS-UPDATES.md)
- [Docker Compose Setup](../DOCKER_COMPOSE_SETUP.md)
- [Database Migrations](../packages/api/README.md#database-migrations)

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs: `docker compose logs -f`
3. Open an issue on GitHub with:
   - Script output
   - Container logs
   - Your setup details (Unraid version, project name, etc.)

## Summary

✅ **One script** to safely update everything  
✅ **Automatic migrations** every time  
✅ **Health checks** built-in  
✅ **Clear logging** for debugging  
✅ **Safe failures** - exits on error  

**No more manual migration steps. No more broken deploys.** 🎉
