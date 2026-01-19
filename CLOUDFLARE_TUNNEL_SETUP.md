# Cloudflare Tunnel Setup for Hail-Mary

This guide walks through the complete setup process for routing API requests through Cloudflare Zero Trust tunnel directly to the API service.

## Overview

The Hail-Mary application exposes two ports:
- **Port 8080**: PWA/UI service (nginx reverse proxy)
- **Port 3001**: API service (direct access)

For optimal performance, API requests (`/api/*`) should be routed directly to port 3001, while all other requests go through the PWA service on port 8080.

## Step 1: Update Docker Compose Configuration

The docker-compose files have been updated to expose port 3001 on the host. When you deploy or update your stack:

```bash
# For unRAID (using pre-built images)
docker compose -f docker-compose.unraid.yml up -d

# For unRAID (building locally)
docker compose -f docker-compose.unraid-build.yml up -d --build

# For other deployments
docker compose -f docker-compose.prod.yml up -d
```

### Verify Port Exposure

After deployment, verify that port 3001 is exposed:

```bash
# Check that the API port is exposed on the host
docker ps | grep hailmary-api

# Expected output should show: 0.0.0.0:3001->3001/tcp
```

### Test Local Access

Confirm the API is reachable on the host:

```bash
# Replace 192.168.5.196 with your actual server IP
curl -i http://192.168.5.196:3001/health

# Expected: Should return JSON with health status
```

## Step 2: Configure Cloudflare Zero Trust Tunnel

### 2.1: Access Tunnel Configuration

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks** → **Tunnels**
3. Select your existing tunnel (e.g., `competent_pike` or your tunnel name)
4. Click **Public Hostnames** tab

**IMPORTANT:** Ensure `atlas.cloudbibb.uk` and `atlas-api.cloudbibb.uk` are assigned to **exactly ONE tunnel**. 
- Remove any duplicate Public Hostnames / Published Routes for these hostnames on any other tunnel.
- Confirm DNS records for these hostnames are CNAME → `<tunnel-uuid>.cfargotunnel.com` (not LAN IP).

### 2.2: Configure API Subdomain (Recommended)

For direct API access, configure a dedicated API subdomain:

**Configuration for atlas-api.cloudbibb.uk:**
- **Subdomain**: `atlas-api`
- **Domain**: `cloudbibb.uk`
- **Path**: (leave empty)
- **Service**: `http://192.168.5.196:3001`

**Replace `192.168.5.196` with your actual server IP address.**

Click **Save hostname**.

### 2.3: Add API Route (Alternative/Additional)

Alternatively or additionally, add a path-based route for API requests on the main domain:

