# Deployment Checklist: NAS Safe Updates

## Overview

This checklist ensures the new safe update system is properly deployed on your Unraid NAS.

## Prerequisites

- ✅ Unraid server with Compose Manager installed
- ✅ Hail-Mary project already deployed (existing installation)
- ✅ SSH access to Unraid (for verification)
- ✅ Unraid Web UI access

## Step 1: Install the Safe Update Script

### Option A: Via Unraid Web UI (Recommended)

1. **Open User Scripts**
   - Navigate to: **Settings → User Scripts**
   - Click **Add New Script**

2. **Name the Script**
   - Name: `Update PHM (safe + migrate)`
   - Click the name to edit

3. **Paste Script Content**
   - Open: `/path/to/Hail-Mary/scripts/unraid-safe-update.sh`
   - Copy entire contents
   - Paste into script editor
   - Click **Save Changes**

4. **Configure Schedule (Optional)**
   - **Custom** - Manual trigger (recommended for first use)
   - **At First Array Start Only** - Run once after reboot
   - **Daily** - Automated daily updates (advanced)

5. **Test the Script**
   - Click **Run Script**
   - Watch output in real-time
   - Verify all steps complete successfully

### Option B: Via SSH

```bash
# 1. SSH to Unraid
ssh root@your-nas-ip

# 2. Navigate to User Scripts directory
cd /boot/config/plugins/user.scripts/scripts

# 3. Create new script directory
mkdir -p "update-phm-safe-migrate"
cd "update-phm-safe-migrate"

# 4. Download or copy script
# Option 1: Download from GitHub
wget https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/unraid-safe-update.sh -O script

# Option 2: Copy from local repository
cp /path/to/Hail-Mary/scripts/unraid-safe-update.sh script

# 5. Make executable
chmod +x script

# 6. Test run
./script
```

## Step 2: Update Environment Variables (Optional)

If you plan to use Worker/Sarah LLM integration in the future:

1. **Edit .env file**
   ```bash
   cd /mnt/user/appdata/hailmary
   # Or wherever your project is located
   nano .env
   ```

2. **Add Sarah Configuration**
   ```bash
   # Sarah (LLM Explanation Layer) - Optional
   SARAH_BASE_URL=https://hail-mary.martinbibb.workers.dev
   SARAH_VOICE_NOTES_PATH=/v1/voice-notes
   SARAH_CHAT_PATH=/v1/chat
   SARAH_TRANSCRIBE_PATH=/v1/transcribe
   ```

3. **Save and restart (if needed)**
   ```bash
   docker compose restart hailmary-api
   ```

## Step 3: Verify Installation

### Test 1: Check Script Configuration

```bash
# View User Script
cat /boot/config/plugins/user.scripts/scripts/update-phm-safe-migrate/script | head -50

# Verify configuration section exists
grep "PROJECT_NAME" /boot/config/plugins/user.scripts/scripts/update-phm-safe-migrate/script
```

### Test 2: Run Update Script

```bash
# Option 1: Via Web UI
Settings → User Scripts → "Update PHM (safe + migrate)" → Run Script

# Option 2: Via SSH
/boot/config/plugins/user.scripts/scripts/update-phm-safe-migrate/script
```

**Expected Output:**
```
[timestamp] ==========================================
[timestamp] Hail-Mary Safe Update Script
[timestamp] ==========================================
[timestamp] Step 1/6: Pulling latest Docker images...
[timestamp] ✅ Images pulled successfully
[timestamp] Step 2/6: Starting containers...
[timestamp] ✅ Containers started successfully
[timestamp] Step 3/6: Waiting for PostgreSQL...
[timestamp] ✅ PostgreSQL is healthy
[timestamp] Step 4/6: Running database migrations...
[timestamp] ✅ Database migrations completed successfully
[timestamp] Step 5/6: Restarting services...
[timestamp] ✅ API container restarted
[timestamp] ✅ Assistant container restarted
[timestamp] Step 6/6: Performing health checks...
[timestamp] ✅ API Service is healthy
[timestamp] ✅ Database Connection is healthy
[timestamp] ✅ PWA Frontend is healthy
[timestamp] ✅ Update completed successfully!
```

### Test 3: Verify Migrations Ran

```bash
# Check API logs for migration output
docker logs hailmary-hailmary-api-1 | grep -i "migrat"

# Should see migration log entries
```

### Test 4: Verify Health Endpoints

```bash
# API health
curl http://127.0.0.1:3001/health

# Database health
curl http://127.0.0.1:3001/health/db

# PWA health
curl http://127.0.0.1:3000/
```

### Test 5: Verify Application Works

1. Open browser: `http://YOUR_NAS_IP:8080`
2. Login to application
3. Create/view some data
4. Verify no errors in console

## Step 4: Configure Automatic Updates (Optional)

### Enable GitHub Auto-Pull

If you haven't already, enable automatic image pulls:

```bash
curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/enable-autoupdate.sh | bash
```

This will:
- ✅ Check for new images every 5 minutes
- ✅ Pull new images automatically
- ✅ **DOES NOT** run migrations (use safe update script instead)

### Manual Workflow After Auto-Pull

When images are auto-pulled:

```bash
# 1. GitHub Actions builds new images
# 2. Auto-update script pulls images (every 5 min)
# 3. You run safe update script to apply:
Settings → User Scripts → "Update PHM (safe + migrate)" → Run Script
```

### Fully Automated Workflow (Advanced)

To make everything automatic:

1. **Schedule Safe Update Script**
   - Settings → User Scripts → "Update PHM (safe + migrate)"
   - Schedule: **Daily** at 3:00 AM (low usage time)
   - Or: **Weekly** on Sunday at 3:00 AM

