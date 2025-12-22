# NAS Deployment Update - Code Fixes Now Work! 🎉

## Problem Solved

Previously, code fixes made locally on the NAS weren't appearing in the deployed containers. This has been fixed by adding local build support to the deployment script.

## What Was Fixed

### 1. ✅ File Paths Match unRAID Structure

**Verified:** All file paths correctly use `/mnt/user/appdata/hailmary` structure:
- `scripts/nas-deploy.sh` auto-detects unRAID and sets `DEPLOY_DIR` to `/mnt/user/appdata/hailmary`
- `docker-compose.unraid.yml` uses `${APPDATA_PATH:-/mnt/user/appdata/hailmary}` for volume paths
- PostgreSQL data is stored at `/mnt/user/appdata/hailmary/postgres`

### 2. ✅ No Volumes Overwriting Code

**Verified:** The docker-compose files do NOT mount any application code volumes:
- Only PostgreSQL data is mounted as a persistent volume
- Application code is built into the Docker images (not bind-mounted)
- Database init scripts are mounted read-only and don't affect application code

### 3. ✅ Local Build Support Added

**NEW:** The deployment script now supports building images locally with `--no-cache`:

```bash
# Build images locally from source code
./scripts/nas-deploy.sh --build --no-cache

# Build specific service only
./scripts/nas-deploy.sh --build --no-cache --service api
```

## How to Use

### For Pre-built Images (Default - Pull from GitHub)

```bash
# Standard deployment - pulls latest images from GitHub Container Registry
cd /mnt/user/appdata/hailmary
./scripts/nas-deploy.sh
```

This is best when using official releases pushed to GitHub.

### For Local Code Changes (Build Locally)

```bash
# Deploy with local code changes - builds images from your NAS
cd /mnt/user/appdata/hailmary
./scripts/nas-deploy.sh --build --no-cache
```

Use this when:
- You've made code changes locally on your NAS
- You want to test changes before pushing to GitHub
- Pre-built images are not available
- You need to ensure your code changes are actually built into the images

### All Available Options

```bash
./scripts/nas-deploy.sh [options]

Options:
  --build             Build images locally instead of pulling from registry
  --no-cache          Build without cache (ensures fresh build with latest code)
  --registry-login    Login to GitHub Container Registry before pulling
  --force-recreate    Force recreate containers even if no image changes
  --service <name>    Deploy only a specific service (api, pwa, assistant)
  --help              Show help message
```

### Common Workflows

#### 1. Deploy Latest Official Release
```bash
cd /mnt/user/appdata/hailmary
git pull origin main
./scripts/nas-deploy.sh
```

#### 2. Deploy Your Local Changes
```bash
cd /mnt/user/appdata/hailmary
# Make your code changes...
./scripts/nas-deploy.sh --build --no-cache
```

#### 3. Rebuild Just the API Service
```bash
cd /mnt/user/appdata/hailmary
./scripts/nas-deploy.sh --build --no-cache --service api
```

#### 4. Force Clean Rebuild Everything
```bash
cd /mnt/user/appdata/hailmary
./scripts/nas-deploy.sh --build --no-cache --force-recreate
```

## Technical Details

### How It Works

1. **Argument Parsing:** Script checks for `--build` and `--no-cache` flags
2. **Compose File Selection:** 
   - With `--build`: Uses `docker-compose.unraid-build.yml` (builds locally)
   - Without `--build`: Uses `docker-compose.unraid.yml` (pulls from registry)
3. **Build Process:** When building locally:
   - Uses `docker-compose build` to build images from Dockerfiles
   - Adds `--no-cache` flag when specified to force fresh builds
   - Ensures all code changes are picked up
4. **Deployment:** Containers are recreated with the new images

### Why --no-cache Matters

Without `--no-cache`, Docker may reuse cached layers from previous builds, which can result in:
- Old code being used even though you made changes
- Dependencies not being updated
- Build artifacts from previous builds being included

With `--no-cache`:
- Every layer is built fresh from scratch
- All code changes are guaranteed to be included
- Dependencies are fetched and built anew
- You get exactly what's in your current source code

## Verification

To verify everything is working:

```bash
# 1. Check script syntax
bash -n scripts/nas-deploy.sh

# 2. Test with dry run (check compose file exists)
cd /mnt/user/appdata/hailmary
ls -la docker-compose.unraid-build.yml

# 3. View what would be built
docker-compose -f docker-compose.unraid-build.yml config

# 4. Perform actual deployment
./scripts/nas-deploy.sh --build --no-cache
```

## Summary of Changes

**Files Modified:**
- `scripts/nas-deploy.sh` - Added build support with `--build` and `--no-cache` options

**Key Improvements:**
1. ✅ Verified file paths match unRAID structure (`/mnt/user/appdata/hailmary`)
2. ✅ Confirmed no volumes are overwriting application code
3. ✅ Added local build capability with `docker-compose build --no-cache`
4. ✅ Script auto-selects correct compose file based on build mode
5. ✅ Supports building all services or specific service only

## Migration Notes

**No breaking changes!** The default behavior (pulling from registry) remains the same:

```bash
# This still works exactly as before
./scripts/nas-deploy.sh
```

The new build functionality is **opt-in** via the `--build` flag.
