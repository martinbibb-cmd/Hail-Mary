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

### 2.2: Add API Route

Add a new hostname for API requests:

**Configuration:**
- **Subdomain**: Your domain (e.g., `atlas`)
- **Domain**: Your domain (e.g., `cloudbibb.uk`)
- **Path**: `/api/*`
- **Service**: `http://192.168.5.196:3001`

**Replace `192.168.5.196` with your actual server IP address.**

Click **Save hostname**.

### 2.3: Configure Catch-All Route

Ensure your existing catch-all route is configured:

**Configuration:**
- **Subdomain**: Your domain (e.g., `atlas`)
- **Domain**: Your domain (e.g., `cloudbibb.uk`)
- **Path**: (leave empty for catch-all)
- **Service**: `http://192.168.5.196:8080`

**Replace `192.168.5.196` with your actual server IP address.**

### 2.4: Verify Route Order

**CRITICAL:** The route order matters! Routes are processed top to bottom.

Ensure your routes are in this order:
1. **First**: `atlas.cloudbibb.uk/api/*` → `http://192.168.5.196:3001`
2. **Second**: `atlas.cloudbibb.uk` → `http://192.168.5.196:8080` (catch-all)

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
# Test health endpoint (should return 200 OK with JSON)
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

### Cloudflare Access (Optional)

For additional security, consider setting up Cloudflare Access policies:

1. Go to **Access** → **Applications**
2. Create a self-hosted application
3. Apply access policies (e.g., email domain restrictions)

## Additional Resources

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Hail-Mary Deployment Guide](./docs/DEPLOYMENT-unRAID.md)
- [Docker Compose Setup](./DOCKER_COMPOSE_SETUP.md)

## Summary

After completing these steps:
- ✅ Port 3001 is exposed from the hailmary-api container
- ✅ Cloudflare tunnel routes `/api/*` directly to port 3001
- ✅ All other routes go through PWA/nginx on port 8080
- ✅ API requests bypass nginx proxy for better performance
- ✅ Authentication works correctly (401/403 instead of 502)
