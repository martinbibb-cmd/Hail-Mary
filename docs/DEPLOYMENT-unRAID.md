# Hail-Mary unRAID Deployment Guide

This guide explains how to deploy Hail-Mary on unRAID using Docker Compose.

## Prerequisites

- unRAID 6.9+ with Docker enabled
- Docker Compose Manager plugin installed (from Community Applications)
- Cloudflare Tunnel set up (optional, for external access)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        unRAID Server                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Docker Network                           ││
│  │                  (hailmary-network)                         ││
│  │                                                             ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ││
│  │  │   postgres   │  │ hailmary-api │  │hailmary-assistant│  ││
│  │  │   :5432      │  │    :3001     │  │      :3002       │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  ││
│  │         │                  │                   │            ││
│  │         └──────────────────┼───────────────────┘            ││
│  │                            │                                ││
│  │                    ┌───────┴───────┐                        ││
│  │                    │ hailmary-pwa  │                        ││
│  │                    │    (nginx)    │                        ││
│  │                    │     :80       │◄──── External Port 80  ││
│  │                    └───────────────┘                        ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                    Cloudflare Tunnel
                              │
                              ▼
                 https://hailmary.your-domain.com
```

## How Routing Works

The `hailmary-pwa` container runs nginx which handles all routing:

| Request Path | Routed To | Description |
|--------------|-----------|-------------|
| `/` | Static files | Serves the PWA React app |
| `/api/*` | `hailmary-api:3001` | Backend API requests |
| `/assistant/*` | `hailmary-assistant:3002` | AI assistant requests |
| `/stt/*` | `hailmary-assistant:3002` | Speech-to-text requests |
| `/health/api` | `hailmary-api:3001/health` | API health check |
| `/health/assistant` | `hailmary-assistant:3002/health` | Assistant health check |

## Deployment Steps

### Step 1: Install Docker Compose Manager

1. Go to **Apps** in unRAID
2. Search for "Docker Compose Manager"
3. Click **Install**

### Step 2: Clone the Repository

Clone the Hail-Mary repository to your unRAID appdata folder:

```bash
cd /mnt/user/appdata
git clone https://github.com/martinbibb-cmd/Hail-Mary.git hailmary
cd hailmary
```

This creates the application at `/mnt/user/appdata/hailmary`.

### Step 3: Create the Stack

1. Go to **Docker** → **Compose**
2. Click **Add New Stack**
3. Name it: `hailmary`
4. Set the compose file path to `/mnt/user/appdata/hailmary/docker-compose.yml`

### Step 4: Configure Environment Variables

Create a `.env` file in `/mnt/user/appdata/hailmary/` or set these variables in the Docker Compose Manager UI:

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Gemini API key for AI assistant | (empty) |
| `GEMINI_MODEL` | Gemini model to use | `gemini-1.5-flash` |
| `PWA_PORT` | External port for the PWA | `80` |
| `JWT_SECRET` | Secret for JWT tokens | `development-secret-change-in-production` |
| `BASE_URL` | Base URL for the application (change to your domain) | (see docker-compose.yml) |

> **Security Note:** PostgreSQL is configured with trust authentication, meaning no password is required. This is suitable for local/internal deployments where the database is only accessible within the Docker network. For production deployments exposed to the internet, consider adding proper authentication.

#### Example .env file

```bash
# AI Assistant (optional - leave empty if not using AI features)
# GEMINI_API_KEY=your-gemini-api-key
# GEMINI_MODEL=gemini-1.5-flash

# Port configuration (optional)
# PWA_PORT=80

# Security (recommended to change in production)
# JWT_SECRET=your-secure-jwt-secret

# Base URL (change to your domain if using Cloudflare Tunnel)
# BASE_URL=https://your-domain.com
```

### Step 5: Deploy the Stack

1. Click **Deploy Stack** or **Compose Up**
2. Wait for all containers to start (this may take a few minutes on first run)
3. Check container health in the Docker tab

### Step 6: Verify Deployment

Test the deployment locally:

```bash
# Check PWA is running
curl http://unraid-ip:80

# Check API health
curl http://unraid-ip:80/health/api

# Check Assistant health
curl http://unraid-ip:80/health/assistant
```

## Cloudflare Tunnel Setup

To access Hail-Mary from anywhere, set up a Cloudflare Tunnel.

### Step 1: Create Tunnel in Cloudflare

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Access** → **Tunnels**
3. Click **Create a tunnel**
4. Name it (e.g., `unraid-tunnel`)
5. Install the connector on unRAID (use the Docker option)

### Step 2: Add Public Hostname

1. In your tunnel configuration, click **Add a public hostname**
2. Configure as follows:

| Setting | Value |
|---------|-------|
| Subdomain | `hailmary` (or your choice) |
| Domain | Select your domain |
| Service Type | `HTTP` |
| URL | `hailmary-pwa:80` |

> **Note:** If using Docker's default network mode, you may need to use the container's internal IP or the host IP. The service name `hailmary-pwa` works when the cloudflared connector is on the same Docker network.

### Step 3: Alternative - Use Host IP

If the container name doesn't resolve, use your unRAID server's IP:

| Setting | Value |
|---------|-------|
| Service Type | `HTTP` |
| URL | `192.168.x.x:80` (your unRAID IP) |

### Step 4: Access Your App

Your Hail-Mary app is now available at:

```
https://hailmary.your-domain.com
```

## Security Recommendations

### Add Cloudflare Access (Zero Trust)

Protect your app with Cloudflare Access:

1. Go to **Access** → **Applications**
2. Click **Add an application**
3. Choose **Self-hosted**
4. Configure:
   - Application name: `Hail-Mary`
   - Session Duration: 24 hours (or your preference)
   - Application domain: `hailmary.your-domain.com`
5. Add an Access Policy:
   - Policy name: `Allow Team`
   - Action: Allow
   - Include: Emails ending in `@your-company.com`

## Troubleshooting

### Containers Won't Start

1. Check Docker logs: `docker logs hailmary-api`
2. Verify environment variables are set correctly
3. Ensure PostgreSQL container is healthy before API starts

### Database Connection Issues

1. Check that the postgres container is running: `docker ps | grep postgres`
2. Verify the container is healthy: `docker inspect hailmary-postgres | grep -A5 Health`
3. Test database connection:
   ```bash
   docker exec -it hailmary-postgres psql -U postgres -d hailmary -c "SELECT 1;"
   ```

### API Not Responding

1. Check API logs: `docker logs hailmary-api`
2. Verify API health: `docker exec -it hailmary-api wget -qO- http://localhost:3001/health`
3. Check nginx proxy logs: `docker logs hailmary-pwa`

### PWA Not Loading

1. Check nginx logs: `docker logs hailmary-pwa`
2. Verify static files exist: `docker exec -it hailmary-pwa ls /usr/share/nginx/html`
3. Check nginx config: `docker exec -it hailmary-pwa nginx -t`

### Cloudflare Tunnel Not Working

1. Verify tunnel connector is running on unRAID
2. Check tunnel status in Cloudflare dashboard
3. Ensure the public hostname points to correct service
4. Try using the host IP instead of container name

## Updating the Stack

To update to a new version:

1. Pull the latest code from GitHub
2. In Docker Compose Manager, click **Compose Up** (with build option enabled)
3. Wait for containers to rebuild and restart

Or via command line:

```bash
cd /mnt/user/appdata/hailmary
git pull
docker compose up -d --build
```

> **Note:** The `--build` flag is required to rebuild images when source code changes. Without it, `docker compose up -d` will only restart containers with existing (old) images.

### Quick Update Script

For convenience, you can create a simple update script:

```bash
#!/bin/bash
# /mnt/user/appdata/hailmary/update.sh
cd /mnt/user/appdata/hailmary
git pull
docker compose up -d --build
```

Make it executable with `chmod +x update.sh` and run with `./update.sh`.

## Backup and Restore

### Backup PostgreSQL Data

```bash
docker exec hailmary-postgres pg_dump -U postgres hailmary > backup.sql
```

### Restore PostgreSQL Data

```bash
cat backup.sql | docker exec -i hailmary-postgres psql -U postgres hailmary
```

### Backup Docker Volume

The PostgreSQL data is stored in a Docker volume named `hailmary-postgres-data`. You can back it up using unRAID's built-in tools or:

```bash
docker run --rm -v hailmary-postgres-data:/data -v /mnt/user/backups:/backup alpine tar cvf /backup/postgres-backup.tar /data
```

## Container Reference

| Container | Internal Port | Purpose |
|-----------|--------------|---------|
| `hailmary-pwa` | 80 | Nginx serving PWA + reverse proxy |
| `hailmary-api` | 3001 | Express.js backend API |
| `hailmary-assistant` | 3002 | AI assistant service |
| `hailmary-postgres` | 5432 | PostgreSQL database |

## Support

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/martinbibb-cmd/Hail-Mary/issues)
2. Review container logs
3. Verify environment variables are correctly set
