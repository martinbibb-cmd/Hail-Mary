# Migration Baseline & WSOD Hardening Guide

## Overview

This guide establishes a clean migration path for Hail-Mary to a new Docker host (Beelink) with deterministic WSOD (White Screen of Death) debugging.

**Goal**: Establish a known-good baseline on a single machine before reintroducing complexity.

---

## Part 1: Clean Beelink Migration

### Prerequisites

- Fresh Ubuntu installation on Beelink
- Docker + Docker Compose plugin installed
- Network access to GitHub

### Step 1: Initial Setup

```bash
# Install Docker (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect

# Clone the repository
cd /opt
sudo mkdir -p atlas
sudo chown $USER:$USER atlas
cd atlas
git clone https://github.com/martinbibb-cmd/Hail-Mary.git
cd Hail-Mary
```

### Step 2: Configure Environment

Create `.env` file based on `.env.example`:

```bash
cp .env.example .env
nano .env
```

**Required settings**:
- `POSTGRES_PASSWORD`: Generate with `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`
- `JWT_SECRET`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DATABASE_URL`: Update with your `POSTGRES_PASSWORD`
- `PWA_PORT`: Default 3000 (or change if needed)
- `BASE_URL`: Your domain or `http://localhost:3000` for local testing

**Optional settings**:
- `GEMINI_API_KEY`: For AI assistant features
- `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`: Default admin credentials

### Step 3: Build and Start Services

Use the local build compose file (builds from source instead of pulling pre-built images):

```bash
docker compose -f docker-compose.unraid-build.yml up -d --build
```

This will:
1. Build API, Assistant, and PWA from local Dockerfiles
2. Start PostgreSQL
3. Run database migrations and seeding
4. Start all services

### Step 4: Lock in "Known Good" Snapshot

**Before touching any WSOD fixes**, verify baseline stability:

```bash
# Check service status
docker compose -f docker-compose.unraid-build.yml ps

# Check logs (last 200 lines)
docker compose -f docker-compose.unraid-build.yml logs -n 200 --no-log-prefix > baseline-logs.txt

# Test health endpoints
curl http://localhost:3000/health/api
curl http://localhost:3000/health/assistant

# Test PWA access
curl -I http://localhost:3000/
```

**Manual verification**:
1. Open browser to `http://localhost:3000` (or your `BASE_URL`)
2. Log in with admin credentials
3. Navigate to 3-5 key routes:
   - Home
   - Addresses
   - Diary
   - Camera (if applicable)
   - Settings

**If anything is flaky here, fix it first.** WSOD debugging is pointless without a stable baseline.

### Step 5: NAS Backup (Backup Only)

Once stable, set up rsync backup to NAS:

```bash
# From Beelink, backup to NAS
rsync -av --delete /opt/atlas /mnt/nas/backups/hailmary/
```

**Do NOT reintroduce NAS runtime coupling yet.** Keep NAS as backup-only until WSOD is solved.

---

## Part 2: WSOD Testing & Validation

### Understanding WSOD Cache Classes

WSOD can be caused by three different "cache" classes:

**A) Service Worker Mismatch (Classic)**
- Symptoms: White screen after deploy, requests for non-existent chunk files
- Fix: `skipWaiting` + `clientsClaim` in service worker

**B) Manifest / Icon / start_url Cached (iOS PWA Special)**
- Symptoms: Stuck behavior even when SW seems updated
- Fix: Never cache manifest files (`Cache-Control: no-store`)

**C) Reverse Proxy Aggressive Cache Headers**
- Symptoms: Even non-SW loads serve stale index.html
- Fix: `Cache-Control: no-store` for index.html

### WSOD Test Matrix (iOS/iPad Required)

After any deployment, test **all** of these scenarios:

| Scenario | Steps | Expected Result |
|----------|-------|----------------|
| **Safari Normal Tab** | 1. Open Safari<br>2. Navigate to app<br>3. Hard refresh (Cmd+Shift+R or long-press refresh) | Shows new BUILD_ID in console |
| **PWA (Keep Alive)** | 1. Open PWA from home screen<br>2. Don't kill app<br>3. Navigate around | Shows new BUILD_ID (or update banner → reload) |
| **PWA (Kill + Reopen)** | 1. Open PWA<br>2. Kill app (swipe up in app switcher)<br>3. Reopen PWA | Shows new BUILD_ID immediately |
| **PWA (Network Toggle)** | 1. Open PWA<br>2. Toggle Wi-Fi off/on during load | Shows new BUILD_ID (may show update banner) |

