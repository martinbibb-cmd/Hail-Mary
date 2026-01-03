# Cache Mitigation & Build Fingerprinting Guide

## Overview

This guide documents the build fingerprinting system and cache mitigation strategies to prevent "changes not changing" issues.

## Build Fingerprinting

### Frontend (PWA)

The PWA includes build metadata that is visible in multiple places:

1. **Build Badge (Bottom-Right Corner)**
   - Fixed position badge showing build SHA and time
   - Click to expand for full details (SHA, build time, environment, version)
   - Always visible across all pages

2. **Build Constants Available**
   ```typescript
   __GIT_SHA__       // Git commit SHA (short)
   __BUILD_TIME__    // ISO timestamp of build
   __BUILD_ENV__     // Environment (production/development)
   __APP_VERSION__   // Package version (0.2.0)
   ```

3. **Automatic Inclusion in Bug Reports**
   - All bug reports automatically capture build metadata
   - Includes frontend SHA, build time, version, and environment
   - Also captures user agent, screen resolution, and viewport

### Backend (API)

The API exposes build metadata via endpoint:

**GET /api/meta/build**

Response example:
```json
{
  "success": true,
  "data": {
    "gitSha": "abc123def",
    "buildTime": "2024-01-03T07:53:51.535Z",
    "env": "production",
    "version": "0.2.0",
    "hostname": "hailmary-api-12345",
    "containerId": "abc123def456",
    "nodeVersion": "v20.19.6"
  }
}
```

## Docker Build Process

### Build Arguments

Both PWA and API Dockerfiles accept build arguments:

```bash
docker build \
  --build-arg GIT_SHA=$(git rev-parse --short HEAD) \
  --build-arg BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  -t hail-mary-pwa:sha-$(git rev-parse --short HEAD) \
  -f packages/pwa/Dockerfile .
```

### GitHub Actions Integration

The `.github/workflows/docker-build.yml` automatically:
1. Passes `GIT_SHA=${{ github.sha }}` to Docker builds
2. Passes `BUILD_TIME=${{ github.event.head_commit.timestamp }}` to Docker builds
3. Tags images with both SHA and `latest`: `ghcr.io/martinbibb-cmd/hail-mary-pwa:sha-abc123`

## Cache Mitigation Strategies

### 1. Verify Build SHA

**Problem**: Not sure what code is running?

**Solution**: 
- Check the build badge (bottom-right corner) on any device
- Compare SHAs across devices (Mac, iPad, iPhone)
- Hit `/api/meta/build` to verify backend SHA

### 2. Service Worker Cache Issues

**Problem**: PWA shows old cached version after deployment

**Solution - Automatic** (Recommended):
- Service Worker automatically detects updates
- Shows blue banner at top: "🔄 Update available [Reload]"
- Click "Reload" to apply update immediately

**Solution - Manual** (Break Glass):
```javascript
// Open browser console on the device and run:

// 1. Unregister service worker
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => registration.unregister())
})

// 2. Clear all caches
caches.keys().then(names => {
  names.forEach(name => caches.delete(name))
})

// 3. Clear local storage
localStorage.clear()
sessionStorage.clear()

// 4. Hard reload
window.location.href = window.location.href + '?v=' + Date.now()
```

### 3. Browser HTTP Cache

**Problem**: Browser caching index.html or assets

**Solution**:
- Force refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Or append version param: `https://atlas.cloudbibb.uk/?v=20260103`

### 4. CDN/Proxy Cache

**Problem**: Cloudflare or nginx caching old assets

**Solution**:
- PWA assets are served with cache-busting filenames (e.g., `index-abc123.js`)
- Service Worker manages its own cache
- If needed, purge Cloudflare cache via dashboard

### 5. Verify Deployment

**Checklist for confirming a deployment succeeded**:

1. ✅ Check GitHub Actions completed successfully
2. ✅ Verify Docker images were pushed (check GHCR)
3. ✅ Check build badge shows new SHA on Mac
4. ✅ Check build badge shows new SHA on iPad  
5. ✅ Check build badge shows new SHA on iPhone
6. ✅ Hit `/api/meta/build` and verify backend SHA matches
7. ✅ Submit test bug report and verify it includes correct SHAs

## Development vs Production

### Development
- Build badge shows `env: development`
- Service Worker disabled (no caching issues in dev)
- Build constants use local git SHA or 'unknown'

### Production
- Build badge shows `env: production`
- Service Worker enabled with auto-update
- Build constants injected from Docker build args (SHA from CI)

## Troubleshooting

### "Build badge shows 'unknown' SHA"

**Causes**:
- Not in a git repository during build
- Docker build didn't receive GIT_SHA build arg
- CI/CD didn't pass SHA to docker build

**Fix**:
- Verify GitHub workflow includes `--build-arg GIT_SHA=${{ github.sha }}`
- Check docker-build.yml has build-args section
- Manually pass SHA when building locally

### "Backend SHA doesn't match frontend SHA"

**Expected**: Frontend and backend SHAs can differ if:
- Changes only touched PWA code (backend not rebuilt)
- Changes only touched API code (frontend not rebuilt)
- Services deployed at different times

**Unexpected**: SHAs differ after full rebuild/deployment
- Check if auto-update pulled latest images
- Verify both services restarted after deployment
- Check docker-compose references `latest` not old SHA tags

### "Update banner never shows"

**Causes**:
- Service Worker disabled (dev mode)
- No new version deployed
- Browser blocked service worker registration

**Debug**:
```javascript
// Check service worker status
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Active SW:', regs.length)
  regs.forEach(reg => console.log('SW state:', reg.active?.state))
})
```

## Best Practices

1. **Always check build badge** before reporting issues
2. **Include SHA in all bug reports** (automatic via form)
3. **Tag Docker images with SHA** for traceability
4. **Never use `latest` in production** (use SHA tags instead)
5. **Verify SHAs match across devices** after deployment
6. **Document expected SHAs** in deployment notes

## Future Enhancements

Potential improvements to consider:

1. **Backend SHA in bug logs**: Automatically fetch and include backend SHA in bug report logs
2. **SHA comparison tool**: Visual diff showing frontend vs backend SHA
3. **Deployment dashboard**: Shows SHAs for all running services
4. **SW active indicator**: Visual badge when service worker is active (dev mode)
5. **Auto-refresh on deploy**: Automatically reload when new version detected (optional)

## Related Files

- Frontend: `packages/pwa/src/components/BuildBadge.tsx`
- Backend: `packages/api/src/routes/meta.ts`
- Vite config: `packages/pwa/vite.config.ts`
- PWA Dockerfile: `packages/pwa/Dockerfile`
- API Dockerfile: `packages/api/Dockerfile`
- CI/CD: `.github/workflows/docker-build.yml`
