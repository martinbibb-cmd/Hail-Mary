# 🛠️ Hail-Mary Scripts

Quick reference for managing your Hail-Mary stack.

## Quick Commands (Using Makefile)

The easiest way to manage your stack:

```bash
make help          # Show all available commands
make up            # Start the stack
make down          # Stop the stack
make restart       # Restart the stack
make logs          # View logs
make update        # Pull latest code + rebuild + restart
make migrate       # Run database migrations
```

## Update Scripts

### 1️⃣ Safe Update (Recommended for Production/VM) 🔒
**Use when:** Running on production VM or need reliable updates that avoid registry pull failures

```bash
./scripts/safe-update.sh
```

**Why use this:**
- ✅ Prevents "pull access denied" errors for local-build services
- ✅ Only pulls registry-backed images (hailmary-api, hailmary-pwa, hailmary-assistant, postgres)
- ✅ Rebuilds admin-agent locally (never pulled from registry)
- ✅ Safe for production deployments
- ⚡ Fast and predictable (30-60 seconds)

**What it does:**
1. Pulls latest code from git
2. Pulls ONLY GHCR-backed services (skips hailmary-admin-agent)
3. Rebuilds hailmary-admin-agent locally
4. Brings everything up with --remove-orphans

**Common issues this solves:**
- ❌ "pull access denied for hailmary-admin-agent" → This script never pulls admin-agent
- ❌ UI update button failures → Admin-agent is built locally, not pulled
- ❌ Missing update screen → Ensures all services start correctly

### 2️⃣ VM Deployment Fix
**Use when:** Need to clean up deployment on VM, remove stray containers, and verify health

```bash
./scripts/vm-deploy-fix.sh
```

What it does:
- ✅ Removes stray containers (e.g., jovial_banzai) that conflict with ports
- ✅ Recreates compose stack cleanly with --force-recreate
- ✅ Verifies API health endpoints respond
- ✅ Checks auth config endpoint
- ✅ Reports on core config status (atlas-schema/checklist-config)

Options:
- `--skip-verify` - Skip health check verification after deployment

### 3️⃣ Quick Update (No Rebuild)
**Use when:** Only code changed, no new dependencies

```bash
./scripts/quick-update.sh
```

What it does:
- ✅ Pulls latest code
- ✅ Restarts services
- ⚡ Fast (2-5 seconds)

### 4️⃣ Full Update (With Rebuild)
**Use when:** Dependencies changed, Dockerfile modified, or you see errors

```bash
./scripts/full-update.sh
```

What it does:
- ✅ Pulls latest code
- ✅ Installs dependencies
- ✅ Rebuilds containers
- ✅ Restarts stack
- 🐢 Slower (2-5 minutes)

### 5️⃣ Standard Update (Original)
```bash
./scripts/update-and-restart.sh
```

## Manual Commands

If you prefer manual control:

### Safe Update (Recommended)
```bash
# Step 1: Pull latest code
cd ~/Hail-Mary
git pull

# Step 2: Pull ONLY registry-backed images
docker compose pull hailmary-api hailmary-pwa hailmary-assistant postgres

# Step 3: Rebuild local-only admin agent (no pulling)
docker compose build hailmary-admin-agent

# Step 4: Bring everything up
docker compose up -d --remove-orphans
```

### Quick Commands
```bash
# Restart stack (quick)
docker compose restart

# View logs
docker compose logs -f

# Check status
docker compose ps
```

### Full Rebuild (when needed)
```bash
# Install dependencies (if needed)
npm install

# Rebuild and restart (full)
docker compose down
docker compose build
docker compose up -d
```

## Common Workflows

### Production/VM Updates (Recommended)
```bash
./scripts/safe-update.sh  # Safe, reliable, prevents registry pull failures
docker compose logs -f    # Check for errors
```

### After Merging a PR
```bash
make update        # Pull + rebuild + restart
make migrate       # Apply database changes
make logs          # Check for errors
```

### Quick Code Changes
```bash
./scripts/quick-update.sh
```

### Major Updates (Dependencies, Docker)
```bash
./scripts/full-update.sh
```

### Database Migrations
```bash
make migrate       # Run migrations
make seed          # Seed data (optional)
```

### Troubleshooting
```bash
make logs          # View all logs
make restart       # Restart everything
make clean         # Remove containers + volumes
make reset         # Full reset (deletes data!)
```

### Deployment Issues

#### Stray Container Conflicts
If you see port conflicts or containers that shouldn't exist:
```bash
./scripts/vm-deploy-fix.sh
```

#### API Health Check Failures
To verify API endpoints are responding:
```bash
# Quick check
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1:3001/api/auth/config

# Full deployment fix with verification
./scripts/vm-deploy-fix.sh
```

#### Config Loading Warnings
The API uses embedded fallback configs when custom configs aren't found. These warnings are non-fatal:
- `⚠️  Could not load atlas-schema.json` - Using embedded default
- `⚠️  Could not load checklist-config.json` - Using embedded default

To use custom configs, set `HAILMARY_CORE_PATH` in `.env` and mount the config volume.

#### Missing Update UI / Update Button
If the update screen or button is missing in the admin panel:

**Common causes:**
1. **PWA not running** - The frontend container might be down
   ```bash
   docker compose up -d hailmary-pwa
   docker compose logs hailmary-pwa
   ```

2. **ADMIN_AGENT_TOKEN not set** - Required for admin agent features
   ```bash
   # Check if token is set in .env
   grep ADMIN_AGENT_TOKEN .env
   
   # Generate a secure token if missing
   echo "ADMIN_AGENT_TOKEN=$(openssl rand -hex 32)" >> .env
   
   # Restart affected services
   docker compose up -d --force-recreate hailmary-admin-agent hailmary-api hailmary-pwa
   ```

**Required .env variables:**
```bash
ADMIN_AGENT_TOKEN=your-secure-64-character-hex-token-here
ADMIN_AGENT_URL=http://hailmary-admin-agent:4010
COMPOSE_PROJECT_NAME=hail-mary
```

#### "Pull Access Denied" Errors During Update
If you see errors like `pull access denied for hailmary-admin-agent:local`:

**Solution:** Use the safe update script which never attempts to pull local-build services
```bash
./scripts/safe-update.sh
```

**Why this happens:**
- `hailmary-admin-agent` is built locally (not in a registry)
- Running `docker compose pull` without service names tries to pull ALL services
- The safe update script pulls only registry-backed services

## Service URLs

After running `make up`:

- **PWA (Frontend):** http://localhost:3000
- **API:** http://localhost:3001 (internal)
- **Assistant:** http://localhost:3002 (internal)
- **Database:** localhost:5432 (internal)

## Tips

💡 **Bookmark these commands:**
- `make help` - Show all commands
- `make logs` - Debug issues
- `make update` - Get latest changes

⚠️ **Before running `make reset`:**
- Backup your data!
- This deletes ALL database data

🎯 **Best practices:**
- Use `safe-update.sh` for production/VM deployments (prevents registry pull failures)
- Use `quick-update.sh` for code-only changes (fastest)
- Use `full-update.sh` when dependencies change (most thorough)
- Always run `make migrate` after pulling database changes
- Ensure `.env` contains `ADMIN_AGENT_TOKEN` and `COMPOSE_PROJECT_NAME=hail-mary`
