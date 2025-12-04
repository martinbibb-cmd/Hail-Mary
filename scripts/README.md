# Hail-Mary Deployment Scripts

This directory contains scripts for deploying and managing Hail-Mary on various platforms.

## unRAID Installation & Auto-Update

### Quick Install (Recommended)

```bash
wget -O - https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash
```

Or if you've already cloned the repository:

```bash
cd /mnt/user/appdata/hailmary
./scripts/install-unraid.sh
```

**Options:**
- `--auto-update` - Enable automatic updates via User Scripts
- `--port <number>` - Set custom port (default: 8080)

### Setup Automatic Updates

After installation, enable automatic updates:

```bash
cd /mnt/user/appdata/hailmary
./scripts/setup-unraid-autoupdate.sh
```

**Customize update frequency:**

```bash
# Every 15 minutes
./scripts/setup-unraid-autoupdate.sh --interval "*/15 * * * *"

# Every hour (default)
./scripts/setup-unraid-autoupdate.sh --interval "0 * * * *"

# Every 6 hours
./scripts/setup-unraid-autoupdate.sh --interval "0 */6 * * *"

# Daily at 2 AM
./scripts/setup-unraid-autoupdate.sh --interval "0 2 * * *"
```

## Script Reference

### install-unraid.sh

Full automated installation for unRAID servers.

**What it does:**
- Checks prerequisites (Docker, Git, etc.)
- Clones repository to `/mnt/user/appdata/hailmary`
- Creates `.env` file with secure defaults
- Pulls Docker images from GitHub Container Registry
- Starts all containers
- Optionally sets up automatic updates

**Usage:**
```bash
./scripts/install-unraid.sh [options]

Options:
  --auto-update    Enable automatic updates
  --port <number>  Set PWA port (default: 8080)
  --help           Show help message
```

### setup-unraid-autoupdate.sh

Configures automatic updates using the unRAID User Scripts plugin.

**What it does:**
- Creates a User Script that runs on a schedule
- Pulls latest repository changes
- Checks for new Docker images
- Restarts containers if updates found
- Sends unRAID notifications on updates
- Cleans up old Docker images

**Usage:**
```bash
./scripts/setup-unraid-autoupdate.sh [--interval "cron_schedule"]

Examples:
  # Hourly updates
  ./scripts/setup-unraid-autoupdate.sh --interval "0 * * * *"

  # Every 15 minutes
  ./scripts/setup-unraid-autoupdate.sh --interval "*/15 * * * *"
```

**Prerequisites:**
- User Scripts plugin installed from Community Applications

### nas-deploy.sh

Generic NAS deployment script for production use.

**What it does:**
- Auto-detects unRAID (checks for `/mnt/user`)
- Pulls latest Docker images
- Restarts containers with new images
- Performs health checks
- Cleans up old images

**Usage:**
```bash
./scripts/nas-deploy.sh [options]

Options:
  --registry-login    Login to GitHub Container Registry
  --force-recreate    Force recreate all containers
  --service <name>    Deploy only specific service (api, pwa, assistant)
  --help              Show help message
```

**Auto-detection:**
- On unRAID: Uses `/mnt/user/appdata/hailmary` and `docker-compose.unraid.yml`
- Other systems: Uses `/opt/hail-mary` and `docker-compose.prod.yml`

### setup-cron.sh

Sets up cron-based automatic updates (for non-unRAID Linux systems).

**What it does:**
- Creates a cron job that periodically checks for updates
- Pulls new Docker images
- Restarts containers if images changed
- Logs all activity to `/var/log/hail-mary-updates.log`

**Usage:**
```bash
./scripts/setup-cron.sh [interval_minutes]

# Check every 5 minutes (default)
./scripts/setup-cron.sh

# Check every 30 minutes
./scripts/setup-cron.sh 30

# Check every hour
./scripts/setup-cron.sh 60
```

**Note:** For unRAID, use `setup-unraid-autoupdate.sh` instead.

### setup-webhook.sh

Sets up a webhook listener for instant updates on GitHub push events.

**What it does:**
- Creates a Node.js webhook server
- Listens for GitHub webhook events
- Triggers deployment when code is pushed
- Verifies webhook signatures for security

**Usage:**
```bash
./scripts/setup-webhook.sh
```

**Prerequisites:**
- Node.js installed
- Set `WEBHOOK_SECRET` environment variable
- Configure GitHub webhook to point to your server

**Note:** This is advanced setup. Most users should use the cron or User Scripts approach instead.

## Deployment Workflow

### For unRAID Users

1. **Install:**
   ```bash
   wget -O - https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash
   ```

2. **Enable auto-updates:**
   ```bash
   cd /mnt/user/appdata/hailmary
   ./scripts/setup-unraid-autoupdate.sh
   ```

3. **Done!** Your system will automatically update when you push changes to GitHub.

### For Other Linux/NAS Systems

1. **Clone repository:**
   ```bash
   git clone https://github.com/martinbibb-cmd/Hail-Mary.git /opt/hail-mary
   cd /opt/hail-mary
   ```

2. **Deploy:**
   ```bash
   ./scripts/nas-deploy.sh
   ```

3. **Enable auto-updates:**
   ```bash
   ./scripts/setup-cron.sh 60  # Check hourly
   ```

## Environment Variables

All scripts respect these environment variables:

| Variable | Description | Default (unRAID) | Default (Other) |
|----------|-------------|------------------|-----------------|
| `DEPLOY_DIR` | Installation directory | `/mnt/user/appdata/hailmary` | `/opt/hail-mary` |
| `COMPOSE_FILE` | Docker Compose file | `docker-compose.unraid.yml` | `docker-compose.prod.yml` |
| `PWA_PORT` | External port for PWA | `8080` | `3000` |
| `JWT_SECRET` | JWT authentication secret | (auto-generated) | (auto-generated) |

## Troubleshooting

### "Docker not found"
Install Docker from unRAID's Docker settings or install Docker Engine on Linux.

### "Docker Compose not found"
- **unRAID:** Install "Docker Compose Manager" from Community Applications
- **Linux:** Run `apt install docker-compose` or install Docker Compose v2

### "Git not found"
- **unRAID:** Install "Nerd Tools" plugin from Community Applications
- **Linux:** Run `apt install git`

### "User Scripts plugin not found"
Only needed for unRAID auto-updates. Install "User Scripts" from Community Applications.

### Updates not running
1. Check User Scripts in Settings > User Scripts
2. View logs by clicking the script name
3. Manually run to test: Click "Run Script"

### Containers won't start
```bash
# Check logs
docker logs hailmary-pwa
docker logs hailmary-api

# Check status
docker ps -a

# Restart
cd /mnt/user/appdata/hailmary
docker compose -f docker-compose.unraid.yml restart
```

## Advanced Usage

### Deploy specific service only
```bash
./scripts/nas-deploy.sh --service api
./scripts/nas-deploy.sh --service pwa
./scripts/nas-deploy.sh --service assistant
```

### Force recreate containers
```bash
./scripts/nas-deploy.sh --force-recreate
```

### Use with private registry
```bash
export GITHUB_TOKEN="your_github_token"
export GITHUB_USER="your_username"
./scripts/nas-deploy.sh --registry-login
```

## Support

- **Documentation:** See `docs/DEPLOYMENT-unRAID.md` for detailed unRAID guide
- **Issues:** https://github.com/martinbibb-cmd/Hail-Mary/issues
- **Logs:** Check `/var/log/hail-mary-*.log` for deployment logs