**Configuration for atlas.cloudbibb.uk/api/*:**
- **Subdomain**: `atlas`
- **Domain**: `cloudbibb.uk`
- **Path**: `/api/*`
- **Service**: `http://192.168.5.196:3001`

**Replace `192.168.5.196` with your actual server IP address.**

Click **Save hostname**.

### 2.4: Configure Catch-All Route

Ensure your existing catch-all route is configured:

**Configuration:**
- **Subdomain**: `atlas`
- **Domain**: `cloudbibb.uk`
- **Path**: (leave empty for catch-all)
- **Service**: `http://192.168.5.196:8080`

**Replace `192.168.5.196` with your actual server IP address.**

### 2.5: Verify Route Order

**CRITICAL:** The route order matters! Routes are processed top to bottom.

Ensure your routes are in this order:
1. **First** (if using dedicated API subdomain): `atlas-api.cloudbibb.uk` → `http://192.168.5.196:3001`
2. **Second** (if using path-based routing): `atlas.cloudbibb.uk/api/*` → `http://192.168.5.196:3001`
3. **Last**: `atlas.cloudbibb.uk` → `http://192.168.5.196:8080` (catch-all)

If they're in the wrong order, use the drag handle to reorder them.

## Step 3: Restart Tunnel Connector

After making changes to the tunnel configuration:

```bash
# Find your tunnel connector container name
docker ps | grep cloudflared

# Restart the tunnel connector
docker restart competent_pike
# (or replace with your actual container name)
```

## Step 4: Validate the Setup

Test that routing is working correctly:

### Test API Endpoints

```bash
# Test API subdomain health endpoint (if configured)
curl -i https://atlas-api.cloudbibb.uk/health

# Test path-based API routing (should return 200 OK with JSON)
curl -i https://atlas.cloudbibb.uk/api/health

# Test authentication endpoint (should return 401/403, NOT 502)
curl -i https://atlas.cloudbibb.uk/api/auth/me
```

### Test UI Access

```bash
# Test UI access (should return 200 OK with HTML)
curl -i https://atlas.cloudbibb.uk

# Test that non-API routes still work
curl -i https://atlas.cloudbibb.uk/dashboard
```

## Troubleshooting

### Getting 502 Bad Gateway

If you receive a 502 error:

1. **Check API service is running:**
   ```bash
   docker ps | grep hailmary-api
   ```

2. **Check API logs:**
   ```bash
   docker logs hailmary-api
   ```

3. **Verify port is exposed:**
   ```bash
   docker port hailmary-api
   # Should show: 3001/tcp -> 0.0.0.0:3001
   ```

4. **Test local connectivity:**
   ```bash
   curl -i http://localhost:3001/health
   curl -i http://192.168.5.196:3001/health
   ```

### API Route Not Working

If the `/api/*` route is not working:

1. **Check route order in Cloudflare:**
   - API route must be BEFORE the catch-all route

2. **Restart tunnel connector:**
   ```bash
   docker restart competent_pike
   ```

3. **Check tunnel connector logs:**
   ```bash
   docker logs competent_pike
   ```

### Routes Working Locally But Not Through Tunnel

1. **Check Cloudflare tunnel status:**
   - Go to Cloudflare Zero Trust Dashboard
   - Verify tunnel shows as "HEALTHY"

2. **Verify DNS settings:**
   - Ensure your domain's DNS is proxied through Cloudflare (orange cloud)

3. **Check firewall rules:**
   - Ensure no firewall is blocking connections between tunnel and services

## Security Considerations

### JWT Authentication

The API service uses JWT authentication. Ensure your `JWT_SECRET` is:
- Set in your `.env` file
- Secure (at least 32 characters)
- Never committed to version control

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Admin Agent Configuration

The admin agent requires proper token configuration for system updates:

1. **Generate a secure token** if you haven't already:
   ```bash
   openssl rand -hex 32
   # OR
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Configure the token** in your `.env` file:
   ```bash
   ADMIN_AGENT_TOKEN=your-secure-64-character-hex-token-here
   ```

3. **Restart the stack** after changing the token:
   ```bash
   docker compose down
   docker compose up -d
   ```

4. **Verify admin agent availability:**
   - Log in to the admin UI at `https://atlas.cloudbibb.uk/admin/server`
   - The UI should no longer show "Admin Agent Not Available"

**Note:** The `ADMIN_AGENT_TOKEN` must be configured consistently in your `.env` file. The token is automatically passed to both `hailmary-api` and `hailmary-admin-agent` services via the environment configuration.

### Cloudflare Access (Optional)

For additional security, consider setting up Cloudflare Access policies:

1. Go to **Access** → **Applications**
2. Create a self-hosted application
3. Apply access policies (e.g., email domain restrictions)

## iOS Safari: Clear Website Data

If you've previously accessed the application using the old domain or LAN IP, you need to clear website data to avoid caching issues:

1. **Clear Website Data:**
   - Go to **Settings** → **Safari** → **Advanced** → **Website Data**
   - Search for and remove:
     - `atlas.cloudbibb.uk`
     - Any LAN IP used (e.g., `192.168.6.52`, `192.168.5.196`)
     - `hail_mary.cloudbibb.uk` (if previously used)

2. **Remove PWA (if installed):**
   - If you previously installed the app as a PWA (Progressive Web App), remove it from your home screen
   - After clearing website data and verifying the site loads correctly, you can re-add it as a PWA

3. **Verify loading:**
   - Visit `https://atlas.cloudbibb.uk` in Safari
   - Ensure the application loads without errors
   - Check that login works correctly

## Additional Resources

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Hail-Mary Deployment Guide](./docs/DEPLOYMENT-unRAID.md)
- [Docker Compose Setup](./DOCKER_COMPOSE_SETUP.md)

## Summary

After completing these steps:
- ✅ BASE_URL is set to `https://atlas.cloudbibb.uk` (valid hostname without underscores)
- ✅ Port 3001 is exposed from the hailmary-api container
- ✅ `atlas.cloudbibb.uk` and `atlas-api.cloudbibb.uk` are assigned to exactly ONE tunnel
- ✅ DNS records are CNAME → `<tunnel-uuid>.cfargotunnel.com` (not LAN IP)
- ✅ Cloudflare tunnel routes API requests directly to port 3001 (via subdomain or path)
- ✅ All other routes go through PWA/nginx on port 8080
- ✅ API requests bypass nginx proxy for better performance
- ✅ Authentication works correctly (401/403 instead of 502)
- ✅ ADMIN_AGENT_TOKEN is configured consistently for both API and admin agent
- ✅ Admin agent is available in the UI (no "Admin Agent Not Available" message)
- ✅ iOS Safari cache cleared for atlas.cloudbibb.uk and any LAN IPs
