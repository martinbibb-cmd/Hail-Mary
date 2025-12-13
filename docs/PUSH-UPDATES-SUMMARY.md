# Push Updates to NAS - Implementation Summary 🚀

## Overview

Your request: **"This is installed on my NAS can we push updates?"**

**Answer: YES! ✅** The system is now fully configured to push updates from development to your NAS automatically.

## What Was Implemented

### 1. Consolidated Build Pipeline ⚙️

**Before:** Two redundant GitHub Actions workflows building the same images
**After:** One optimized workflow (`docker-build.yml`) with:
- Smart change detection (only rebuilds what changed)
- Manual trigger option for full rebuilds
- Clear summaries showing which images were updated
- Automatic push to GitHub Container Registry (GHCR)

**Result:** When you push code to GitHub, Docker images are built within 5-10 minutes.

### 2. One-Line Auto-Update Setup Script 🔧

Created `scripts/enable-autoupdate.sh` that sets everything up with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/enable-autoupdate.sh | bash
```

This script:
- ✅ Checks prerequisites (Docker, Docker Compose)
- ✅ Tests GHCR access
- ✅ Creates update checker script
- ✅ Installs cron job (checks every 5 minutes)
- ✅ Sets up logging

### 3. Comprehensive Documentation 📚

Created three new documentation files:

#### [`docs/ENABLE-AUTO-UPDATES.md`](./ENABLE-AUTO-UPDATES.md)
Complete guide covering:
- Quick 5-minute setup
- How the system works
- Configuration options
- Monitoring and troubleshooting
- Security best practices

#### [`docs/NAS-QUICK-REFERENCE.md`](./NAS-QUICK-REFERENCE.md)
Quick reference card with:
- Common commands
- Troubleshooting steps
- Default credentials
- Important file locations

#### [`docs/PUSH-UPDATES-SUMMARY.md`](./PUSH-UPDATES-SUMMARY.md)
This file - explaining what was done and how to use it.

### 4. Updated Main Documentation 📖

- **README.md**: Added one-liner for enabling auto-updates
- **NAS_DEPLOYMENT.md**: Added quick start callout box

## How It Works Now

```
┌─────────────────────────────────────────────────────────────────┐
│  DEVELOPMENT → GITHUB → NAS (Automatic)                        │
└─────────────────────────────────────────────────────────────────┘

1. Developer pushes code
   │
   ├─→ git push origin main
   │
2. GitHub Actions builds images (~5-10 min)
   │
   ├─→ Builds: api, pwa, assistant
   ├─→ Pushes to: ghcr.io/martinbibb-cmd/hail-mary-*:latest
   │
3. NAS auto-update (within 5 min)
   │
   ├─→ Cron job checks for new images
   ├─→ Pulls new images if available
   ├─→ Restarts containers with new versions
   └─→ Logs everything to /var/log/hail-mary-updates.log
```

## Quick Start Guide

### For First-Time Setup

If you haven't set up auto-updates yet:

```bash
# SSH to your NAS
ssh admin@your-nas

# Run the setup script
curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/enable-autoupdate.sh | bash
```

That's it! Updates will now happen automatically.

### For Daily Development

Your workflow is now:

```bash
# 1. Make changes locally
vim packages/api/src/routes/some-file.ts

# 2. Commit and push
git add .
git commit -m "Add new feature"
git push origin main

# 3. Wait ~15 minutes total:
#    - GitHub Actions: 5-10 min to build images
#    - NAS auto-update: Within 5 min to deploy

# 4. Verify on NAS
ssh admin@your-nas
tail -f /var/log/hail-mary-updates.log
```

### Manual Trigger (if you can't wait)

**Option A: Force GitHub Actions build**
1. Go to https://github.com/martinbibb-cmd/Hail-Mary/actions
2. Click "Build and Push Docker Images"
3. Click "Run workflow" → "Run workflow"

**Option B: Force NAS update**
```bash
ssh admin@your-nas
cd /opt/hail-mary  # or /mnt/user/appdata/hailmary
./scripts/nas-deploy.sh
```

## What Changed in Your Repository

### New Files
```
docs/
  ├── ENABLE-AUTO-UPDATES.md      (Complete auto-update guide)
  ├── NAS-QUICK-REFERENCE.md      (Quick reference card)
  └── PUSH-UPDATES-SUMMARY.md     (This file)

scripts/
  └── enable-autoupdate.sh         (One-line setup script)
```

### Modified Files
```
.github/workflows/
  ├── docker-build.yml             (Enhanced with summaries)
  └── build-and-push.yaml.disabled (Disabled duplicate workflow)

