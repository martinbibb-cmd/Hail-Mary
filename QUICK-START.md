# 🚀 Hail-Mary Quick Start Guide

Get your boiler quote management system up and running in **one command**!

## 🎯 One-Command Install

### Option 1: Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/quick-setup.sh | bash
```

That's it! The script will:
- ✅ Check prerequisites
- ✅ Clone the repository
- ✅ Generate secure credentials
- ✅ Pull/build Docker images
- ✅ Start all services
- ✅ Initialize database
- ✅ Seed 14 sample boiler products
- ✅ Create your admin account
- ✅ Run health checks

**Total time:** ~5-10 minutes (depending on your network and hardware)

### Option 2: Manual Clone & Install

```bash
git clone https://github.com/martinbibb-cmd/Hail-Mary.git
cd Hail-Mary
./scripts/quick-setup.sh
```

## 📋 Prerequisites

The quick setup script checks these automatically:

- ✅ **Docker** (any recent version)
- ✅ **Docker Compose** (v2 or later recommended)
- ✅ **Git** (for cloning the repo)

## 🎛️ Customization Options

Customize your installation with flags:

```bash
# Custom port
./scripts/quick-setup.sh --port 3000

# Custom admin credentials
./scripts/quick-setup.sh \
  --admin-email your@email.com \
  --admin-password YourSecurePassword123

# Force local build (instead of pulling pre-built images)
./scripts/quick-setup.sh --build

# Skip health checks (faster, but no validation)
./scripts/quick-setup.sh --skip-health-check
```

### Combine multiple options:

```bash
./scripts/quick-setup.sh \
  --port 9000 \
  --admin-email admin@mycompany.com \
  --admin-password MySecretPass123 \
  --build
```

## 📊 What You Get

After installation, you'll have:

### ✅ Ready-to-use application
- **Web UI** at `http://YOUR_IP:8080`
- **Admin account** with secure credentials
- **14 sample products** pre-loaded:
  - 3 Combi boilers (Viessmann, Vaillant, Worcester)
  - 2 System boilers (Baxi, Ideal)
  - 2 Hot water cylinders (Megaflo, Gledhill)
  - 4 Controls & accessories (Nest, Honeywell, filters)
  - 3 Installation services

### ✅ Database features
- PostgreSQL 17 with persistent storage
- Auto-initialized schema
- Health checks enabled
- Backup/restore utilities

### ✅ Optimized for NAS
- Flexible deployment paths
- Automatic startup ordering
- Volume persistence
- WebUI integration

## 🔧 Post-Install Management

### View Application Status

```bash
./scripts/health-check.sh --verbose
```

### Backup Database

```bash
./scripts/backup-database.sh
```

Backups are saved to `./backups/` with timestamps. Automatic cleanup keeps the last 10 backups.

### Restore Database

```bash
./scripts/restore-database.sh ./backups/hailmary_backup_YYYYMMDD_HHMMSS.sql.gz
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f hailmary-api
```

### Restart Services

```bash
docker compose restart
```

### Stop Services

```bash
docker compose stop
```

### Update Application

```bash
cd /path/to/hailmary  # your install directory
git pull
docker compose pull  # if using pre-built images
docker compose up -d --build  # if building locally
```

## 🔑 Finding Your Credentials

Your admin credentials are saved in two places:

1. **Console output** - displayed after installation
2. **`.credentials.txt`** file in your install directory

```bash
cat /path/to/hailmary/.credentials.txt
```

**Important:** Save these credentials securely and delete the `.credentials.txt` file afterward!

## 🎨 Optional Enhancements

### Add AI Assistant (Gemini)

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Edit `.env` file:
   ```bash
   GEMINI_API_KEY=your-api-key-here
   ```
3. Restart the assistant service:
   ```bash
   docker compose restart hailmary-assistant
   ```

### Enable Google OAuth

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit `.env` file:
   ```bash
   GOOGLE_AUTH_ENABLED=true
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-secret
   ```
3. Restart API service:
   ```bash
   docker compose restart hailmary-api
   ```

### Setup Automatic Backups

Add to cron (Linux/macOS) or Windows Task Scheduler:

```bash
# Daily backup at 2 AM
0 2 * * * /path/to/hailmary/scripts/backup-database.sh
```

## 🐛 Troubleshooting

### Installation fails during image pull

**Solution:** Use local build mode:
```bash
./scripts/quick-setup.sh --build
```

### Can't access web UI

**Check:**
1. Containers are running: `docker compose ps`
2. Port is not blocked by firewall
3. Correct IP address (check with `hostname -I`)

**Fix:**
```bash
docker compose restart
./scripts/health-check.sh
```

### Database connection errors

**Solution:** Wait for database to fully start:
```bash
docker compose restart hailmary-postgres
# Wait 30 seconds
docker compose restart hailmary-api hailmary-assistant
```

### "Port already in use" error

**Solution:** Use a different port:
```bash
./scripts/quick-setup.sh --port 9000
```

### Need to start fresh

**Complete reset:**
```bash
docker compose down -v  # Warning: deletes all data!
rm -rf postgres-data/
./scripts/quick-setup.sh
```

## 📚 Advanced Usage

### Custom Database Seeding

Edit `packages/api/src/db/seed.ts` to add your own products, then run:

```bash
docker exec hailmary-api npm run db:seed
```

### Database Migrations

```bash
# Generate migration from schema changes
docker exec hailmary-api npm run db:generate

# Apply migrations
docker exec hailmary-api npm run db:push
```

### Direct Database Access

```bash
docker exec -it hailmary-postgres psql -U hailmary -d hailmary
```

## 🆘 Getting Help

- **Documentation:** [GitHub Wiki](https://github.com/martinbibb-cmd/Hail-Mary/wiki)
- **Issues:** [GitHub Issues](https://github.com/martinbibb-cmd/Hail-Mary/issues)
- **Discussions:** [GitHub Discussions](https://github.com/martinbibb-cmd/Hail-Mary/discussions)

## 🎉 You're All Set!

Your Hail-Mary installation is ready. Start by:

1. 🌐 Opening the web UI
2. 🔑 Logging in with your admin credentials
3. 👤 Creating your first customer
4. 📝 Building your first quote
5. 🎯 Growing your business!

---

**Made with ❤️ for heating engineers**

*Star ⭐ the repo if you find it useful!*
