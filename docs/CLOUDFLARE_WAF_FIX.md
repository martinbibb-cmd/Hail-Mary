# Cloudflare WAF Fix for PWA White Screen

## Problem

Cloudflare was injecting JavaScript challenges (`/cdn-cgi/challenge-platform/scripts/jsd/main.js`) into the PWA, causing:
- Module scripts (`/assets/index-*.js`) to be served as HTML challenge pages instead of JavaScript
- Browser silently failing to execute modules → white screen
- Service worker and module preload caching interference

**Evidence**: Screenshot showed `/cdn-cgi/challenge-platform/scripts/jsd/main.js` injected into index.html

## Root Cause

Cloudflare's security features (Bot Fight Mode, Browser Integrity Check, or JS Challenge) were treating legitimate PWA asset requests as potential threats, serving HTML challenge pages instead of the actual JavaScript/CSS bundles.

## Fix: Cloudflare Dashboard Configuration

### Step 1: Create WAF Custom Rule

Navigate to: **Cloudflare Dashboard → Security → WAF → Custom Rules**

**Rule Configuration:**

- **Name**: Skip challenges for PWA static assets
- **Condition**:
  ```
  (http.host eq "atlas.cloudbibb.uk") and
  (
    http.request.uri.path starts_with "/assets/" or
    http.request.uri.path eq "/sw.js" or
    http.request.uri.path eq "/manifest.webmanifest" or
    http.request.uri.path eq "/vite.svg" or
    http.request.uri.path starts_with "/apple-touch-icon"
  )
  ```
- **Action**: Skip
- **Skip the following**:
  - ✅ Managed Challenge
  - ✅ JS Challenge
  - ✅ Browser Integrity Check
  - ✅ Bot Fight Mode (if enabled)
  - ✅ Super Bot Fight Mode (if enabled)

### Step 2: Disable Aggressive Security Features

Navigate to: **Cloudflare Dashboard → Security**

For hostname `atlas.cloudbibb.uk`, ensure:
- ❌ **Bot Fight Mode**: OFF
- ❌ **Super Bot Fight Mode**: OFF (if present)
- ❌ **Browser Integrity Check**: OFF
- ❌ **Under Attack Mode**: OFF

### Step 3: Verification

After applying the rules:

1. **From command line** (on NAS or local machine):
   ```bash
   curl -s https://atlas.cloudbibb.uk/assets/index--lyldVgq.js | head -n 1
   ```
   **Expected**: JavaScript code starting with `(()=>{` or `const` or `import`
   **Not**: `<!DOCTYPE html>` or `cdn-cgi/challenge`

2. **Check headers**:
   ```bash
   curl -I https://atlas.cloudbibb.uk/assets/index--lyldVgq.js
   ```
   **Expected**: `content-type: application/javascript` or `text/javascript`
   **Not**: `content-type: text/html`

3. **On iPhone/iPad** (after fix):
   - Settings → Safari → Advanced → Website Data
   - Find and delete `atlas.cloudbibb.uk`
   - This clears the stuck service worker cache
   - Hard refresh the app

### Alternative: Temporary Blanket Skip (for testing)

If you want to quickly test if Cloudflare is the issue:

Create a simpler rule:
- **Condition**: `http.host eq "atlas.cloudbibb.uk"`
- **Action**: Skip all security features

⚠️ **Warning**: This disables all security for the hostname. Only use temporarily for diagnosis.

## Expected Outcome

- PWA assets are served as actual JavaScript/CSS files
- No more white screen on iOS devices
- Service worker caches correctly
- Module scripts execute properly

## Next Steps

After this fix, the remaining `/api/auth/login 404` issue needs to be addressed separately. That's a different problem related to:
- API route mounting (auth at `/auth/*` vs `/api/auth/*`)
- nginx proxy configuration (path rewriting)
- Auth router deployment

---

**Note**: This fix requires manual Cloudflare dashboard changes. It cannot be automated via the repository.
