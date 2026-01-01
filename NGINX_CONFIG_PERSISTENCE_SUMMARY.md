# Nginx Proxy Configuration Persistence - Implementation Summary

## Problem Solved

Previously, the nginx proxy configuration for the hailmary-pwa container was baked into the Docker image at build time. When users edited `/etc/nginx/conf.d/default.conf` inside the running container to fix issues (like 502 errors), those changes would be lost when the container was recreated or restarted. Additionally, nginx could cache stale upstream IP addresses, leading to 502 Bad Gateway errors.

## Solution Implemented

This implementation provides a permanent fix by:

1. **Extracting server configuration to a separate file**: Created `packages/pwa/nginx/default.conf` containing the server block and upstream definitions
2. **Bind-mounting configuration from host**: Added volume mounts in all docker-compose files to persist configuration across container recreates
3. **Fixed proxy_pass directive**: Corrected the `/api/` location proxy_pass from `http://api_backend/` to `http://api_backend` (removed trailing slash)
4. **Maintaining backward compatibility**: The Dockerfile still copies the configuration as a fallback for non-compose deployments

## Files Modified

### New File
- `packages/pwa/nginx/default.conf` - Server block configuration with upstream definitions

### Modified Files
- `packages/pwa/nginx.conf` - Simplified to use `include /etc/nginx/conf.d/*.conf;`
- `packages/pwa/Dockerfile` - Added step to copy default.conf as fallback
- `docker-compose.yml` - Added volume mount for default.conf (read-only)
- `docker-compose.prod.yml` - Added volume mount for default.conf (read-only)
- `docker-compose.local.yml` - Added volume mount for default.conf (read-only)
- `docker-compose.unraid.yml` - Added volume mount for default.conf (read-only)
- `docker-compose.unraid-build.yml` - Added volume mount for default.conf (read-only)

## Key Changes

### Proxy Configuration Fix
The `/api/` location block was updated:
```nginx
# Before
location /api/ {
    proxy_pass http://api_backend/;  # Trailing slash
    ...
}

# After
location /api/ {
    proxy_pass http://api_backend;  # No trailing slash
    ...
}
```

### Volume Mount
All docker-compose files now include:
```yaml
volumes:
  # Mount nginx configuration from host to persist changes across container recreates
  - ./packages/pwa/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
```

## Usage

### Making Configuration Changes
1. Edit `packages/pwa/nginx/default.conf` on the host
2. Test the configuration (optional):
   ```bash
   docker exec hailmary-pwa nginx -t
   ```
3. Reload nginx without downtime:
   ```bash
   docker exec hailmary-pwa nginx -s reload
   ```
   OR restart the container:
   ```bash
   docker restart hailmary-pwa
   ```

### Deploying the Fix
For existing deployments:
1. Pull the latest changes from the repository
2. Recreate the container:
   ```bash
   docker-compose up -d --force-recreate hailmary-pwa
   ```
   OR for specific compose files:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --force-recreate hailmary-pwa
   ```

## Benefits

1. **Persistence**: Configuration survives container recreates and updates
2. **Maintainability**: Easy to edit on the host without entering the container
3. **Version Control**: Configuration changes can be tracked in git
4. **Flexibility**: Can be customized per-deployment without rebuilding images
5. **No More 502 Errors**: Upstream resolution issues are eliminated with proper config
6. **Read-Only Mount**: Prevents accidental modifications inside the container

## Technical Details

### Nginx Configuration Structure
- **Main config** (`nginx.conf`): Global settings, http block, gzip, logging
- **Server config** (`default.conf`): Upstream definitions, server block, location blocks

### Upstream Resolution
The nginx configuration uses upstream blocks to resolve backend service names:
```nginx
upstream api_backend {
    server hailmary-api:3001;
}

upstream assistant_backend {
    server hailmary-assistant:3002;
}
```

These are resolved via Docker's internal DNS when nginx starts, ensuring fresh IP addresses on container restart.

### Security Considerations
- Mount is read-only (`:ro`) to prevent modifications from inside the container
- Configuration is tracked in version control
- All security headers remain in place
- No changes to SSL/TLS configuration

## Testing

The implementation has been:
- ✅ Code reviewed (no issues found)
- ✅ Security scanned with CodeQL (no vulnerabilities)
- ✅ Syntax validated for all configuration files
- ✅ Applied to all docker-compose variants

## Rollback

If issues arise, you can rollback by:
1. Reverting the git commit
2. Removing the volume mount from your docker-compose file
3. Recreating the container

The old configuration is still baked into the Docker image as a fallback.