README.md                          (Added auto-update quick start)
docs/NAS_DEPLOYMENT.md            (Added auto-update callout)
```

### What Was NOT Changed
- ✅ No changes to application code
- ✅ No changes to Docker images
- ✅ No changes to database schema
- ✅ No changes to existing deployment scripts
- ✅ Backward compatible with existing deployments

## Verification Steps

### 1. Verify GitHub Actions Workflow

Check that the workflow is active:
- Visit: https://github.com/martinbibb-cmd/Hail-Mary/actions
- You should see "Build and Push Docker Images" workflow
- Trigger manually to test: "Run workflow" button

### 2. Verify GHCR Images Are Accessible

From any machine (including your NAS):

```bash
docker pull ghcr.io/martinbibb-cmd/hail-mary-api:latest
docker pull ghcr.io/martinbibb-cmd/hail-mary-pwa:latest
docker pull ghcr.io/martinbibb-cmd/hail-mary-assistant:latest
```

If these fail, see [ENABLE-AUTO-UPDATES.md](./ENABLE-AUTO-UPDATES.md) section "Verify GitHub Container Registry Images Are Public".

### 3. Test End-to-End Update

```bash
# 1. Make a trivial change
echo "# Test update" >> README.md

# 2. Push to GitHub
git add README.md
git commit -m "Test auto-update system"
git push origin main

# 3. Watch GitHub Actions
# Visit: https://github.com/martinbibb-cmd/Hail-Mary/actions

# 4. SSH to NAS and watch logs
ssh admin@your-nas
tail -f /var/log/hail-mary-updates.log

# You should see updates within 15 minutes
```

## Security Considerations

### GHCR Image Visibility

**Recommendation:** Keep images public for easiest NAS deployment

- ✅ **Public images:**
  - No authentication required on NAS
  - Simpler setup and maintenance
  - Anyone can pull (but this is fine if your code is public)

- 🔒 **Private images:**
  - Requires GitHub Personal Access Token on NAS
  - More setup complexity
  - Token must be kept secure

### Network Security

If using webhooks (optional):
- 🔒 Always use HTTPS
- 🔒 Use strong webhook secrets
- 🔒 Consider Cloudflare Tunnel or VPN
- 🔒 Restrict to localhost if behind reverse proxy

## Troubleshooting

### Images Not Pulling

**Problem:** `manifest for ghcr.io/.../hail-mary-api:latest not found`

**Solutions:**
1. Check if images are public (see ENABLE-AUTO-UPDATES.md)
2. Trigger manual build on GitHub Actions
3. For private images, authenticate: `docker login ghcr.io`

### Cron Not Running

```bash
# Check cron job exists
crontab -l | grep check-updates

# Manually run update script
/opt/hail-mary/scripts/check-updates.sh
```

### Services Not Updating

```bash
# Force pull and recreate
cd /opt/hail-mary
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

## Monitoring

### View Update History
```bash
# Real-time
tail -f /var/log/hail-mary-updates.log

# Last 50 updates
tail -n 50 /var/log/hail-mary-updates.log

# Search for specific date
grep "2024-12-13" /var/log/hail-mary-updates.log
```

### View Container Status
```bash
docker-compose -f docker-compose.prod.yml ps
```

### View Application Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f hailmary-api
```

## Next Steps

1. ✅ **Set up auto-updates on your NAS** (if not done already)
   ```bash
   curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/enable-autoupdate.sh | bash
   ```

2. ✅ **Test the system** with a trivial code change

3. ✅ **Monitor the first few updates** to ensure everything works

4. ✅ **Bookmark useful links:**
   - GitHub Actions: https://github.com/martinbibb-cmd/Hail-Mary/actions
   - Container Registry: https://github.com/martinbibb-cmd?tab=packages
   - Documentation: https://github.com/martinbibb-cmd/Hail-Mary/tree/main/docs

## Questions?

- 📚 **Full guide:** [docs/ENABLE-AUTO-UPDATES.md](./ENABLE-AUTO-UPDATES.md)
- 📋 **Quick reference:** [docs/NAS-QUICK-REFERENCE.md](./NAS-QUICK-REFERENCE.md)
- 🏠 **Main docs:** [docs/NAS_DEPLOYMENT.md](./NAS_DEPLOYMENT.md)

## Summary

✅ **Your question:** "Can we push updates to the NAS?"

✅ **Answer:** Yes! The system is now fully configured with:
- Automated build pipeline (GitHub Actions)
- One-line setup script for NAS
- Automatic update checker (every 5 minutes)
- Comprehensive documentation
- No manual intervention needed

**Total time from code push to NAS deployment: ~15 minutes** (fully automated)

🎉 **You can now focus on development - updates happen automatically!**
