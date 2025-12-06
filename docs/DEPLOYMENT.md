# Hail-Mary Deployment Guide

This guide helps you choose the best deployment platform for your needs and provides links to detailed platform-specific guides.

## Quick Platform Comparison

| Platform | Best For | Database | Cost | Complexity | Setup Time |
|----------|----------|----------|------|------------|------------|
| **[Unraid NAS](#unraid-nas)** | Home/office use, complete control | PostgreSQL on NAS storage | Hardware only | Low | 5 minutes |
| **[Railway](#railway)** | Fastest deployment, low traffic | Managed PostgreSQL | ~$15/month | Very Low | 10 minutes |
| **[Google Cloud](#google-cloud)** | Production, high availability | Cloud SQL PostgreSQL | ~$30/month | Medium | 30 minutes |

## Platform Details

### Unraid NAS

**✅ Best for:** Self-hosted deployment on your own hardware

**Advantages:**
- Complete data ownership and control
- No recurring cloud costs
- Database stored on your NAS (persistent, backed up with your NAS)
- Low latency on local network
- Optional NAS authentication mode (password-free local access)

**Requirements:**
- Unraid server with Docker support
- 2GB RAM, 5GB storage
- Static IP or dynamic DNS (for remote access)

**Database:**
- PostgreSQL 17 running in Docker container
- Data persisted to `/mnt/user/appdata/hailmary/postgres` on NAS array
- Automatic backups via Unraid backup solutions

**Estimated Costs:**
- $0/month (after initial hardware investment)
- Optional: Dynamic DNS service (~$5/year)

**Quick Start:**
```bash
# One-line installation
curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash
```

**📖 [Full Unraid Deployment Guide →](./DEPLOYMENT-unRAID.md)**

---

### Railway

**✅ Best for:** Quick deployment without infrastructure management

**Advantages:**
- Fastest time to production (10 minutes)
- Automatic HTTPS/SSL certificates
- Managed PostgreSQL with automatic backups
- Git-based deployment (push to deploy)
- Simple environment variable management
- Generous free tier ($5/month credit)

**Requirements:**
- Railway account (free signup)
- GitHub repository

**Database:**
- Managed PostgreSQL with automatic backups
- Daily snapshots included
- Automatic scaling and monitoring
- Point-in-time recovery available

**Estimated Costs:**
- **Development:** Free tier covers it ($5/month credit)
- **Low traffic production:** ~$15/month
  - API: 512MB RAM = $7.50
  - Assistant: 256MB RAM = $3.75
  - PWA: 256MB RAM = $3.75
  - PostgreSQL: 1GB storage = $0.10
- **Higher traffic:** Scales automatically with usage

**Quick Start:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link repository
railway login
railway init

# Add PostgreSQL
railway add --database postgresql

# Deploy
railway up
```

**📖 [Full Railway Deployment Guide →](./DEPLOYMENT-RAILWAY.md)**

---

### Google Cloud Platform

**✅ Best for:** Enterprise production deployments with high availability

**Advantages:**
- Cloud Run auto-scaling (0 to 1000+ instances)
- 99.95% uptime SLA
- Global load balancing available
- Integrated monitoring and logging
- Cloud SQL managed PostgreSQL
- Cloud Build CI/CD integration
- Advanced security features (Cloud Armor, VPC, etc.)

**Requirements:**
- Google Cloud account
- gcloud CLI installed
- Credit card for billing

**Database:**
- Cloud SQL PostgreSQL 17
- Automatic backups and point-in-time recovery
- Automatic storage increase
- Read replicas for scaling
- High availability configuration available

**Estimated Costs:**
- **Development (minimal traffic):**
  - Cloud Run: ~$5/month (within free tier)
  - Cloud SQL db-f1-micro: ~$15/month
  - Storage: ~$1/month
  - **Total: ~$21/month**

- **Production (moderate traffic):**
  - Cloud Run: ~$20/month
  - Cloud SQL db-g1-small: ~$30/month
  - Storage: ~$2/month
  - **Total: ~$52/month**

**Quick Start:**
```bash
# Enable APIs and create resources
gcloud services enable run.googleapis.com cloudbuild.googleapis.com sqladmin.googleapis.com

# Create Cloud SQL instance
gcloud sql instances create hail-mary-db \
  --database-version=POSTGRES_17 \
  --tier=db-f1-micro \
  --region=us-central1

# Deploy all services
gcloud builds submit --config cloudbuild.yaml
```

**📖 [Full Google Cloud Deployment Guide →](./DEPLOYMENT-GCP.md)**

---

## Feature Comparison Matrix

| Feature | Unraid NAS | Railway | Google Cloud |
|---------|------------|---------|--------------|
| **Database Persistence** | ✅ NAS storage | ✅ Managed | ✅ Cloud SQL |
| **Automatic Backups** | ⚠️ Manual (NAS tools) | ✅ Daily | ✅ Automated |
| **Auto-scaling** | ❌ | ✅ | ✅ |
| **Custom Domain** | ⚠️ Manual DNS | ✅ Built-in | ✅ Built-in |
| **SSL/HTTPS** | ⚠️ Manual (Let's Encrypt) | ✅ Automatic | ✅ Automatic |
| **Monitoring** | ⚠️ Manual | ✅ Built-in | ✅ Advanced |
| **CI/CD Integration** | ⚠️ Manual | ✅ Git-based | ✅ Cloud Build |
| **VPN/Private Network** | ✅ Built-in | ❌ | ✅ VPC |
| **Data Sovereignty** | ✅ Full control | ❌ | ⚠️ Region-based |
| **Offline Access** | ✅ On LAN | ❌ | ❌ |
| **Setup Complexity** | 🟢 Low | 🟢 Very Low | 🟡 Medium |
| **Maintenance** | 🟡 Manual updates | 🟢 Automatic | 🟢 Managed |

## Decision Guide

### Choose **Unraid NAS** if:
- ✅ You already have an Unraid server
- ✅ You want complete control over your data
- ✅ You prefer one-time hardware costs over recurring cloud bills
- ✅ Primary usage is on your local network
- ✅ You're comfortable with basic Docker management
- ✅ You want to avoid cloud vendor lock-in

### Choose **Railway** if:
- ✅ You want the fastest deployment (production in 10 minutes)
- ✅ You're building an MVP or testing the platform
- ✅ You prefer simplicity over infrastructure control
- ✅ Budget is <$50/month
- ✅ You want automatic deployments from Git
- ✅ You don't need advanced enterprise features

### Choose **Google Cloud** if:
- ✅ You need enterprise-grade reliability and SLA
- ✅ You expect high traffic or need auto-scaling
- ✅ You require advanced monitoring and logging
- ✅ You need global availability and low latency worldwide
- ✅ Compliance requires cloud infrastructure
- ✅ You have budget for managed cloud services
- ✅ You want integration with other Google Cloud services

## Hybrid Deployment Options

You can also combine platforms for different purposes:

### Development + Production Split
- **Development:** Railway (fast iterations, low cost)
- **Production:** Google Cloud (reliability, scaling)

### Local + Cloud Backup
- **Primary:** Unraid NAS (local performance)
- **Backup/DR:** Google Cloud (disaster recovery)

### Multi-Region
- **Primary:** Google Cloud US region
- **Secondary:** Google Cloud EU region (GDPR compliance)

## Database Migration Between Platforms

If you need to migrate between platforms:

### Export from any platform:
```bash
# PostgreSQL dump
pg_dump -U postgres -h HOST hailmary > backup.sql

# Or using Docker
docker exec hailmary-postgres pg_dump -U postgres hailmary > backup.sql
```

### Import to any platform:
```bash
# Direct import
psql -U postgres -h NEW_HOST hailmary < backup.sql

# Or via Railway
railway connect postgresql < backup.sql

# Or via Google Cloud SQL
gcloud sql import sql INSTANCE_NAME gs://BUCKET/backup.sql --database=hailmary
```

## Common Architecture Patterns

### Pattern 1: All-in-One (Development)
```
Single Platform: Railway or Unraid
├── PostgreSQL
├── API
├── Assistant
└── PWA
```

### Pattern 2: Microservices (Production)
```
Google Cloud Platform
├── Cloud SQL (PostgreSQL)
├── Cloud Run: API (auto-scaling)
├── Cloud Run: Assistant (auto-scaling)
├── Cloud Run: PWA (auto-scaling)
└── Cloud CDN (static asset caching)
```

### Pattern 3: Hybrid (Cost-optimized)
```
Primary: Unraid NAS (local network)
└── PostgreSQL, API, Assistant, PWA

Public Access: Railway or Google Cloud
└── Read-only replica or API proxy
```

## Environment Variables

All platforms require these environment variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `JWT_SECRET` | Yes | Secret for JWT tokens (32+ chars) | `abc123...` |
| `PORT` | Yes (API) | API server port | `3001` |
| `ASSISTANT_PORT` | Yes (Assistant) | Assistant server port | `3002` |
| `NODE_ENV` | Yes | Environment mode | `production` |
| `GEMINI_API_KEY` | No | Google Gemini API key | `AIza...` |
| `INITIAL_ADMIN_EMAIL` | No | First admin email | `admin@example.com` |
| `INITIAL_ADMIN_PASSWORD` | No | First admin password | `SecurePass123!` |

### Platform-specific variables:

**Unraid NAS only:**
- `APPDATA_PATH`: Path to appdata folder (default: `/mnt/user/appdata/hailmary`)
- `NAS_AUTH_MODE`: Enable password-free local auth (default: `false`)
- `NAS_ALLOWED_IPS`: Comma-separated IPs for NAS auth

**Railway only:**
- Automatically provides: `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_PRIVATE_DOMAIN`
- Use `${{service.VARIABLE}}` for inter-service references

**Google Cloud only:**
- Uses Secret Manager for sensitive values
- Automatically provides: `GOOGLE_CLOUD_PROJECT`, `K_SERVICE`, `K_REVISION`

## Next Steps After Deployment

Regardless of platform, after deployment:

1. ✅ **Verify Services**
   - API: `GET /health` should return `200 OK`
   - PWA: Should load in browser
   - Database: Check migrations applied

2. ✅ **Initial Setup**
   - Log in with default admin credentials
   - Change admin password immediately
   - Create your first customer/lead

3. ✅ **Configure Backups**
   - Unraid: Set up appdata backup
   - Railway: Verify daily snapshots enabled
   - GCP: Configure Cloud SQL backup schedule

4. ✅ **Security Hardening**
   - Rotate JWT_SECRET if using default
   - Set up custom domain with HTTPS
   - Review firewall rules
   - Enable 2FA if available

5. ✅ **Monitoring**
   - Set up uptime monitoring
   - Configure error alerts
   - Review logs regularly

## Troubleshooting

### Database Connection Failed

**Symptoms:** API container can't connect to database

**Solutions:**
- **Unraid:** Check PostgreSQL container is running (`docker ps`)
- **Railway:** Verify PostgreSQL plugin is added and `DATABASE_URL` is set
- **GCP:** Check Cloud SQL instance is running and secrets are configured

### Service Won't Start

**Symptoms:** Container exits immediately

**Solutions:**
1. Check logs:
   - Unraid: `docker logs hailmary-api`
   - Railway: View logs in dashboard
   - GCP: `gcloud run services logs read hail-mary-api`

2. Verify environment variables are set
3. Check `JWT_SECRET` is not the default value

### Migration Errors

**Symptoms:** Database migration fails on startup

**Solutions:**
- Manually run migrations: `npm run db:push -- --force`
- Check database permissions
- Verify database is empty (for first deployment)

## Support and Resources

- **Documentation:** [GitHub Repository](https://github.com/martinbibb-cmd/Hail-Mary)
- **Issues:** [GitHub Issues](https://github.com/martinbibb-cmd/Hail-Mary/issues)
- **Platform-specific guides:**
  - [Unraid Deployment](./DEPLOYMENT-unRAID.md)
  - [Railway Deployment](./DEPLOYMENT-RAILWAY.md)
  - [Google Cloud Deployment](./DEPLOYMENT-GCP.md)
  - [Fly.io Deployment](./DEPLOYMENT-FLY.md) (legacy)

---

**Ready to deploy?** Choose your platform above and follow the detailed guide!
