# PWA Stability Fixes - Implementation Summary

## Problem Statement

The PWA was experiencing three critical stability issues that could cause inconsistent behavior and iOS white screen of death (WSoD) after updates:

1. **Missing static files**: `/vite.svg` was referenced in `index.html` but didn't exist, causing nginx to return HTML fallback instead of 404
2. **Wrong manifest MIME type**: `.webmanifest` files were being served as `application/octet-stream` instead of `application/manifest+json`
3. **No HTML cache control**: The root HTML had no cache headers, allowing iOS to cache old HTML that points to missing/new bundles

## Root Cause Analysis

### Why the icon worked despite wrong manifest MIME

iOS Safari uses two mechanisms:
- `apple-touch-icon.png` (which exists and returns `200 image/png`) ✅
- Web manifest (which was being served with wrong MIME type)

Result: Icon worked via `apple-touch-icon.png`, but manifest was inconsistently handled.

### The iOS WSoD Problem

When HTML is cached indefinitely:
1. User visits site, HTML cached by iOS
2. Deploy new version with new JS bundle filenames
3. Cached HTML still references OLD bundle filenames
4. Old bundles deleted or renamed
5. Result: White screen (404 on bundles)

## Solution Implemented

### 1. Removed Missing File Reference (index.html)

**Changed:** Removed `<link rel="icon" type="image/svg+xml" href="/vite.svg" />`

**Why:** File doesn't exist, causing nginx SPA fallback to serve HTML instead of proper 404

**Impact:** Prevents unnecessary HTML responses for missing assets

### 2. Added Correct Manifest MIME Type (nginx.conf)

**Added:**
```nginx
location ~ \.webmanifest$ {
    add_header Content-Type "application/manifest+json";
    expires 1d;
    add_header Cache-Control "public";
}
```

**Why:** Browsers require `application/manifest+json` MIME type to properly parse web manifests

**Impact:** Ensures consistent PWA behavior across all browsers and iOS versions

### 3. Added No-Cache Headers for HTML (nginx.conf)

**Added:**
```nginx
# Root HTML - no cache to prevent iOS white screen after updates
location = / {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
    try_files /index.html =404;
}

# index.html - no cache to prevent iOS white screen after updates
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}
```

**Why:** Prevents iOS from caching HTML that references outdated JS bundles

**Impact:** Eliminates the #1 cause of iOS PWA white screens after deployment

## Nginx Location Priority

Understanding nginx location matching priority is crucial:

1. **Exact match** `location = /` - Highest priority
2. **Regex match** `location ~ \.webmanifest$` - High priority
3. **Prefix match** `location /` - Lower priority (fallback for SPA routing)

This means:
- Request to `/` → Uses exact match (no cache, serves index.html)
- Request to `/index.html` → Uses exact match (no cache)
- Request to `/manifest.webmanifest` → Uses regex match (correct MIME type)
- Request to `/some/route` → Uses prefix match (SPA fallback to index.html)

## Caching Strategy

| Resource Type | Cache Duration | Rationale |
|--------------|----------------|-----------|
| HTML (/, index.html) | No cache | Allow instant updates, prevent WSoD |
| Service Worker (sw.js) | No cache | Allow instant SW updates |
| Manifest (.webmanifest) | 1 day | Balance updates vs performance |
| Static assets (/assets/*) | 1 year immutable | Vite uses content hashes in filenames |

## Verification

Build test passed:
```
✓ 1096 modules transformed
✓ built in 3.91s
PWA v1.2.0
```

Verified:
- [x] No `vite.svg` reference in built `index.html`
- [x] `manifest.webmanifest` present in dist
- [x] No missing static file references
- [x] Build succeeds without errors
- [x] CodeQL security scan passed

## Files Changed

1. `packages/pwa/index.html` - Removed 1 line (vite.svg reference)
2. `packages/pwa/nginx.conf` - Added 24 lines (manifest MIME type + HTML no-cache)

## Testing Recommendations

When deployed, verify:

1. **Manifest MIME type:**
   ```bash
   curl -I https://your-domain.com/manifest.webmanifest | grep content-type
   # Should show: content-type: application/manifest+json
   ```

2. **HTML no-cache:**
   ```bash
   curl -I https://your-domain.com/ | grep -i cache
   # Should show: cache-control: no-cache, no-store, must-revalidate
   ```

3. **Assets still cached:**
   ```bash
   curl -I https://your-domain.com/assets/index-*.js | grep -i cache
   # Should show: cache-control: public, immutable
   ```

4. **No HTML fallback for missing files:**
   ```bash
   curl -I https://your-domain.com/vite.svg
   # Should show: 404 Not Found (not 200 with text/html)
   ```

## Additional Notes

- The `apple-touch-icon.png` continues to work and provides iOS icon fallback
- Vite PWA plugin generates the manifest at build time
- Service worker continues to have no-cache headers as before
- All static assets in `/assets/` retain their 1-year immutable caching

## References

- Problem statement discussion: Issue #[number]
- Nginx location directive priority: https://nginx.org/en/docs/http/ngx_http_core_module.html#location
- Web manifest spec: https://w3c.github.io/manifest/
- PWA best practices: https://web.dev/pwa-checklist/
