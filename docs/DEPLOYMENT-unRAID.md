# Hail-Mary unRAID Deployment Guide

This guide explains how to deploy Hail-Mary on unRAID using Docker Compose with an unRAID-optimized configuration.

## Features of unRAID Configuration

- **Automatic installation**: One-line install script with intelligent fallback
- **Pre-built images**: Uses GitHub Container Registry when available (fastest)
- **Local build fallback**: Automatically builds locally if pre-built images aren't available
- **Auto-updates**: Pulls latest Docker images automatically when you push changes
- **Host path storage**: Uses `/mnt/user/appdata/hailmary/postgres` for database persistence (unRAID appdata pattern)
- **WebUI integration**: Containers include unRAID labels for Docker tab WebUI links
- **Compose Manager compatible**: Works seamlessly with the Docker Compose Manager plugin
- **Default port 8080**: Avoids conflicts with common unRAID services

## Quick Start (Recommended)

The fastest way to install Hail-Mary on unRAID:

```bash
wget -O - https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash
```

This will:
1. Clone the repository to `/mnt/user/appdata/hailmary`
2. Create a default `.env` configuration
3. Try to pull pre-built Docker images from GitHub Container Registry
4. **Automatically fall back to local build** if pre-built images aren't available
5. Start all containers
6. Optionally configure automatic updates

After installation completes, access the app at `http://YOUR-UNRAID-IP:8080`

### Installation Options

```bash
# Standard installation (auto-detects best method)
wget -O - https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash

# Force local build (skips trying to pull pre-built images)
wget -O - https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash -s -- --build

# Custom port
wget -O - https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash -s -- --port 9000

# With auto-updates enabled
wget -O - https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash -s -- --auto-update
```

## Manual Installation

If you prefer to install manually:

### Prerequisites

- unRAID 6.9+ with Docker enabled
- Docker Compose Manager plugin installed (from Community Applications)
- Git installed (install Nerd Tools plugin if needed)
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
│  │                    │    :8080      │◄── External Port 8080  ││
│  │                    └───────────────┘                        ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                             │                                    │
│  /mnt/user/appdata/hailmary/postgres ◄── PostgreSQL Data        │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                    Cloudflare Tunnel (optional)
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
4. Set the compose file path to one of these options:

