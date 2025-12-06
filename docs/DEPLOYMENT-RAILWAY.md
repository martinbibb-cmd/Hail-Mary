# Deploying Hail-Mary to Railway

Railway is a modern platform-as-a-service that simplifies deployment with built-in PostgreSQL, automatic SSL, and zero-config networking.

## Why Railway?

- ✅ **Managed PostgreSQL** - Automatic backups, scaling, and persistence
- ✅ **Simple deployment** - Git push to deploy
- ✅ **Automatic SSL** - HTTPS enabled by default
- ✅ **Environment management** - Easy secrets and config
- ✅ **Generous free tier** - $5/month credit (enough for small deployments)
- ✅ **Monorepo support** - Deploy multiple services from one repo

## Architecture on Railway

```
┌─────────────────────────────────────────────┐
│           Railway Project                    │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────────┐     ┌──────────────┐     │
│  │   PostgreSQL │────▶│   API Service│     │
│  │   (Plugin)   │     │   (Port 3001)│     │
│  └──────────────┘     └───────┬──────┘     │
│         │                      │             │
│         │              ┌───────▼──────┐     │
│         └─────────────▶│  Assistant   │     │
│                        │  (Port 3002) │     │
│                        └───────┬──────┘     │
│                                │             │
│                        ┌───────▼──────┐     │
│                        │     PWA      │     │
│                        │  (Port 8080) │     │
│                        │  (Public)    │     │
│                        └──────────────┘     │
└─────────────────────────────────────────────┘
```

## Prerequisites

