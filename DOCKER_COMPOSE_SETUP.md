# Docker Compose Setup Guide for Hail-Mary

This guide covers deploying Hail-Mary using Docker Compose, with special focus on NAS (unRAID) deployments.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Deployment Options](#deployment-options)
- [NAS/unRAID Deployment](#nasunraid-deployment)
- [Database Consistency](#database-consistency)
- [Troubleshooting](#troubleshooting)

## Overview

Hail-Mary is a containerized application consisting of three main services:

1. **PostgreSQL Database** - Data persistence layer
2. **API Service** - Backend REST API (port 3001)
3. **Assistant Service** - AI assistant backend (port 3002)
4. **PWA Service** - Frontend + Nginx reverse proxy (port 8080)

## Architecture

### Data Model - Single Source of Truth

**Lead is the single source of truth** for customer/contact information. All other entities reference `leadId`:

```
leads (Single Source of Truth)
  ├── quotes (via leadId)
  ├── appointments (via leadId)
  ├── visit_sessions (via leadId)
  │   ├── media_attachments
  │   ├── survey_instances
  │   └── visit_observations
  └── transcript_sessions (via leadId)
```

**Key Principle**: A lead represents any contact, from initial inquiry ("new" status) through to won customer ("won" status). All quotes, notes, images, floor plans, and visit data are organized under the lead's folder structure.

### Service Communication

```
[Client Browser]
      ↓
[PWA:8080 - Nginx Reverse Proxy]
      ↓
[API:3001] ←→ [Postgres:5432]
      ↓
[Assistant:3002]
```

## Deployment Options

### 1. Standard Deployment (`docker-compose.yml`)

For general Linux servers, cloud VMs, or development:

```bash
# 1. Clone repository
git clone https://github.com/martinbibb-cmd/Hail-Mary.git
cd Hail-Mary

# 2. Create .env file
cp .env.example .env
nano .env  # Edit required values

# 3. Start services
docker-compose up -d

# 4. View logs
docker-compose logs -f

# 5. Access application
http://your-server-ip:3000
```

**Required .env variables:**
```env
# Database
POSTGRES_USER=hailmary
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=hailmary
DATABASE_URL=postgres://hailmary:your_secure_password_here@hailmary-postgres:5432/hailmary

# Security (CRITICAL!)
JWT_SECRET=generate_with_crypto_randomBytes_32_hex
```

### 2. NAS/unRAID Deployment (`docker-compose.unraid.yml`)

Optimized for unRAID and NAS devices with:
- Host path mappings for appdata persistence
- Pre-built images from GitHub Container Registry (GHCR)
- WebUI integration for unRAID dashboard
- NAS authentication mode for local networks

```bash
# 1. Install on unRAID
# Via unRAID Apps: Search for "Hail-Mary" (coming soon)
# OR manually:

cd /mnt/user/appdata/hailmary
git clone https://github.com/martinbibb-cmd/Hail-Mary.git .

# 2. Create .env file
cp .env.example .env
nano .env

# 3. Start with unRAID compose file
docker-compose -f docker-compose.unraid.yml up -d

# 4. Access WebUI
http://your-nas-ip:8080
```

## NAS/unRAID Deployment

### NAS Authentication Mode

For **trusted local networks only**, you can enable passwordless login:

**.env configuration:**
```env
# Enable NAS quick login (SECURITY WARNING: Local networks only!)
NAS_AUTH_MODE=true

# Restrict to specific subnet (recommended)
NAS_ALLOWED_IPS=192.168.1.0/24

# Default if not specified: RFC1918 private networks
# - 127.0.0.0/8 (localhost)
# - 10.0.0.0/8 (Private A)
# - 172.16.0.0/12 (Private B)
# - 192.168.0.0/16 (Private C)
```

**How it works:**
- When `NAS_AUTH_MODE=true`, users on allowed IPs can log in without password
- Username must exist in database, but password is skipped
- Only affects login endpoint, all other API calls still require JWT
- **DO NOT** enable this on public/untrusted networks

### unRAID-Specific Features

**Appdata Persistence:**
```yaml
volumes:
  # PostgreSQL data stored in appdata
  - ${APPDATA_PATH:-/mnt/user/appdata/hailmary}/postgres:/var/lib/postgresql/data
```

**WebUI Integration:**
```yaml
labels:
  net.unraid.docker.webui: "http://[IP]:[PORT:8080]"
```

**Pre-built Images:**
```yaml
services:
  hailmary-api:
    image: ghcr.io/martinbibb-cmd/hail-mary-api:latest
  hailmary-assistant:
    image: ghcr.io/martinbibb-cmd/hail-mary-assistant:latest
  hailmary-pwa:
    image: ghcr.io/martinbibb-cmd/hail-mary-pwa:latest
```

### Database Initialization on NAS

The unRAID deployment includes automatic database initialization:

```yaml
volumes:
  # Mount init script for first-run setup
  - ./db-init:/docker-entrypoint-initdb.d:ro
```

**What happens on first run:**
1. PostgreSQL container starts
2. Runs all `.sql` files in `db-init/` directory
3. Creates tables, indexes, and initial admin user
4. Subsequent restarts skip init scripts (data persists)

## Database Consistency

### Schema Migrations

Two migration systems exist for different deployment scenarios:

#### 1. Supabase Migrations (`supabase/migrations/`)

For Supabase-hosted databases:
- `20241201000000_auth_schema.sql` - Auth and accounts
- `20241201060000_business_schema.sql` - Initial business tables
- `20241201100000_visit_survey_schema.sql` - Visit tracking
- `20241201110000_transcription_schema.sql` - Transcription system
- **`20241213000000_unify_customer_lead.sql`** - ✅ Customer → Lead migration

#### 2. Drizzle ORM Migrations (`packages/api/drizzle/`)

For self-hosted Docker deployments:
- `0000_init.sql` - ✅ **UPDATED** - Uses leads as single source of truth

**Important**: The Drizzle init migration has been updated to match the unified schema. Fresh installations will have the correct structure from the start.

### Verifying Database Schema

After deployment, verify your schema:

```bash
# Connect to database container
docker exec -it hailmary-postgres psql -U hailmary -d hailmary

# Check tables
\dt

# Should show:
# - leads (NOT customers)
# - quotes (with lead_id)
# - appointments (with lead_id)
# - visit_sessions (with lead_id)
# - etc.

# Verify leads table structure
\d leads

# Should include contact fields (first_name, last_name, email, etc.)
```

### Legacy API Compatibility

The API maintains backward compatibility:

**Both endpoints work:**
- `/api/leads` - Primary endpoint, uses Lead types
- `/api/customers` - Legacy compatibility layer, maps to leads table

**Recommendation**: Use `/api/leads` for new code. The `/api/customers` endpoint is maintained for backward compatibility during transition.

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_USER` | Database username | `hailmary` |
| `POSTGRES_PASSWORD` | Database password | `secure_password_123` |
| `POSTGRES_DB` | Database name | `hailmary` |
| `DATABASE_URL` | Full connection string | `postgres://user:pass@host:5432/db` |
| `JWT_SECRET` | Auth token secret | Generate with crypto.randomBytes(32) |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PWA_PORT` | `3000` | External port for web interface |
| `BASE_URL` | `https://hail_mary.cloudbibb.uk` | Base URL for links |
| `GEMINI_API_KEY` | - | Google AI API key for assistant |
| `GEMINI_MODEL` | `gemini-1.5-flash` | AI model to use |
| `NAS_AUTH_MODE` | `false` | Enable NAS passwordless login |
| `NAS_ALLOWED_IPS` | RFC1918 private | Allowed IP ranges (CIDR) |
| `INITIAL_ADMIN_EMAIL` | `admin@hailmary.local` | First admin user email |
| `INITIAL_ADMIN_PASSWORD` | `HailMary2024!` | First admin user password |

## Troubleshooting

### Database Connection Issues

**Problem**: API can't connect to database

```bash
# Check database is running
docker ps | grep postgres

# Check database logs
docker logs hailmary-postgres

# Verify connection from API container
docker exec -it hailmary-api sh
apk add postgresql-client
psql $DATABASE_URL
```

**Solution**: Ensure `DATABASE_URL` matches `POSTGRES_*` variables and uses the service name `hailmary-postgres` as hostname.

### Schema Mismatch Errors

**Problem**: Column not found errors (e.g., "column customer_id does not exist")

**Cause**: Database still has old schema with customers table

**Solution**:
```bash
# Option 1: Fresh installation (destroys data!)
docker-compose down -v
docker-compose up -d

# Option 2: Run migration manually
docker exec -it hailmary-postgres psql -U hailmary -d hailmary
# Then run the unify_customer_lead.sql migration
```

### NAS Auth Not Working

**Problem**: Still prompted for password with `NAS_AUTH_MODE=true`

**Check:**
1. Environment variable is set: `docker exec hailmary-api env | grep NAS`
2. Your IP is in allowed range: Check API logs
3. User exists in database: NAS auth requires existing user

**Logs:**
```bash
docker logs hailmary-api | grep -i "nas auth"
```

### Port Conflicts

**Problem**: Port 8080 already in use

**Solution**: Change `PWA_PORT` in `.env`:
```env
PWA_PORT=8081
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

## Security Best Practices

### 1. JWT Secret

**NEVER use default or weak JWT secrets**

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Database Credentials

Use strong passwords:
```bash
# Generate secure password
openssl rand -base64 32
```

### 3. NAS Authentication

**Only enable NAS_AUTH_MODE on:**
- Completely isolated home networks
- Networks you control 100%
- Behind VPN with no external access

**NEVER enable on:**
- Public networks
- Shared hosting
- Any internet-facing deployments

### 4. Reverse Proxy (Production)

For production, put Nginx/Caddy in front:

```nginx
server {
    listen 80;
    server_name hailmary.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Backup and Restore

### Backup

```bash
# Backup database
docker exec hailmary-postgres pg_dump -U hailmary hailmary > backup.sql

# Backup appdata (unRAID)
tar -czf hailmary-backup.tar.gz /mnt/user/appdata/hailmary/
```

### Restore

```bash
# Restore database
cat backup.sql | docker exec -i hailmary-postgres psql -U hailmary hailmary

# Restore appdata (unRAID)
tar -xzf hailmary-backup.tar.gz -C /mnt/user/appdata/
```

## Support

- **Issues**: https://github.com/martinbibb-cmd/Hail-Mary/issues
- **Discussions**: https://github.com/martinbibb-cmd/Hail-Mary/discussions
- **Documentation**: https://github.com/martinbibb-cmd/Hail-Mary/wiki

## Version History

- **v2.0** (2024-12-13): Unified customer/lead schema
- **v1.5** (2024-12-01): Added transcription system
- **v1.0** (2024-11-01): Initial release
