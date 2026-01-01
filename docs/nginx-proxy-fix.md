# Nginx Proxy Configuration Fix

## Problem Summary

The `/api/` proxy was returning 404 errors because nginx was stripping the `/api` prefix when proxying to the backend API.

### Root Cause

The PWA container's built-in `/etc/nginx/nginx.conf` contained a hard-coded server block with:
```nginx
location /api/ {
    proxy_pass http://api_backend/;  # ❌ Trailing slash strips /api
}
```

This caused nginx to:
1. Remove `/api` from the request path
2. Proxy `/api/auth/config` → `http://api_backend/auth/config` ❌
3. Express API returns 404 because it expects `/api/auth/config`

### Why the Mounted Config Was Ignored

The docker-compose only mounted `default.conf`:
```yaml
volumes:
  - ./packages/pwa/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
```

However, the container's built-in `nginx.conf` didn't include the `conf.d` directory. Instead, it had a hard-coded server block that took precedence.

## Solution

Mount **both** `nginx.conf` and `default.conf` from the repo:

```yaml
volumes:
  # nginx.conf includes the conf.d directory, allowing default.conf to define the server block
  - ./packages/pwa/nginx.conf:/etc/nginx/nginx.conf:ro
  - ./packages/pwa/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
```

This ensures:
1. The repo's `nginx.conf` (which includes `/etc/nginx/conf.d/*.conf`) is used
2. The repo's `default.conf` (which has the correct `proxy_pass http://api_backend;` without trailing slash) is loaded
3. Nginx correctly proxies `/api/auth/config` → `http://api_backend/api/auth/config` ✅

## Deployment Instructions

### On Unraid Server

1. **Pull the latest changes:**
   ```bash
   cd /mnt/user/appdata/hailmary
   git pull
   ```

2. **Recreate the PWA container:**
   ```bash
   docker-compose -f docker-compose.unraid.yml down hailmary-pwa
   docker-compose -f docker-compose.unraid.yml up -d hailmary-pwa
   ```

3. **Verify the fix:**
   ```bash
   # Should return 200 OK with config data
   curl -sS -i http://localhost:8080/api/auth/config | head -n 1

   # Should see: HTTP/1.1 200 OK
   ```

4. **Test from browser:**
   - Navigate to your Hail-Mary PWA
   - Login should now work correctly

### Verify Nginx Configuration

Check that nginx is using the mounted configs:

```bash
# 1. Verify mounts
docker inspect hailmary-pwa --format '{{json .Mounts}}' | jq

# 2. Verify nginx.conf includes conf.d
docker exec hailmary-pwa grep -n "include /etc/nginx/conf.d" /etc/nginx/nginx.conf

# 3. Verify proxy_pass is correct (no trailing slash)
docker exec hailmary-pwa grep -n "proxy_pass http://api_backend" /etc/nginx/conf.d/default.conf

# 4. Check running config
docker exec hailmary-pwa nginx -T 2>/dev/null | grep -A3 "location /api/"
```

Expected output for step 4:
```nginx
location /api/ {
    proxy_pass http://api_backend;  # ✅ No trailing slash
    proxy_set_header Host $host;
    ...
}
```

## Technical Details

### The Trailing Slash Issue

Nginx proxy_pass behavior:
- `proxy_pass http://backend/;` → Strips the location path
  - `/api/auth/config` → `http://backend/auth/config` ❌
- `proxy_pass http://backend;` → Preserves the full URI
  - `/api/auth/config` → `http://backend/api/auth/config` ✅

### Files Modified

- ✅ `docker-compose.yml` - Added nginx.conf mount
- ✅ `docker-compose.unraid.yml` - Added nginx.conf mount
- ✅ `docker-compose.prod.yml` - Added nginx.conf mount
- ✅ `docker-compose.local.yml` - Added nginx.conf mount
- ✅ `docker-compose.unraid-build.yml` - Added nginx.conf mount

### Files Already Correct

- ✅ `packages/pwa/nginx.conf` - Includes conf.d directory (line 34)
- ✅ `packages/pwa/nginx/default.conf` - Correct proxy_pass without trailing slash (line 32)

## Prevention

This fix ensures that:
1. All nginx configuration is version-controlled and mounted from the host
2. Container restarts will always use the correct configuration
3. No manual editing of container files is needed
4. Configuration changes can be tested and committed to git

## Rollback

If issues occur, rollback by:
```bash
cd /mnt/user/appdata/hailmary
git checkout HEAD~1
docker-compose -f docker-compose.unraid.yml restart hailmary-pwa
```
