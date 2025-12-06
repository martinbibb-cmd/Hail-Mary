# NAS Deployment Guide 🚀

This guide explains how to deploy Hail-Mary to a NAS (Network Attached Storage) device using Docker and keep it automatically synced with GitHub.

## Overview

The deployment architecture uses:
- **GitHub Actions CI**: Builds Docker images for each service and pushes to GitHub Container Registry (GHCR)
- **NAS Runtime**: Pulls pre-built images and runs containers
- **Automatic Updates**: Either scheduled pulls or webhook-triggered deployments

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Local Dev     │────▶│     GitHub      │────▶│      NAS        │
│  (VS Code +     │push │  (Actions CI)   │     │  (Docker +      │
│   Copilot)      │     │  Build Images   │────▶│   Containers)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │                        ▲
                              │   ghcr.io images       │
                              └────────────────────────┘
```

## Quick Start

### Prerequisites

On your NAS:
- Docker and Docker Compose installed
- Git installed (for initial clone)
- Network access to GitHub Container Registry (ghcr.io)

### 1. Clone the Repository

```bash
# Clone to /opt/hail-mary (or your preferred location)
sudo git clone https://github.com/martinbibb-cmd/Hail-Mary.git /opt/hail-mary
cd /opt/hail-mary
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your settings
nano .env
```

Required environment variables:
```bash
# Security (REQUIRED - change in production!)
JWT_SECRET=your-secure-random-string-here

# AI Assistant (optional)
GEMINI_API_KEY=your-gemini-api-key

# Network
PWA_PORT=3000  # Port to expose the web app
BASE_URL=https://your-domain.com

# Registry (for pulling pre-built images)
GITHUB_REPOSITORY_OWNER=martinbibb-cmd
IMAGE_TAG=latest  # or 'main', 'staging', or specific SHA
```

### Default Login Credentials

After deployment, an admin user is automatically created:

| Field | Value |
|-------|-------|
| **Email** | `admin@hailmary.local` |
| **Password** | `HailMary2024!` |

> ⚠️ **Change these credentials in production!** Set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in your `.env` file.

### 3. Start the Application

**Option A: Using pre-built images (recommended)**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Option B: Building locally**
```bash
docker-compose up -d --build
```

### 4. Verify Deployment

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Access the app
curl http://localhost:3000
```

## Database Migrations