1. **Railway Account**
   - Sign up at [railway.app](https://railway.app)
   - Connect your GitHub account

2. **Railway CLI** (optional, for local management)
   ```bash
   npm install -g @railway/cli
   railway login
   ```

## Deployment Methods

### Option 1: Deploy via Railway Dashboard (Recommended)

This is the easiest method for most users.

#### Step 1: Create Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your Hail-Mary repository
5. Railway will detect the monorepo structure

#### Step 2: Add PostgreSQL Database

1. In your project, click **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway automatically creates `DATABASE_URL` environment variable
3. The database is persistent and backed up automatically

#### Step 3: Configure Services

Railway needs three separate services. Create them one by one:

##### Service 1: API Backend

1. Click **"New"** → **"Service"** → **"GitHub Repo"**
2. Select your Hail-Mary repo
3. Configure:
   - **Service Name**: `hail-mary-api`
   - **Build Command**: (leave default, uses Dockerfile)
   - **Dockerfile Path**: `packages/api/Dockerfile`
   - **Port**: `3001`

4. Add environment variables:
   ```env
   PORT=3001
   NODE_ENV=production
   JWT_SECRET=<generate-secure-secret>
   BASE_URL=https://your-app.railway.app
   INITIAL_ADMIN_EMAIL=admin@hailmary.local
   INITIAL_ADMIN_PASSWORD=<change-this>
   ```

5. **Connect Database**:
   - Railway automatically provides `DATABASE_URL` from PostgreSQL plugin
   - No manual configuration needed

##### Service 2: Assistant Service

1. Click **"New"** → **"Service"** → **"GitHub Repo"**
2. Select your Hail-Mary repo
3. Configure:
   - **Service Name**: `hail-mary-assistant`
   - **Dockerfile Path**: `packages/assistant/Dockerfile`
   - **Port**: `3002`

4. Add environment variables:
   ```env
   ASSISTANT_PORT=3002
   NODE_ENV=production
   GEMINI_API_KEY=<your-gemini-key>
   GEMINI_MODEL=gemini-1.5-flash
   API_BASE_URL=${{hail-mary-api.RAILWAY_PRIVATE_DOMAIN}}
   ```

   Note: `${{hail-mary-api.RAILWAY_PRIVATE_DOMAIN}}` automatically references the API service

5. **Connect Database**:
   - Add `DATABASE_URL` reference from PostgreSQL plugin

##### Service 3: PWA Frontend

1. Click **"New"** → **"Service"** → **"GitHub Repo"**
2. Select your Hail-Mary repo
3. Configure:
   - **Service Name**: `hail-mary-pwa`
   - **Dockerfile Path**: `packages/pwa/Dockerfile`
   - **Port**: `8080`

4. Add environment variables:
   ```env
   NODE_ENV=production
   VITE_API_URL=${{hail-mary-api.RAILWAY_PUBLIC_DOMAIN}}
   VITE_ASSISTANT_URL=${{hail-mary-assistant.RAILWAY_PUBLIC_DOMAIN}}
   ```

5. **Generate Domain**:
   - Click **"Settings"** → **"Networking"**
   - Click **"Generate Domain"**
   - Copy the URL (e.g., `hail-mary-pwa-production.up.railway.app`)
   - Update `BASE_URL` in API service to this URL

#### Step 4: Deploy

1. Railway automatically deploys on git push
2. Watch logs in Railway dashboard
3. Wait for all services to be healthy
4. Access your app at the PWA domain

### Option 2: Deploy via Railway CLI

For advanced users who prefer command-line workflow.

#### Step 1: Initialize Project

```bash
# Clone repository
git clone https://github.com/your-username/Hail-Mary.git
cd Hail-Mary

# Initialize Railway project
railway init

# Link to existing project (if already created)
railway link
```

#### Step 2: Add PostgreSQL

```bash
# Add PostgreSQL plugin
railway add --database postgresql
```

#### Step 3: Set Environment Variables

```bash
# Generate JWT secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Set variables for API service
railway variables set \
  PORT=3001 \
  NODE_ENV=production \
  JWT_SECRET=$JWT_SECRET \
  INITIAL_ADMIN_EMAIL=admin@hailmary.local \
  INITIAL_ADMIN_PASSWORD=HailMary2024!

# Set variables for Assistant service
railway variables set \
  ASSISTANT_PORT=3002 \
  GEMINI_API_KEY=your-key-here \
  GEMINI_MODEL=gemini-1.5-flash

# Set variables for PWA service
railway variables set \
  NODE_ENV=production
```

#### Step 4: Deploy

```bash
# Deploy all services
railway up

# Or deploy specific service
railway up --service hail-mary-api
```

### Option 3: Automatic Deployment (GitHub Integration)

Set up automatic deployment on every push to main branch.

1. In Railway Dashboard:
   - Go to **Service Settings**
   - Enable **"Deploy on Push"**
   - Select branch: `main`

2. Every push to `main` will automatically:
   - Build Docker images
   - Run migrations
   - Deploy new version
   - Zero-downtime deployment

## Environment Variables Reference

### API Service

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | Auto-provided by Railway PostgreSQL | `postgresql://...` |
| `JWT_SECRET` | Yes | Secret for JWT tokens (32+ chars) | `abc123...` |
| `PORT` | Yes | API server port | `3001` |
| `NODE_ENV` | Yes | Environment mode | `production` |
| `BASE_URL` | Yes | Public URL of PWA | `https://app.railway.app` |
| `INITIAL_ADMIN_EMAIL` | No | First admin email | `admin@hailmary.local` |
| `INITIAL_ADMIN_PASSWORD` | No | First admin password | `HailMary2024!` |

### Assistant Service

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | Auto-provided by Railway PostgreSQL | `postgresql://...` |
| `ASSISTANT_PORT` | Yes | Assistant server port | `3002` |
| `API_BASE_URL` | Yes | Internal API URL | `http://hail-mary-api:3001` |
| `GEMINI_API_KEY` | No | Google Gemini API key | `AIza...` |
| `GEMINI_MODEL` | No | Gemini model version | `gemini-1.5-flash` |
| `NODE_ENV` | Yes | Environment mode | `production` |

### PWA Service

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Environment mode | `production` |
| `VITE_API_URL` | No | API URL (built into static files) | `https://api.railway.app` |
| `VITE_ASSISTANT_URL` | No | Assistant URL | `https://assistant.railway.app` |

## Database Management

### Automatic Migrations

Railway automatically runs database migrations on deployment:

1. API service entrypoint runs `drizzle-kit push` on startup
2. Migrations are applied before server starts
3. If migrations fail, deployment fails (safe)

### Manual Migrations

If you need to run migrations manually:

```bash
# Connect to Railway project
railway link

# Run migration
railway run npm run db:push --prefix packages/api

# Or use Railway shell
railway shell
cd packages/api
npm run db:push
```

### Backup Database

Railway provides automatic daily backups. To create manual backup:

1. Go to PostgreSQL service in Railway dashboard
2. Click **"Backups"** tab
3. Click **"Create Backup"**

### Connect to Database

```bash
# Get DATABASE_URL
railway variables get DATABASE_URL

# Connect with psql
railway connect postgresql

# Or use external tools (Postico, pgAdmin, etc.)
# Copy DATABASE_URL and use in your tool
```

## Monitoring and Logs

### View Logs

**Via Dashboard:**
1. Open service in Railway dashboard
2. Click **"Logs"** tab
3. View real-time logs

**Via CLI:**
```bash
railway logs --service hail-mary-api
railway logs --service hail-mary-assistant
railway logs --service hail-mary-pwa
```

### Health Checks

Railway automatically monitors service health:
- Checks HTTP endpoints
- Restarts unhealthy containers
- Alerts on persistent failures

### Metrics

View resource usage in Railway dashboard:
- CPU usage
- Memory usage
- Request count
- Response times

## Scaling

### Vertical Scaling

Upgrade resources in Railway dashboard:
1. Go to **Service Settings**
2. Click **"Resources"**
3. Increase memory/CPU limits

### Horizontal Scaling

Railway supports multiple replicas:
1. Go to **Service Settings**
2. Set **"Replicas"** to desired count
3. Railway load balances automatically

**Note:** Database connections may need adjustment for multiple replicas.

## Costs

### Free Tier

Railway provides $5/month credit:
- Good for development/testing
- Small production workloads
- ~100-500 hours of runtime

### Paid Tier

Usage-based pricing:
- $5/GB memory per month
- $10/vCPU per month
- $0.10/GB storage
- $0.10/GB egress

**Estimated costs for Hail-Mary:**
- API: 512MB RAM, 0.5 vCPU = ~$7.50/month
- Assistant: 256MB RAM, 0.25 vCPU = ~$3.75/month
- PWA: 256MB RAM, 0.25 vCPU = ~$3.75/month
- PostgreSQL: 1GB storage = ~$0.10/month
- **Total: ~$15/month** (for low-traffic deployment)

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
railway logs --service hail-mary-api
```

**Common issues:**
- Missing `JWT_SECRET` → Set in environment variables
- Database not ready → Increase health check timeout
- Port conflict → Ensure `PORT` matches Dockerfile `EXPOSE`

### Database Connection Errors

**Verify DATABASE_URL:**
```bash
railway variables get DATABASE_URL
```

**Check PostgreSQL status:**
1. Open PostgreSQL service in dashboard
2. Verify status is "Active"
3. Check logs for errors

### Build Failures

**Check Dockerfile paths:**
- Ensure `Dockerfile` paths are correct
- Verify monorepo structure is preserved

**Build logs:**
```bash
railway logs --deployment <deployment-id>
```

### Migration Failures

**Reset database (⚠️ deletes all data):**
```bash
railway shell
cd packages/api
npm run db:push -- --force
```

**Incremental migration:**
```bash
# Create migration SQL
railway run npm run db:generate --prefix packages/api

# Review and apply
railway run npm run db:migrate --prefix packages/api
```

## Security Best Practices

### 1. Secure JWT Secret

```bash
# Generate strong secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set in Railway (never commit to git)
railway variables set JWT_SECRET=<generated-secret>
```

### 2. Change Default Admin Password

After first login:
1. Log in with default credentials
2. Go to Settings → Profile
3. Change password immediately
4. Update `INITIAL_ADMIN_PASSWORD` in Railway

### 3. Enable Private Networking

Railway services can communicate privately:
- Use `${{service.RAILWAY_PRIVATE_DOMAIN}}` for internal URLs
- Only expose PWA publicly
- API and Assistant remain internal

### 4. Set Up Custom Domain

1. Buy domain (Namecheap, Cloudflare, etc.)
2. In Railway:
   - Go to PWA service
   - Click **"Settings"** → **"Domains"**
   - Add custom domain
   - Configure DNS (CNAME or A record)
3. Railway provides automatic SSL

## Migration from Other Platforms

### From Unraid/NAS

**Export database:**
```bash
# On Unraid
docker exec hailmary-postgres pg_dump -U postgres hailmary > backup.sql

# On Railway
railway connect postgresql < backup.sql
```

### From Google Cloud

**Export from Cloud SQL:**
```bash
# Export from GCP
gcloud sql export sql INSTANCE_NAME gs://BUCKET/backup.sql \
  --database=hailmary

# Import to Railway
gsutil cat gs://BUCKET/backup.sql | railway connect postgresql
```

### From Fly.io

**Similar to GCP:**
```bash
# Connect to Fly.io database
flyctl postgres connect -a hail-mary-db

# Export
pg_dump -U postgres hailmary > backup.sql

# Import to Railway
railway connect postgresql < backup.sql
```

## Support

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Hail-Mary Issues**: https://github.com/martinbibb-cmd/Hail-Mary/issues

## Next Steps

After successful deployment:

1. ✅ Verify all services are running
2. ✅ Log in with default admin credentials
3. ✅ Change admin password
4. ✅ Set up custom domain (optional)
5. ✅ Configure backups schedule
6. ✅ Test API endpoints
7. ✅ Test assistant features
8. ✅ Monitor logs and metrics

---

**Deployment completed!** Your Hail-Mary instance is now running on Railway with persistent PostgreSQL storage.
