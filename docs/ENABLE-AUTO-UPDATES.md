# Enable Auto-Updates for NAS Installation 🚀

This guide explains how to enable automatic updates for your Hail-Mary installation on a NAS, so that when you push code changes to GitHub, they automatically deploy to your NAS.

## Overview

The auto-update system works like this:

```
Developer pushes code → GitHub Actions builds images → NAS pulls and deploys
         ↓                         ↓                              ↓
    git push              Build Docker images              Automatic restart
                          Push to GHCR
```

## Quick Start (5 Minutes)

### 1. Verify GitHub Container Registry Images Are Public

GitHub Container Registry (GHCR) images need to be publicly accessible for your NAS to pull them without authentication.

**Check if images are public:**
```bash
# Try pulling without authentication (from any machine)
docker pull ghcr.io/martinbibb-cmd/hail-mary-api:latest
```

**If the pull fails**, make the images public:

1. Go to https://github.com/martinbibb-cmd?tab=packages
2. Click on each package (`hail-mary-api`, `hail-mary-pwa`, `hail-mary-assistant`)
3. Click "Package settings" (bottom right)
4. Scroll to "Danger Zone" → "Change package visibility"
5. Select "Public" and confirm

### 2. Set Up Auto-Update on Your NAS

SSH into your NAS and run one of these setup methods:

#### Option A: Cron-Based Updates (Recommended - Checks every 5 minutes)

```bash
cd /opt/hail-mary  # or your installation directory
./scripts/setup-cron.sh 5
```

This will:
- Check for new images every 5 minutes
- Pull and deploy updates automatically
- Log updates to `/var/log/hail-mary-updates.log`

#### Option B: Webhook-Based Updates (Immediate updates)

```bash
cd /opt/hail-mary
./scripts/setup-webhook.sh
```

Follow the on-screen instructions to:
1. Set up the webhook listener service
2. Configure GitHub webhook in repository settings
3. (Optional) Configure TLS/reverse proxy

### 3. Test the Update System

**Trigger a manual build on GitHub:**

1. Go to https://github.com/martinbibb-cmd/Hail-Mary/actions
2. Click "Build and Push Docker Images" workflow
3. Click "Run workflow" → Select "main" branch → "Run workflow"
4. Wait for build to complete (~5-10 minutes)

**Verify update on NAS:**

```bash
# View update logs
tail -f /var/log/hail-mary-updates.log

# Check running containers
docker ps | grep hailmary

# Check if services are running
curl http://localhost:3000
```

## How It Works

### GitHub Actions (Automatic Builds)

Two workflows automatically build and push Docker images:

1. **`docker-build.yml`** - Smart build with change detection
   - Triggers on: Push to `main` or `staging` branches
   - Only rebuilds services that changed
   - Faster builds, saves CI time

2. **`build-and-push.yaml`** - Full rebuild workflow
   - Triggers on: Push to `main` branch
   - Builds all services every time
   - Fallback for comprehensive builds

Both workflows push images to:
- `ghcr.io/martinbibb-cmd/hail-mary-api:latest`
- `ghcr.io/martinbibb-cmd/hail-mary-pwa:latest`
- `ghcr.io/martinbibb-cmd/hail-mary-assistant:latest`

### NAS Update Process

The `setup-cron.sh` script installs a cron job that:

1. **Checks for updates** - Compares current image IDs with latest in GHCR
2. **Pulls new images** - Downloads updated images if available
3. **Restarts containers** - Restarts only if images changed
4. **Cleans up** - Removes old unused images

The process is:
- **Idempotent** - Safe to run multiple times
- **Zero-downtime** - Services restart gracefully
- **Automatic** - No manual intervention needed

## Configuration Options

### Change Update Frequency

```bash
# Check every 15 minutes
./scripts/setup-cron.sh 15

# Check every hour
./scripts/setup-cron.sh 60
```

### Deploy Specific Version