The database schema is managed using [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL. Migrations ensure your database structure is always up-to-date without manual SQL work.

### Migration Methods

There are three ways to apply database migrations:

#### Method 1: Automatic (Recommended for Docker)

When using Docker Compose, migrations are automatically applied via `db:push` during container startup. **No manual intervention needed.**

```bash
# Start containers - migrations run automatically
docker-compose -f docker-compose.prod.yml up -d

# View migration logs
docker-compose -f docker-compose.prod.yml logs hailmary-api | grep -i "migration\|schema"
```

#### Method 2: Drizzle Kit Push (Development/Quick Apply)

Use `db:push` to push schema changes directly to the database without generating migration files:

```bash
# From packages/api directory
npm run db:push

# Or from root with Docker
docker exec -it hailmary-api npm run db:push
```

This is idempotent - safe to run multiple times.

#### Method 3: Drizzle Kit Migrate (Production/Versioned)

Use `db:migrate` for versioned migrations with tracking:

```bash
# Generate new migration files from schema changes
npm run db:generate

# Apply pending migrations
npm run db:migrate

# Or use the programmatic migration runner
npm run migrate
```

### Database Schema Overview

The application uses the following core tables:

| Table | Purpose |
|-------|---------|
| `accounts` | Multi-tenant organization/company data |
| `users` | System users with authentication data |
| `password_reset_tokens` | Password recovery tokens |
| `customers` | Customer/household contact information |
| `leads` | Sales lead tracking |
| `products` | Product catalog |
| `quotes` / `quote_lines` | Quote documents and line items |
| `appointments` | Scheduled visits and installations |
| `visit_sessions` | Field visit tracking |
| `survey_*` | Survey templates and responses |
| `transcript_*` | Voice transcription data |
| `files` | File attachments |

### Users Table Structure

The `users` table includes all fields required for authentication:

```sql
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "account_id" INTEGER REFERENCES "accounts"("id"),
  "email" VARCHAR(255) NOT NULL UNIQUE,      -- Login identifier
  "name" VARCHAR(255) NOT NULL,               -- Display name
  "password_hash" TEXT,                       -- Bcrypt hash (null for OAuth)
  "auth_provider" VARCHAR(50) DEFAULT 'local' NOT NULL,  -- local|google|salesforce
  "external_id" VARCHAR(255),                 -- OAuth provider user ID
  "role" VARCHAR(50) DEFAULT 'user' NOT NULL, -- user|admin
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

### Seeding Initial Data

After migrations, seed the database with initial data including the admin user:

```bash
# Seed database (idempotent - safe to run multiple times)
npm run db:seed

# Or via Docker
docker exec -it hailmary-api npm run db:seed
```

The seed script:
- Creates a default account if none exists
- Creates a test customer if none exists
- Creates an initial admin user using `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` environment variables

### Admin User Management

Create or manage admin users without direct database access:

```bash
# Create a new admin user
docker exec -it hailmary-api npm run admin:create -- admin@example.com password123 "Admin Name"

# List all users
docker exec -it hailmary-api npm run admin:list-users

# Reset a user's password
docker exec -it hailmary-api npm run admin:reset-password -- admin@example.com newpassword123
```

### Troubleshooting Migrations

If you encounter migration issues:

```bash
# 1. Check database connectivity
docker exec hailmary-postgres pg_isready -U postgres -d hailmary

# 2. View current tables
docker exec -it hailmary-postgres psql -U postgres -d hailmary -c "\dt"

# 3. Check users table structure
docker exec -it hailmary-postgres psql -U postgres -d hailmary -c "\d users"

# 4. View migration history (if using db:migrate)
docker exec -it hailmary-postgres psql -U postgres -d hailmary -c "SELECT * FROM drizzle.__drizzle_migrations"

# 5. Reset and re-apply (DESTROYS DATA - development only!)
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

## Automatic Updates

Choose one of these methods to keep your NAS deployment in sync:

### Method 1: Scheduled Image Pull (Recommended)

The simplest and most secure approach - periodically check for new images.

```bash
# Run the setup script (checks every 5 minutes by default)
./scripts/setup-cron.sh 5

# Or manually add to crontab for custom interval
crontab -e
# Add: */5 * * * * /opt/hail-mary/scripts/nas-deploy.sh >> /var/log/hail-mary.log 2>&1
```

### Method 2: GitHub Webhook (Immediate updates)

Receive instant notifications when new images are available.

```bash
# Set up the webhook listener
./scripts/setup-webhook.sh

# Follow the printed instructions to:
# 1. Install the systemd service
# 2. Configure the GitHub webhook
# 3. (Optional) Set up TLS/reverse proxy
```

**Security considerations for webhooks:**
- Always use HTTPS (TLS) for the webhook endpoint
- Use a strong, random webhook secret
- Consider using Cloudflare Tunnel for secure access without port forwarding

### Method 3: Git Pull + Rebuild

For source-based deployment instead of pre-built images:

```bash
# Create a simple update script
cat > /opt/hail-mary/update.sh << 'EOF'
#!/bin/bash
cd /opt/hail-mary
git pull origin main
docker-compose up -d --build
docker image prune -f
EOF

chmod +x /opt/hail-mary/update.sh

# Add to cron
crontab -e
# Add: 0 * * * * /opt/hail-mary/update.sh >> /var/log/hail-mary.log 2>&1
```

## GitHub Actions CI

The CI pipeline (`.github/workflows/docker-build.yml`) automatically:

1. **Detects changes** in each service (api, pwa, assistant)
2. **Builds Docker images** only for changed services
3. **Pushes to GHCR** with tags:
   - `latest` - for main branch
   - `<branch-name>` - for any branch
   - `<commit-sha>` - for every commit

### Enabling GitHub Container Registry

1. The workflow uses `GITHUB_TOKEN` which is automatically provided
2. Images are pushed to `ghcr.io/<username>/hail-mary-<service>`
3. For public repos, images are publicly accessible
4. For private repos, you need to authenticate:

```bash
# On your NAS, login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin
```

### Manual Workflow Trigger

You can force rebuild all services from the GitHub Actions UI:

1. Go to Actions > "Build and Push Docker Images"
2. Click "Run workflow"
3. Check "Force rebuild all services"
4. Click "Run workflow"

## Rollback

To rollback to a previous version:

```bash
# Use a specific commit SHA
export IMAGE_TAG=abc1234
docker-compose -f docker-compose.prod.yml up -d

# Or use a specific branch tag
export IMAGE_TAG=staging
docker-compose -f docker-compose.prod.yml up -d
```

## Monitoring & Logs

```bash
# View all container logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f hailmary-api

# Check deployment logs (if using cron)
tail -f /var/log/hail-mary-deploy.log
tail -f /var/log/hail-mary-updates.log
```

## Troubleshooting

### Images not pulling

```bash
# Check if you can access GHCR
docker pull ghcr.io/martinbibb-cmd/hail-mary-api:latest

# If private repo, ensure you're logged in
docker login ghcr.io
```

### Containers not starting

```bash
# Check container logs
docker-compose -f docker-compose.prod.yml logs hailmary-api

# Check if ports are in use
netstat -tlnp | grep 3000
```

### Database issues

```bash
# Check postgres is healthy
docker exec hailmary-postgres pg_isready -U postgres -d hailmary

# View database logs
docker-compose -f docker-compose.prod.yml logs hailmary-postgres
```

## NAS-Specific Notes

### Synology DSM

1. Install Docker from Package Center
2. Use SSH to run deployment commands
3. Container Manager can also be used for visual management

### QNAP

1. Install Container Station from App Center
2. Use SSH for command-line deployment
3. Import docker-compose.prod.yml via Container Station UI

### TrueNAS

1. Use TrueNAS Apps (based on Kubernetes) or install Docker in a VM
2. For Docker in VM, follow standard Linux deployment

## Security Checklist

- [ ] Change default JWT_SECRET in production
- [ ] Use HTTPS for external access
- [ ] Keep Docker and images updated
- [ ] Restrict network access to necessary ports
- [ ] Use strong passwords for database if exposed
- [ ] Regularly backup postgres_data volume