**Success criteria**: All scenarios show the new BUILD_ID in console on first load or after update banner reload.

### Checking BUILD_ID

**In Console** (Safari Web Inspector or Chrome DevTools):
```
[App] BUILD_ID: 0.2.0 Built: 2024-01-15T10:30:00.000Z
[App] Build timestamp: 1/15/2024, 10:30:00 AM
```

**In UI**:
1. Open Settings app (⚙️)
2. Scroll to "About" section
3. Check Version and Built timestamp

### Nuclear Button (Engineer-Only)

If you suspect caching issues, use the "Update & Reload" button in Settings:

1. Open Settings app (⚙️)
2. Scroll to "Updates" section
3. Click "🔄 Update & Reload"

This will:
- Unregister all service workers
- Clear all caches
- Clear localStorage and sessionStorage
- Reload the page

---

## Part 3: Verifying WSOD Fixes

### What's Been Fixed

1. **index.html non-cacheable**: `Cache-Control: no-store`
2. **manifest.webmanifest non-cacheable**: `Cache-Control: no-store`
3. **Hashed assets immutable**: `Cache-Control: public, max-age=31536000, immutable`
4. **Service worker immediate updates**: `skipWaiting: true` + `clientsClaim: true`
5. **Visible update banner**: Shows "🔄 Update available → Reload" when new version detected
6. **BUILD_ID logging**: Console logs version and build time on startup
7. **BUILD_ID in UI**: Settings → About shows version and build time

### Post-Deploy Checklist

After any code deployment:

- [ ] Check browser console for BUILD_ID
- [ ] Check Settings → About for version
- [ ] Run WSOD test matrix (4 scenarios above)
- [ ] Verify update banner appears when expected
- [ ] Test "Update & Reload" button in Settings

---

## Part 4: When to Split Brain/Vault

**NOT YET.**

Only split services when:
- ✅ WSOD is completely dead (proven by test matrix)
- ✅ Update flow is reliable (no more "mystical" failures)
- ✅ You need to scale/secure assistant separately
- ✅ You need different public exposure rules per service

Right now, keep topology simple: single-machine, all services in one compose stack.

---

## Troubleshooting

### Issue: White screen after deploy

1. Check browser console for errors
2. Check BUILD_ID - is it the old or new version?
3. Open Settings → Updates → "Update & Reload"
4. If still fails, check nginx logs: `docker compose logs hailmary-pwa`

### Issue: Service worker not updating

1. Check console for `[SW]` messages
2. Verify `skipWaiting: true` in vite.config.ts
3. Check if update banner appeared
4. Use "Update & Reload" button

### Issue: Build fails

1. Check Docker logs: `docker compose logs --tail=100`
2. Verify `.env` file has all required variables
3. Check disk space: `df -h`
4. Try rebuilding: `docker compose down && docker compose up -d --build`

---

## Next Steps

Once baseline is stable and WSOD is proven dead:

1. Document the "known good" configuration
2. Set up automated backups to NAS
3. Consider Cloudflare Tunnel for external access
4. Evaluate multi-host split (Brain/Vault) if needed

---

## Quick Reference

### Commands

```bash
# Build and start
docker compose -f docker-compose.unraid-build.yml up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f

# Restart a service
docker compose restart hailmary-pwa

# Stop all services
docker compose down

# Stop and remove all data (DESTRUCTIVE)
docker compose down -v
```

### File Locations

- Docker Compose: `docker-compose.unraid-build.yml`
- Environment: `.env`
- PWA Nginx Config: `packages/pwa/nginx.conf`
- Service Worker Config: `packages/pwa/vite.config.ts`
- Main Entry: `packages/pwa/src/main.tsx`

### Health Endpoints

- API: `http://localhost:3000/health/api`
- Assistant: `http://localhost:3000/health/assistant`
- PWA: `http://localhost:3000/` (should return HTML)