| Compose File | Description |
|--------------|-------------|
| `docker-compose.unraid.yml` | **Pre-built images** - Uses images from GitHub Container Registry (fastest startup) |
| `docker-compose.unraid-build.yml` | **Local build** - Builds images on your NAS (works if pre-built images aren't available) |

> **Recommendation:** Start with `docker-compose.unraid.yml`. If image pull fails, switch to `docker-compose.unraid-build.yml`.

> **Note:** The standard `docker-compose.yml` uses Docker volumes instead of host paths and is not optimized for unRAID.

### Step 4: Configure Environment Variables

Create a `.env` file in `/mnt/user/appdata/hailmary/` or set these variables in the Docker Compose Manager UI:

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APPDATA_PATH` | Path to appdata folder for persistent storage | `/mnt/user/appdata/hailmary` |
| `GEMINI_API_KEY` | Gemini API key for AI assistant | (empty) |
| `GEMINI_MODEL` | Gemini model to use | `gemini-1.5-flash` |
| `PWA_PORT` | External port for the PWA | `8080` |
| `JWT_SECRET` | Secret for JWT tokens | `development-secret-change-in-production` |
| `BASE_URL` | Base URL for the application (change to your domain) | `http://localhost:8080` |

> **Security Note:** PostgreSQL is configured with trust authentication, meaning no password is required. This is suitable for local/internal deployments where the database is only accessible within the Docker network. For production deployments exposed to the internet, consider adding proper authentication.

#### Example .env file

```bash
# unRAID appdata path (default is /mnt/user/appdata/hailmary)
# APPDATA_PATH=/mnt/user/appdata/hailmary

# AI Assistant (optional - leave empty if not using AI features)
# GEMINI_API_KEY=your-gemini-api-key
# GEMINI_MODEL=gemini-1.5-flash

# Port configuration (default: 8080)
# PWA_PORT=8080

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
# Check PWA is running (default port 8080)
curl http://unraid-ip:8080

# Check API health
curl http://unraid-ip:8080/health/api

# Check Assistant health
curl http://unraid-ip:8080/health/assistant
```

You should also see the containers in the unRAID Docker tab with WebUI links.

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
| URL | `hailmary-pwa:8080` |

> **Note:** If using Docker's default network mode, you may need to use the container's internal IP or the host IP. The service name `hailmary-pwa` works when the cloudflared connector is on the same Docker network.

### Step 3: Alternative - Use Host IP

If the container name doesn't resolve, use your unRAID server's IP:

| Setting | Value |
|---------|-------|
| Service Type | `HTTP` |
| URL | `192.168.x.x:8080` (your unRAID IP) |

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

### Docker Image Pull Fails ("Packages: 0" Issue)

If you see errors when pulling images like:
```
Error response from daemon: manifest for ghcr.io/martinbibb-cmd/hail-mary-api:latest not found
```

This means the pre-built images haven't been published yet. **This is normal for a fresh repository.**

**Solution:** Use the local build compose file instead:

```bash
cd /mnt/user/appdata/hailmary

# Switch to local build
docker compose -f docker-compose.unraid-build.yml up -d --build
```

The install script automatically handles this - if pulling images fails, it falls back to local build.

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

## Automatic Updates

Hail-Mary can automatically update when you push changes to GitHub! Choose one of these methods:

### Method 1: User Scripts Plugin (Recommended for unRAID)

This is the easiest way to enable automatic updates on unRAID:

```bash
cd /mnt/user/appdata/hailmary
./scripts/setup-unraid-autoupdate.sh
```

This creates a User Script that:
- Checks for repository updates
- Pulls new Docker images from GitHub Container Registry
- Restarts containers if updates are found
- Runs on a schedule (default: hourly)
- Sends unRAID notifications when updates are installed

**Customize the schedule:**
```bash
# Check every 15 minutes (fast updates)
./scripts/setup-unraid-autoupdate.sh --interval "*/15 * * * *"

# Check every 6 hours (light usage)
./scripts/setup-unraid-autoupdate.sh --interval "0 */6 * * *"

# Check daily at 2 AM
./scripts/setup-unraid-autoupdate.sh --interval "0 2 * * *"
```

**Manage in the Web UI:**
- Go to Settings > User Scripts > hailmary-auto-update
- Click "Run Now" to manually check for updates
- Adjust the schedule as needed
- View logs to see update history

### Method 2: Manual Updates

To manually update to the latest version:

**If using pre-built images (`docker-compose.unraid.yml`):**
```bash
cd /mnt/user/appdata/hailmary
docker compose -f docker-compose.unraid.yml pull
docker compose -f docker-compose.unraid.yml up -d
docker image prune -f
```

**If using local build (`docker-compose.unraid-build.yml`):**
```bash
cd /mnt/user/appdata/hailmary
git pull
docker compose -f docker-compose.unraid-build.yml build
docker compose -f docker-compose.unraid-build.yml up -d
docker image prune -f
```

Or using the deployment script:

```bash
cd /mnt/user/appdata/hailmary
./scripts/nas-deploy.sh
```

### How It Works

When you push changes to the GitHub repository:

1. **GitHub Actions** automatically builds new Docker images
2. Images are pushed to GitHub Container Registry (ghcr.io)
3. The auto-update script (if enabled) periodically checks for new images
4. If new images are found, containers are automatically updated
5. Old images are cleaned up to save space

**No manual intervention needed!** Just push your changes and they'll deploy automatically.

## Backup and Restore

### Backup PostgreSQL Data

The PostgreSQL data is stored in the appdata path at `/mnt/user/appdata/hailmary/postgres`. You can:

**Option 1: Use pg_dump (recommended)**
```bash
docker exec hailmary-postgres pg_dump -U postgres hailmary > /mnt/user/backups/hailmary-backup.sql
```

**Option 2: Copy the data directory directly**
```bash
# Stop containers first
docker compose -f /mnt/user/appdata/hailmary/docker-compose.unraid.yml stop

# Copy the postgres data
cp -r /mnt/user/appdata/hailmary/postgres /mnt/user/backups/hailmary-postgres-$(date +%Y%m%d)

# Restart containers
docker compose -f /mnt/user/appdata/hailmary/docker-compose.unraid.yml up -d
```

### Restore PostgreSQL Data

**From pg_dump backup:**
```bash
cat /mnt/user/backups/hailmary-backup.sql | docker exec -i hailmary-postgres psql -U postgres hailmary
```

**From directory backup:**
```bash
# Stop containers
docker compose -f /mnt/user/appdata/hailmary/docker-compose.unraid.yml stop

# Restore the data directory
rm -rf /mnt/user/appdata/hailmary/postgres
cp -r /mnt/user/backups/hailmary-postgres-YYYYMMDD /mnt/user/appdata/hailmary/postgres

# Restart containers
docker compose -f /mnt/user/appdata/hailmary/docker-compose.unraid.yml up -d
```

### Using unRAID Backup Plugins

Since the PostgreSQL data is stored in the appdata folder, you can use unRAID's built-in backup solutions:

1. **Appdata Backup** plugin: Will automatically include Hail-Mary data
2. **CA Backup / Restore Appdata** from Community Applications

## Container Reference

| Container | Internal Port | External Port | Purpose |
|-----------|--------------|---------------|---------|
| `hailmary-pwa` | 8080 | 8080 (configurable) | Nginx serving PWA + reverse proxy |
| `hailmary-api` | 3001 | (internal only) | Express.js backend API |
| `hailmary-assistant` | 3002 | (internal only) | AI assistant service |
| `hailmary-postgres` | 5432 | (internal only) | PostgreSQL database |

## Data Locations

| Data | Location |
|------|----------|
| PostgreSQL database | `/mnt/user/appdata/hailmary/postgres` |
| Application source | `/mnt/user/appdata/hailmary` |
| Pre-built images compose | `/mnt/user/appdata/hailmary/docker-compose.unraid.yml` |
| Local build compose | `/mnt/user/appdata/hailmary/docker-compose.unraid-build.yml` |

## Admin Tools

### Default Login Credentials

When you first deploy Hail-Mary on unRAID, an admin user is automatically created:

| Field | Value |
|-------|-------|
| **Email** | `admin@hailmary.local` |
| **Password** | `HailMary2024!` |

> ⚠️ **Security Warning**: Change these credentials immediately after first login!

### List All Users

To see all registered users:

```bash
docker exec -it hailmary-api npm run admin:list-users
```

This displays a table of all users with their ID, name, email, auth provider, and role.

### Reset User Password

If a user forgets their password and email-based reset isn't configured:

```bash
docker exec -it hailmary-api npm run admin:reset-password -- <email> <new-password>
```

Example:
```bash
docker exec -it hailmary-api npm run admin:reset-password -- admin@example.com MyNewP@ss123
```

Requirements:
- Password must be at least 8 characters
- Only works for users with local authentication (not SSO)

### Custom Initial Admin User

To use custom credentials instead of the defaults, set these environment variables in your `.env` file before first deployment:

```bash
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=your-secure-password
```

Then start (or restart) the containers:
```bash
docker compose -f docker-compose.unraid.yml up -d
```

The admin user will be created on startup if it doesn't already exist.

## Support

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/martinbibb-cmd/Hail-Mary/issues)
2. Review container logs
3. Verify environment variables are correctly set