2. **Monitor Logs**
   ```bash
   tail -f /var/log/hail-mary-updates.log
   ```

## Troubleshooting

### Issue: "Project path not found"

**Symptoms:**
```
ERROR: Project path not found: /boot/config/plugins/compose.manager/projects/hailmary
```

**Solution:**
1. Find your actual project path:
   ```bash
   ls /boot/config/plugins/compose.manager/projects/
   ```

2. Update script configuration:
   ```bash
   # Edit script
   nano /boot/config/plugins/user.scripts/scripts/update-phm-safe-migrate/script
   
   # Change PROJECT_NAME line:
   PROJECT_NAME="your-actual-project-name"
   ```

### Issue: "API container not found"

**Symptoms:**
```
ERROR: API container not found: hailmary-hailmary-api-1
```

**Solution:**
1. Find actual container names:
   ```bash
   docker ps -a | grep hailmary
   ```

2. Update script configuration:
   ```bash
   # Edit script
   nano /boot/config/plugins/user.scripts/scripts/update-phm-safe-migrate/script
   
   # Update container name variables:
   API_CONTAINER="your-actual-api-container-name"
   ASSISTANT_CONTAINER="your-actual-assistant-container-name"
   POSTGRES_CONTAINER="your-actual-postgres-container-name"
   ```

### Issue: "PostgreSQL did not become healthy"

**Symptoms:**
```
ERROR: PostgreSQL did not become healthy within 60s
```

**Solution:**
1. Check PostgreSQL logs:
   ```bash
   docker logs hailmary-hailmary-postgres-1
   ```

2. Increase timeout in script:
   ```bash
   # Edit script
   nano /boot/config/plugins/user.scripts/scripts/update-phm-safe-migrate/script
   
   # Change timeout:
   POSTGRES_TIMEOUT=120  # Increase to 120 seconds
   ```

3. Check PostgreSQL volume:
   ```bash
   ls -la /mnt/user/appdata/hailmary/postgres
   # Should show PostgreSQL data files
   ```

### Issue: Health checks failing

**Symptoms:**
```
⚠️ API Service health check failed or timed out
```

**Note:** This is a **warning**, not an error. The update completed successfully.

**Verification:**
```bash
# Check if services are actually running
docker ps | grep hailmary

# Check API logs
docker logs hailmary-hailmary-api-1 | tail -50

# Try health endpoint manually
curl -v http://127.0.0.1:3001/health
```

**Common Causes:**
- Services taking longer to start (not an issue)
- Port mapping different than expected
- Internal networking issue (usually resolves automatically)

## Rollback Plan

If something goes wrong during an update:

### Option 1: Restart Containers

```bash
cd /boot/config/plugins/compose.manager/projects/hailmary
docker compose restart
```

### Option 2: Rollback to Previous Images

```bash
# Stop current containers
docker compose down

# Pull specific older version (if tagged)
docker pull ghcr.io/martinbibb-cmd/hail-mary-api:v0.1.9
docker pull ghcr.io/martinbibb-cmd/hail-mary-pwa:v0.1.9
docker pull ghcr.io/martinbibb-cmd/hail-mary-assistant:v0.1.9

# Start with old images
docker compose up -d
```

### Option 3: Restore from Backup

If you have database backups:

```bash
# Stop services
docker compose down

# Restore PostgreSQL data
rm -rf /mnt/user/appdata/hailmary/postgres/*
tar -xzf /path/to/backup/postgres-backup.tar.gz -C /mnt/user/appdata/hailmary/postgres/

# Restart
docker compose up -d
```

## Monitoring

### Watch Update Logs

```bash
# Real-time monitoring
tail -f /var/log/hail-mary-updates.log

# View last 100 lines
tail -100 /var/log/hail-mary-updates.log

# Search for errors
grep -i error /var/log/hail-mary-updates.log
```

### Check Container Status

```bash
# List running containers
docker ps | grep hailmary

# View container logs
docker logs hailmary-hailmary-api-1
docker logs hailmary-hailmary-assistant-1
docker logs hailmary-hailmary-pwa-1
docker logs hailmary-hailmary-postgres-1
```

### Monitor Disk Space

```bash
# Check PostgreSQL data size
du -sh /mnt/user/appdata/hailmary/postgres

# Check Docker images
docker images | grep hail-mary

# Clean old images
docker image prune -a
```

## Post-Deployment Checklist

- [ ] Safe update script installed as User Script
- [ ] Test run completed successfully
- [ ] All health checks passing
- [ ] Application accessible via browser
- [ ] Login works correctly
- [ ] Data persists after update
- [ ] (Optional) Environment variables updated for Worker
- [ ] (Optional) Automatic updates scheduled
- [ ] Monitoring/logging configured
- [ ] Team notified of new process

## Documentation References

- [Unraid Safe Update Guide](./docs/UNRAID-SAFE-UPDATE.md)
- [Implementation Summary](./docs/IMPLEMENTATION-NAS-MIGRATIONS.md)
- [Rocky & Sarah Architecture](./docs/ROCKY-SARAH-ARCHITECTURE.md)
- [Getting Started: NAS Updates](./GETTING-STARTED-NAS-UPDATES.md)

## Support

If you encounter issues not covered in this checklist:

1. Check troubleshooting sections in documentation
2. Review script logs and container logs
3. Open an issue on GitHub with:
   - Script output
   - Container logs
   - Your configuration details

---

**Last Updated**: 2024-12-17  
**Status**: Production Ready  
**Required Action**: Install safe update script on NAS
