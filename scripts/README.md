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

### 1️⃣ Quick Update (No Rebuild)
**Use when:** Only code changed, no new dependencies

```bash
./scripts/quick-update.sh
```

What it does:
- ✅ Pulls latest code
- ✅ Restarts services
- ⚡ Fast (2-5 seconds)

### 2️⃣ Full Update (With Rebuild)
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

### 3️⃣ Standard Update (Original)
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