```bash
# Deploy a specific commit
export IMAGE_TAG=abc1234
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Deploy from staging branch
export IMAGE_TAG=staging
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Update

```bash
# Pull latest and restart
cd /opt/hail-mary
./scripts/nas-deploy.sh
```

## Monitoring

### View Update Logs

```bash
# Real-time updates
tail -f /var/log/hail-mary-updates.log

# Last 50 lines
tail -n 50 /var/log/hail-mary-updates.log

# Search for specific date
grep "2024-12-13" /var/log/hail-mary-updates.log
```

### View Container Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f hailmary-api
docker-compose -f docker-compose.prod.yml logs -f hailmary-pwa
docker-compose -f docker-compose.prod.yml logs -f hailmary-assistant
```

### Check Container Status

```bash
docker-compose -f docker-compose.prod.yml ps
```

## Troubleshooting

### Images Not Pulling

**Problem:** `manifest for ghcr.io/martinbibb-cmd/hail-mary-api:latest not found`

**Solutions:**

1. **Verify images are public** (see Step 1 above)

2. **Trigger a manual build** on GitHub Actions

3. **For private images**, authenticate on NAS:
```bash
# Generate a GitHub Personal Access Token with read:packages scope
# https://github.com/settings/tokens

export GITHUB_TOKEN=ghp_your_token_here
echo $GITHUB_TOKEN | docker login ghcr.io -u martinbibb-cmd --password-stdin
```

### Cron Not Running

```bash
# Check if cron job exists
crontab -l | grep check-updates

# Check cron service is running
systemctl status cron  # or 'crond' on some systems

# Manually run update script
/opt/hail-mary/scripts/check-updates.sh
```

### Updates Not Applying

```bash
# Force pull and recreate
cd /opt/hail-mary
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --force-recreate

# Check if new images are available
docker images | grep hailmary
```

### Database Migration Issues

After updates, database migrations run automatically. If you encounter issues:

```bash
# Check migration logs
docker-compose -f docker-compose.prod.yml logs hailmary-api | grep -i "migration\|schema"

# Manually run migrations
docker exec -it hailmary-api npm run db:push
```

## Security Best Practices

### For Public Images
- ✅ No authentication required on NAS
- ✅ Simpler setup
- ⚠️  Anyone can pull your images (not a security issue if code is public)

### For Private Images
- ✅ More control over who can access
- ⚠️  Requires GitHub Personal Access Token on NAS
- ⚠️  Token must be kept secure

### Network Security
- 🔒 Always use HTTPS for webhook endpoints
- 🔒 Use strong webhook secrets
- 🔒 Consider using Cloudflare Tunnel or VPN for webhook access
- 🔒 Restrict webhook listener to localhost if using reverse proxy

## Disable Auto-Updates

To disable automatic updates:

```bash
# Remove cron job
crontab -l | grep -v 'check-updates.sh' | crontab -

# Stop webhook service (if using)
sudo systemctl stop hail-mary-webhook
sudo systemctl disable hail-mary-webhook
```

## Manual Deployment Workflow

If you prefer manual updates:

```bash
# 1. SSH to your NAS
ssh admin@your-nas

# 2. Pull latest images
cd /opt/hail-mary
docker-compose -f docker-compose.prod.yml pull

# 3. Restart services
docker-compose -f docker-compose.prod.yml up -d

# 4. Verify deployment
docker-compose -f docker-compose.prod.yml ps
curl http://localhost:3000
```

## Next Steps

1. ✅ Set up auto-updates (choose cron or webhook)
2. ✅ Test with a manual workflow trigger
3. ✅ Monitor logs for first few updates
4. ✅ Configure notifications (optional)
5. ✅ Document your specific NAS setup

For more details, see:
- [NAS Deployment Guide](./NAS_DEPLOYMENT.md)
- [Deployment Options](./DEPLOYMENT.md)

## Support

If you encounter issues:

1. Check the logs: `/var/log/hail-mary-updates.log`
2. Review GitHub Actions: https://github.com/martinbibb-cmd/Hail-Mary/actions
3. Verify GHCR images: https://github.com/martinbibb-cmd?tab=packages
4. Test manual deployment: `./scripts/nas-deploy.sh`
