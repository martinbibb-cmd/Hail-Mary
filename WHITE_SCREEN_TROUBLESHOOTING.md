# White Screen Troubleshooting Guide - NAS Deployment

## Quick Diagnosis

Run these commands from your NAS terminal to identify the issue:

### 1. Check if containers are running
```bash
docker ps | grep hailmary
```
**Expected**: You should see `hailmary-pwa`, `hailmary-api`, and `hailmary-assistant` containers running

### 2. Check PWA container logs
```bash
docker logs hailmary-pwa --tail 50
```
**Look for**: nginx errors or startup issues

### 3. Test if JavaScript files are being served correctly
```bash
curl -s http://localhost:3000/ | grep -o '<script.*src.*>' | head -5
```
**Expected**: Should show script tags with `/assets/` paths

### 4. Verify nginx is serving files (not Cloudflare challenges)
```bash
# Get a JavaScript file path from the HTML
JS_FILE=$(curl -s http://localhost:3000/ | grep -o '/assets/index-[^"]*\.js' | head -1)

# Check what's actually being served
curl -s http://localhost:3000$JS_FILE | head -1
```
**Expected**: Should start with JavaScript code like `(()=>{` or `import`
**Bad**: If it starts with `<!DOCTYPE html>` or contains `cdn-cgi`, you have a Cloudflare issue

## Common Fixes

### Fix 1: Rebuild Docker Images with Latest Code

The recent PWA stability fixes aren't in your running container. Rebuild:

```bash
cd /path/to/Hail-Mary

# Pull latest code
git pull origin main

# Rebuild and restart containers
docker compose down
docker compose build --no-cache hailmary-pwa
docker compose up -d
```

### Fix 2: Cloudflare WAF Blocking Assets

If Cloudflare is serving challenge pages instead of JavaScript:

**Navigate to**: Cloudflare Dashboard → Security → WAF → Custom Rules

**Create new rule**:
- **Name**: Skip challenges for PWA static assets
- **Condition**:
  ```
  (http.host eq "atlas.cloudbibb.uk") and
  (
    http.request.uri.path starts_with "/assets/" or
    http.request.uri.path eq "/sw.js" or
    http.request.uri.path eq "/manifest.webmanifest"
  )
  ```
- **Action**: Skip
- **Skip**: ALL security features (Managed Challenge, JS Challenge, Browser Integrity Check, Bot Fight Mode)

**Also disable** (on Security settings page):
- Bot Fight Mode → OFF
- Browser Integrity Check → OFF
- Under Attack Mode → OFF

### Fix 3: Clear Service Worker Cache (On Your Device)

If you're accessing from iPhone/iPad:

1. Settings → Safari → Advanced → Website Data
2. Find and delete `atlas.cloudbibb.uk`
3. Close Safari completely
4. Reopen and hard refresh (pull down from top)

For desktop browsers:
1. Open Developer Tools (F12)
2. Application tab → Service Workers
3. Click "Unregister" for the service worker
4. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Fix 4: Check .env File Configuration

Ensure your `.env` file has:
```bash
DATABASE_URL=postgresql://hailmary:yourpassword@hailmary-postgres:5432/hailmary
BASE_URL=https://atlas.cloudbibb.uk
PWA_PORT=3000
```

## Verification After Fix

### 1. Test locally on NAS
```bash
curl -I http://localhost:3000/ | grep -i cache-control
# Should show: cache-control: no-cache, no-store, must-revalidate
```

### 2. Test manifest MIME type
```bash
curl -I http://localhost:3000/manifest.webmanifest | grep content-type
# Should show: content-type: application/manifest+json
```

### 3. Test from external URL
```bash
curl -I https://atlas.cloudbibb.uk/ | grep -i cache-control
```

### 4. Test JavaScript assets
```bash
curl -s https://atlas.cloudbibb.uk/ | grep -o '/assets/index-[^"]*\.js' | head -1 | xargs -I {} curl -s https://atlas.cloudbibb.uk{} | head -1
# Should show JavaScript code, NOT HTML
```

## Still Not Working?

### Get detailed logs:
```bash
# PWA container logs
docker logs hailmary-pwa --tail 100

# API container logs
docker logs hailmary-api --tail 100

# Check container health
docker inspect hailmary-pwa | grep -A 10 Health

# Check nginx error logs inside container
docker exec hailmary-pwa cat /var/log/nginx/error.log
```

### Check network connectivity:
```bash
# From PWA container, check if it can reach API
docker exec hailmary-pwa wget -O- http://hailmary-api:3001/health

# From PWA container, check if it can reach assistant
docker exec hailmary-pwa wget -O- http://hailmary-assistant:3002/health
```

## Most Likely Causes (In Order)

1. **Docker images are outdated** → Rebuild with `docker compose build --no-cache`
2. **Cloudflare WAF blocking assets** → Add WAF skip rule (see Fix 2)
3. **Service worker cached old version** → Clear browser cache (see Fix 3)
4. **Containers not running** → Check with `docker ps` and restart with `docker compose up -d`
5. **Build failed in container** → Check logs with `docker logs hailmary-pwa`

## Emergency Debug

If you need to see what error is causing the white screen, add this to your browser console:

```javascript
// Check for errors
window.addEventListener('error', e => console.error('ERROR:', e));
window.addEventListener('unhandledrejection', e => console.error('PROMISE ERROR:', e));

// Check what files failed to load
performance.getEntriesByType('resource').filter(r => r.transferSize === 0)
```

---

**Next Step**: Start with Fix 1 (rebuild Docker images), then check your browser and Cloudflare settings.
