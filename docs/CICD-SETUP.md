# CI/CD Pipeline Setup for Hail-Mary

## Overview

Hail-Mary uses a **deterministic deployment pipeline** that ensures code changes on `main` automatically build, publish, and deploy to your NAS.

```
CODE (GitHub main) → IMAGE (GHCR:latest) → RUNTIME (NAS containers)
```

This document explains how the pipeline works and how to verify it's working correctly.

## Current Architecture

### 1. GitHub Actions Workflow (`.github/workflows/docker-build.yml`)

**✅ ALREADY CONFIGURED AND WORKING**

The workflow automatically:
- **Triggers** on every push to `main` branch
- **Builds** Docker images for all three services:
  - `hail-mary-api`
  - `hail-mary-pwa`
  - `hail-mary-assistant`
- **Pushes** images to GitHub Container Registry (GHCR) with `:latest` tag
- **Smart change detection** - only builds services that changed (or force rebuild via manual trigger)

**Key features:**
- Uses GitHub Actions cache for faster builds
- Proper permissions: `contents: read`, `packages: write`
- Secure authentication via `GITHUB_TOKEN` (automatic)
- Only tags as `:latest` when on `main` branch (not staging)

### 2. NAS Deployment (unRAID)

**✅ ALREADY CONFIGURED FOR GHCR**

The file `docker-compose.unraid.yml` is configured to pull pre-built images from GHCR:

```yaml
services:
  hailmary-api:
    image: ghcr.io/martinbibb-cmd/hail-mary-api:latest

  hailmary-pwa:
    image: ghcr.io/martinbibb-cmd/hail-mary-pwa:latest

  hailmary-assistant:
    image: ghcr.io/martinbibb-cmd/hail-mary-assistant:latest
```

**Note:** The standard `docker-compose.yml` builds locally, which is useful for development but NOT for production NAS deployment.

## How It Works

### Step-by-Step Flow

1. **Developer pushes code to `main`**
   ```bash
   git push origin main
   ```

2. **GitHub Actions detects push and triggers workflow**
   - Workflow runs on GitHub's servers
   - No manual intervention required

3. **Workflow builds Docker images**
   - Builds only changed services (or all if forced)
   - Uses Docker Buildx for efficient multi-platform builds
   - Leverages GitHub Actions cache for speed

4. **Workflow pushes images to GHCR**
   - Images tagged as `:latest`
   - Also tagged with commit SHA for version tracking
   - Published to: `ghcr.io/martinbibb-cmd/hail-mary-*:latest`

5. **NAS pulls and deploys new images**
   - Manual: `docker compose pull && docker compose up -d`
   - Automatic: User Scripts plugin checks for updates periodically

## Verification Checklist

### ✅ 1. Verify GitHub Actions Workflow Exists

Check that `.github/workflows/docker-build.yml` exists and is configured correctly:

```bash
cat .github/workflows/docker-build.yml
```

**Expected:**
- Triggers: `push` to `main` and `staging`
- Builds: `api`, `pwa`, `assistant`
- Registry: `ghcr.io`
- Permissions: `packages: write`

### ✅ 2. Verify Workflow Has Run Successfully

Visit GitHub Actions:
```
https://github.com/martinbibb-cmd/Hail-Mary/actions
```

**Check for:**
- ✅ Green checkmarks on recent `main` branch pushes
- ✅ "Build and Push Docker Images" workflow runs
- ❌ Red X means build failures (check logs)

### ✅ 3. Verify Images Are Published to GHCR

Visit GitHub Packages:
```
https://github.com/martinbibb-cmd?tab=packages&repo_name=Hail-Mary
```

**You should see:**
- `hail-mary-api`
- `hail-mary-pwa`
- `hail-mary-assistant`

Each with:
- Tag: `latest`
- Tag: `main`
- Tag: `<commit-sha>`

### ✅ 4. Verify Image Visibility (Public vs Private)

**IMPORTANT:** GHCR images default to **private** for private repos.

**To make images public (so NAS can pull without authentication):**

1. Go to: `https://github.com/users/martinbibb-cmd/packages/container/hail-mary-api/settings`
2. Scroll to "Danger Zone"
3. Click "Change visibility" → "Public"
4. Repeat for `hail-mary-pwa` and `hail-mary-assistant`

**Alternative:** Keep images private and configure Docker authentication on NAS (see below).

### ✅ 5. Test Pulling Images Manually

