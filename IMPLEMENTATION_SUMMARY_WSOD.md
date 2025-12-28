# WSOD Hardening & Migration Baseline - Implementation Summary

## Overview

This implementation addresses the WSOD (White Screen of Death) issue on iOS/Safari PWA and establishes a clean migration path to a new Docker host (Beelink).

**Status**: ✅ Complete

**Date**: 2025-12-28

---

## Changes Made

### 1. Nginx Cache Headers (WSOD Fix)

**File**: `packages/pwa/nginx.conf`

**Changes**:
- **index.html**: Changed to `Cache-Control: no-store` (was: `no-cache, no-store, must-revalidate`)
- **manifest.webmanifest**: Changed to `Cache-Control: no-store` (was: `public` with 1-day expiry)
- **Hashed assets** (/assets/*): Changed to `Cache-Control: public, max-age=31536000, immutable` (was: `public, immutable`)
- **Service worker** (sw.js): Kept as `Cache-Control: no-store` (simplified from multiple directives)

**Rationale**:
- `no-store` on index.html prevents iOS Safari/PWA from serving stale app shells after deployments
- `no-store` on manifest prevents iOS PWA "stuck behavior" where the app launches with old configuration
- `immutable` on hashed assets prevents unnecessary revalidation since file names change on updates
- Simpler cache headers reduce edge cases and browser quirks

### 2. Service Worker Immediate Updates

**File**: `packages/pwa/vite.config.ts`

**Changes**:
- Added `skipWaiting: true` to workbox config
- Added `clientsClaim: true` to workbox config

**Rationale**:
- `skipWaiting()` makes new service worker activate immediately instead of waiting for all tabs to close
- `clientsClaim()` makes new service worker take control of all clients immediately
- Together, these ensure updates propagate instantly without requiring users to close and reopen the PWA

**Verification**: Built service worker contains `self.skipWaiting()` and `e.clientsClaim()` in generated `dist/sw.js`

### 3. Visible Update Banner

**File**: `packages/pwa/src/main.tsx`

**Changes**:
- Added `showUpdateBanner()` function that creates a visible blue banner at top of screen
- Banner displays "🔄 Update available" with a "Reload" button
- Integrated with `registerSW()` to show banner when `onNeedRefresh()` fires
- Button calls `updateSW(true)` to force immediate service worker update

**Rationale**:
- Makes PWA update behavior observable and measurable
- Users can see when an update is available instead of guessing
- Eliminates "mystical" WSOD failures by making the update process explicit

### 4. BUILD_ID Logging

**File**: `packages/pwa/src/main.tsx`

**Changes**:
- Added console logging on app startup:
  ```javascript
  console.log('[App] BUILD_ID:', __APP_VERSION__, 'Built:', __BUILD_TIME__)
  console.log('[App] Build timestamp:', new Date(__BUILD_TIME__).toLocaleString())
  ```

**Rationale**:
- Turns WSOD debugging from "mystical" to "obvious cause within 2 deploys"
- Allows instant verification of which build version loaded
- Enables systematic testing via WSOD test matrix

**Verification**: Built JS contains `BUILD_ID:","0.2.0` and timestamp strings

### 5. Documentation

**File**: `MIGRATION_BASELINE_GUIDE.md` (NEW)

**Contents**:
- Step-by-step Beelink migration instructions
- "Known good" snapshot process
- WSOD test matrix (4 scenarios for iOS/iPad)
- BUILD_ID verification instructions
- Troubleshooting guide
- When to split Brain/Vault services

**File**: `docker-compose.local.yml` (NEW)

**Contents**:
- Local build compose configuration (builds from source)
- Clear comments and usage instructions
- Optimized for Beelink baseline deployment
- No external dependencies (GHCR images)

---

## Testing & Validation

### Build Verification ✅

```bash
npm run build -w packages/shared
npm run build -w packages/surveyor-engine
npm run build -w packages/pwa
```

**Results**:
- ✅ All packages built successfully
- ✅ Service worker generated with `skipWaiting` and `clientsClaim`
- ✅ BUILD_ID and timestamp injected into compiled JS
- ✅ Update banner code compiled and included
- ✅ No TypeScript errors

### Code Review ✅

**Results**:
- ✅ 2 nitpicks addressed
- ✅ Removed redundant `window.location.reload()` call
- ✅ No remaining issues

### Security Scan ✅

**Results**:
- ✅ CodeQL: No vulnerabilities found (0 alerts)
- ✅ No new security issues introduced

### WSOD Test Matrix (Manual - Requires iOS Device)

| Scenario | Expected Result | Status |
|----------|----------------|--------|
| Safari normal tab + hard refresh | Shows new BUILD_ID | ⏸️ Requires deployment |
| PWA (keep alive) | Shows new BUILD_ID or update banner | ⏸️ Requires deployment |
| PWA (kill + reopen) | Shows new BUILD_ID immediately | ⏸️ Requires deployment |
| PWA (network toggle) | Shows new BUILD_ID | ⏸️ Requires deployment |

**Note**: These tests must be performed after deploying to a device/server with iOS/Safari access.

---

## How to Deploy

### Option 1: Local Build (Beelink Baseline)

```bash
# Clone repo
git clone https://github.com/martinbibb-cmd/Hail-Mary.git
cd Hail-Mary

# Configure environment
cp .env.example .env
nano .env  # Set POSTGRES_PASSWORD, JWT_SECRET, DATABASE_URL, etc.

# Build and start
docker compose -f docker-compose.local.yml up -d --build
```

### Option 2: Pre-built Images (Production)

```bash
# Use the default docker-compose.yml (pulls from GHCR)
docker compose up -d
```

---

## How to Verify WSOD Fix

### 1. Check Console Logs

Open browser DevTools (F12) and look for:

```
[App] 🚀 Starting React initialization...
[App] BUILD_ID: 0.2.0 Built: 2025-12-28T11:48:39.285Z
[App] Build timestamp: 12/28/2025, 11:48:39 AM
```

### 2. Check Settings UI

1. Open Settings app (⚙️)
2. Scroll to "About" section
3. Verify Version and Built timestamp match console

### 3. Test Update Banner

1. Deploy new version
2. Open PWA (don't kill it)
3. Wait for service worker to detect update
4. Blue banner should appear at top: "🔄 Update available [Reload]"
5. Click Reload button
6. Check console for new BUILD_ID

### 4. Use Nuclear Button (If Needed)

1. Open Settings app (⚙️)
2. Scroll to "Updates" section
3. Click "🔄 Update & Reload"
4. This clears all caches and reloads

---

## Expected Impact

### Before These Changes

- ❌ iOS/Safari PWA shows white screen after deployments
- ❌ No way to tell which version loaded
- ❌ Service worker updates require closing all tabs
- ❌ Manifest caching causes "stuck" behavior
- ❌ Users must manually clear Safari data

### After These Changes

- ✅ index.html never cached → always loads latest shell
- ✅ manifest never cached → always loads latest PWA config
- ✅ Service worker updates immediately (skipWaiting + clientsClaim)
- ✅ Visible update banner shows when new version available
- ✅ BUILD_ID visible in console and UI for debugging
- ✅ Engineer can force reset with "Update & Reload" button

---

## Migration Path

### Phase 1: Establish Baseline (Now)

1. Deploy to Beelink using `docker-compose.local.yml`
2. Verify stable operation (health endpoints, manual testing)
3. Lock in "known good" snapshot
4. Set up NAS as backup-only (rsync)

### Phase 2: Prove WSOD Dead (Next)

1. Deploy new version to Beelink
2. Run WSOD test matrix on iOS/iPad
3. Verify BUILD_ID changes correctly
4. Verify update banner appears
5. Document results

### Phase 3: Scale (Later)

Only after WSOD is proven dead:
- Consider Brain/Vault service split
- Evaluate multi-host deployment
- Optimize for scale/performance

---

## Files Changed

| File | Lines Changed | Description |
|------|--------------|-------------|
| `packages/pwa/nginx.conf` | ~20 | Hardened cache headers |
| `packages/pwa/vite.config.ts` | +3 | Added skipWaiting + clientsClaim |
| `packages/pwa/src/main.tsx` | +50 | Update banner + BUILD_ID logging |
| `MIGRATION_BASELINE_GUIDE.md` | +286 | Migration & WSOD testing guide |
| `docker-compose.local.yml` | +145 | Local build compose config |

**Total**: ~500 lines added/changed across 5 files

---

## Security Summary

**CodeQL Scan**: ✅ 0 vulnerabilities

**New Code**:
- Update banner uses safe DOM methods (no innerHTML)
- No new external dependencies
- No secrets or credentials added
- All changes are client-side UI improvements

---

## Next Steps

1. ✅ **Complete**: Code changes, documentation, testing
2. ⏭️ **Deploy**: Deploy to Beelink using `docker-compose.local.yml`
3. ⏭️ **Verify**: Run WSOD test matrix on iOS/iPad
4. ⏭️ **Document**: Record results of WSOD testing
5. ⏭️ **Iterate**: If WSOD still occurs, add more diagnostics

---

## References

- Original problem statement: Codex-ready copy box (tighten-clean-migration-plan)
- WSOD test matrix: MIGRATION_BASELINE_GUIDE.md
- Compose files: docker-compose.local.yml, docker-compose.yml
- PWA config: packages/pwa/vite.config.ts
- Nginx config: packages/pwa/nginx.conf

---

## Conclusion

This implementation establishes a **measurable, deterministic** PWA update system and a **clean migration baseline** for Beelink deployment.

The key wins:
1. **index.html non-cacheable** + **BUILD_ID visible** = WSOD goes from "mystical" to "obvious within 2 deploys"
2. **skipWaiting + clientsClaim** = immediate service worker updates
3. **Visible update banner** = observable update behavior
4. **Beelink baseline** = single-machine, minimal-variable starting point

Next: Deploy, test on iOS, and prove WSOD is dead.
