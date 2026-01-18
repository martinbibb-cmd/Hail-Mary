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

### 1️⃣ VM Deployment Fix
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

### 2️⃣ Quick Update (No Rebuild)
**Use when:** Only code changed, no new dependencies

```bash
./scripts/quick-update.sh
```

What it does:
- ✅ Pulls latest code
- ✅ Restarts services
- ⚡ Fast (2-5 seconds)

### 3️⃣ Full Update (With Rebuild)
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

### 4️⃣ Standard Update (Original)
```bash
./scripts/update-and-restart.sh
```

## Manual Commands

If you prefer manual control:

```bash
# Pull latest code
git pull

# Install dependencies
npm install

# Restart stack (quick)
docker-compose restart

# Rebuild and restart (full)
docker-compose down
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

## Common Workflows

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
- Use `quick-update.sh` for code-only changes
- Use `full-update.sh` when dependencies change
- Always run `make migrate` after pulling database changes