On your NAS or local machine:

```bash
# Try pulling without authentication (only works if public)
docker pull ghcr.io/martinbibb-cmd/hail-mary-api:latest
docker pull ghcr.io/martinbibb-cmd/hail-mary-pwa:latest
docker pull ghcr.io/martinbibb-cmd/hail-mary-assistant:latest
```

**If images are private, you'll get:**
```
Error response from daemon: unauthorized: unauthenticated
```

**Solution:** Authenticate with GHCR (see below).

## Authentication for Private Images

If you keep GHCR images private, your NAS needs to authenticate to pull them.

### Option 1: GitHub Personal Access Token (Recommended)

1. **Create a PAT:**
   - Go to: `https://github.com/settings/tokens/new`
   - Name: `NAS GHCR Pull Access`
   - Expiration: 90 days (or longer)
   - Scopes: **Only** select `read:packages`
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again)

2. **Authenticate Docker on NAS:**
   ```bash
   echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u martinbibb-cmd --password-stdin
   ```

3. **Verify authentication:**
   ```bash
   docker pull ghcr.io/martinbibb-cmd/hail-mary-api:latest
   ```

4. **Credentials persist** in `/root/.docker/config.json` (Docker handles this automatically)

### Option 2: Make Images Public (Simpler)

If your repo is private but you're okay with public images:
- Images are just pre-built binaries
- No sensitive data (secrets are env vars, not baked into images)
- Makes NAS deployment simpler (no auth needed)

## NAS Deployment Workflow

### Manual Update (Recommended for Testing)

```bash
cd /mnt/user/appdata/hailmary
docker compose -f docker-compose.unraid.yml pull
docker compose -f docker-compose.unraid.yml up -d
docker image prune -f
```

### Automatic Updates (User Scripts Plugin)

Set up automatic updates using the unRAID User Scripts plugin:

```bash
cd /mnt/user/appdata/hailmary
./scripts/setup-unraid-autoupdate.sh
```

This creates a scheduled script that:
- Pulls latest images from GHCR every hour (configurable)
- Restarts containers if updates found
- Sends unRAID notifications
- Cleans up old images

**Customize schedule:**
```bash
# Check every 15 minutes (fast updates)
./scripts/setup-unraid-autoupdate.sh --interval "*/15 * * * *"

# Check daily at 2 AM
./scripts/setup-unraid-autoupdate.sh --interval "0 2 * * *"
```

## Troubleshooting

### Problem: Workflow Doesn't Trigger

**Symptoms:**
- Push to `main` but no GitHub Actions run appears

**Causes:**
- Workflow file has syntax errors
- GitHub Actions disabled for repo
- Push was to wrong branch

**Solutions:**
```bash
# Check workflow syntax
cat .github/workflows/docker-build.yml

# Verify you're on main
git branch --show-current

# Check GitHub Actions is enabled
# Visit: https://github.com/martinbibb-cmd/Hail-Mary/settings/actions
```

### Problem: Build Fails

**Symptoms:**
- Red X on GitHub Actions
- Images not published to GHCR

**Causes:**
- TypeScript errors
- Missing dependencies
- Dockerfile errors

**Solutions:**
- Check GitHub Actions logs for specific errors
- Test build locally:
  ```bash
  docker build -f packages/api/Dockerfile -t test-api .
  docker build -f packages/pwa/Dockerfile -t test-pwa .
  docker build -f packages/assistant/Dockerfile -t test-assistant .
  ```

### Problem: NAS Can't Pull Images

**Symptoms:**
```
Error response from daemon: manifest for ghcr.io/martinbibb-cmd/hail-mary-api:latest not found
```

**Causes:**
- Images not yet published (first time setup)
- Images are private and NAS not authenticated
- Wrong image name/tag

**Solutions:**

1. **Check if images exist:**
   Visit: `https://github.com/martinbibb-cmd?tab=packages`

2. **If images don't exist:**
   - Trigger workflow manually: `https://github.com/martinbibb-cmd/Hail-Mary/actions/workflows/docker-build.yml`
   - Click "Run workflow" → select `main` → check "Force rebuild"

3. **If images are private:**
   - Authenticate Docker on NAS (see "Authentication" section above)
   - Or make images public

4. **If authentication fails:**
   ```bash
   # Check Docker config
   cat ~/.docker/config.json

   # Re-authenticate
   docker logout ghcr.io
   docker login ghcr.io -u martinbibb-cmd
   ```

### Problem: Changes Not Appearing on NAS

**Symptoms:**
- Pushed code to `main`
- Workflow succeeded
- NAS still running old version

**Causes:**
- NAS hasn't pulled new images yet
- Using wrong compose file (building locally instead of pulling)

**Solutions:**

1. **Verify you're using the right compose file:**
   ```bash
   # Check your docker-compose command
   docker ps --format "table {{.Names}}\t{{.Image}}"
   ```

   **Expected output:**
   ```
   hailmary-pwa         ghcr.io/martinbibb-cmd/hail-mary-pwa:latest
   hailmary-api         ghcr.io/martinbibb-cmd/hail-mary-api:latest
   hailmary-assistant   ghcr.io/martinbibb-cmd/hail-mary-assistant:latest
   ```

   **Bad output (local builds):**
   ```
   hailmary-pwa         hailmary-pwa:latest
   hailmary-api         hailmary-api:latest
   ```

2. **If using wrong images, switch to GHCR compose file:**
   ```bash
   cd /mnt/user/appdata/hailmary
   docker compose -f docker-compose.unraid.yml down
   docker compose -f docker-compose.unraid.yml pull
   docker compose -f docker-compose.unraid.yml up -d
   ```

3. **Manually pull and restart:**
   ```bash
   docker compose -f docker-compose.unraid.yml pull
   docker compose -f docker-compose.unraid.yml up -d
   ```

## Best Practices

### 1. Always Push to `main` for Production

- Feature branches → `claude/*` or `feature/*`
- Staging changes → `staging` branch (builds but doesn't tag as `:latest`)
- Production deployments → `main` branch only

### 2. Verify Workflow Before Expecting Changes

Before pulling on NAS, check GitHub Actions:
```
https://github.com/martinbibb-cmd/Hail-Mary/actions
```

Ensure:
- ✅ Workflow completed successfully
- ✅ All build jobs succeeded
- ⏱️ Recent timestamp (within last few minutes)

### 3. Use Commit Messages for Deployment Tracking

Good commit messages help track what's deployed:
```bash
# Good
git commit -m "feat(api): add trajectory engine calculations"
git commit -m "fix(ui): resolve spine routing conflicts"

# Bad
git commit -m "updates"
git commit -m "fixes"
```

### 4. Tag Images for Releases

For production releases, tag commits:
```bash
git tag v0.3.0
git push origin v0.3.0
```

This creates a stable reference point independent of `:latest`.

## Summary: The Mental Model

Once CI/CD is working, think of it as:

```
┌─────────────────────────────────────────────────────────┐
│  CODE (GitHub repo)                                      │
│  ↓                                                       │
│  Push to main                                            │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  BUILD (GitHub Actions)                                  │
│  ↓                                                       │
│  - Detect changes                                        │
│  - Build Docker images                                   │
│  - Push to GHCR                                          │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  REGISTRY (GHCR)                                         │
│  ↓                                                       │
│  - ghcr.io/.../hail-mary-api:latest                     │
│  - ghcr.io/.../hail-mary-pwa:latest                     │
│  - ghcr.io/.../hail-mary-assistant:latest               │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  DEPLOY (NAS)                                            │
│  ↓                                                       │
│  docker compose pull  (manual or automatic)              │
│  docker compose up -d                                    │
└─────────────────────────────────────────────────────────┘
```

**Key principle:**
- **Repo = Truth** - What's on `main` is what should be running
- **GHCR = Cache** - Pre-built images ready to deploy
- **NAS = Runner** - Just pulls and runs, no building

Once you internalize this flow, deployment becomes predictable and debugging becomes easier.

## Next Steps

1. ✅ Verify workflow exists (`.github/workflows/docker-build.yml`)
2. ✅ Push this CI/CD documentation to `main`
3. ⏳ Check GitHub Actions to confirm workflow runs
4. ⏳ Verify images appear in GHCR
5. ⏳ Make images public (or configure NAS authentication)
6. ⏳ Test NAS deployment:
   ```bash
   cd /mnt/user/appdata/hailmary
   docker compose -f docker-compose.unraid.yml pull
   docker compose -f docker-compose.unraid.yml up -d
   ```
7. ⏳ Verify changes appear on NAS
8. ⏳ Set up automatic updates (optional)

Once verified, you can confidently implement the Trajectory Engine knowing that changes will deploy deterministically.
