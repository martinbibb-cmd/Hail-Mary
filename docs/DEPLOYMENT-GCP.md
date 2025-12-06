# Google Cloud Deployment Guide 🚀

This guide explains how to deploy Hail-Mary to Google Cloud Platform (GCP) using Cloud Run.

## Overview

Hail-Mary is a monorepo with three deployable services:
- **API** (`hail-mary-api`) - Backend REST API
- **Assistant** (`hail-mary-assistant`) - AI assistant service
- **PWA** (`hail-mary-pwa`) - Frontend web application

Each service runs as a separate Cloud Run service and communicates over HTTPS.

## Architecture on Google Cloud

```
┌─────────────────┐
│   Cloud SQL     │
│  (PostgreSQL)   │
└────────┬────────┘
         │
         ├──────────┐──────────┐
         │          │          │
┌────────▼────────┐ │          │
│  Cloud Run      │ │          │
│  hail-mary-api  │ │          │
│  (Backend API)  │ │          │
└────────┬────────┘ │          │
         │          │          │
    ┌────▼──────────▼────┐     │
    │    Cloud Run       │     │
    │ hail-mary-assistant│     │
    │  (AI Assistant)    │     │
    └────────────────────┘     │
                               │
                        ┌──────▼──────┐
                        │  Cloud Run  │
                        │hail-mary-pwa│
                        │  (Frontend) │
                        └─────────────┘
```

## Prerequisites

### 1. Install Google Cloud SDK

```bash
# Install gcloud CLI
# Follow instructions at: https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable Required APIs

```bash
# Enable necessary Google Cloud APIs
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com
```

### 3. Create Artifact Registry Repository

```bash
# Create a Docker repository in Artifact Registry
gcloud artifacts repositories create hail-mary \
  --repository-format=docker \
  --location=us-central1 \
  --description="Hail-Mary container images"

# Configure Docker authentication
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### 4. Set Up Cloud SQL (PostgreSQL)

```bash
# Create a PostgreSQL instance
gcloud sql instances create hail-mary-db \
  --database-version=POSTGRES_17 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=CHOOSE_A_SECURE_PASSWORD

# Create the database
gcloud sql databases create hailmary --instance=hail-mary-db

# Get the connection string (for Cloud Run)
# Format: postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
# Or use Cloud SQL Proxy in production
```

Alternatively, you can use an external PostgreSQL database (e.g., from a managed provider).

### 5. Create Secrets in Secret Manager

Store sensitive configuration values in Google Cloud Secret Manager:

```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -hex 32)

# Create secrets
echo -n "postgresql://USER:PASSWORD@HOST:5432/hailmary" | \
  gcloud secrets create DATABASE_URL --data-file=-

echo -n "$JWT_SECRET" | \
  gcloud secrets create JWT_SECRET --data-file=-

# Optional: For AI Assistant
echo -n "your-gemini-api-key" | \
  gcloud secrets create GEMINI_API_KEY --data-file=-

# Optional: Initial admin credentials
echo -n "admin@example.com" | \
  gcloud secrets create INITIAL_ADMIN_EMAIL --data-file=-

echo -n "YourSecurePassword123!" | \
  gcloud secrets create INITIAL_ADMIN_PASSWORD --data-file=-
```

### 6. Grant Cloud Run Access to Secrets

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')

# Grant Secret Manager access to Cloud Run service account
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Deployment Methods

### Method 1: Using Deployment Scripts (Recommended for Quick Start)

We provide convenient bash scripts for deploying each service:

```bash
# Deploy API
./scripts/deploy-api-gcp.sh \
  --project YOUR_PROJECT_ID \
  --region us-central1 \
  --build

# Get the API URL
API_URL=$(gcloud run services describe hail-mary-api --region=us-central1 --format='value(status.url)')

# Deploy Assistant
./scripts/deploy-assistant-gcp.sh \
  --project YOUR_PROJECT_ID \
  --region us-central1 \
  --api-url "$API_URL" \
  --build

# Deploy PWA
./scripts/deploy-pwa-gcp.sh \
  --project YOUR_PROJECT_ID \
  --region us-central1 \
  --build
```

### Method 2: Using Cloud Build (Recommended for CI/CD)

Deploy all services at once using Cloud Build:

```bash
# Submit build to Cloud Build
gcloud builds submit --config cloudbuild.yaml

# Or create a GitHub trigger for automated deployments
gcloud builds triggers create github \
  --repo-name=Hail-Mary \
  --repo-owner=martinbibb-cmd \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

### Method 3: Manual Deployment

#### Deploy API Service

```bash
# Build and deploy API
gcloud run deploy hail-mary-api \
  --source=. \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=3001 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars=NODE_ENV=production,PORT=3001 \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest \
  --timeout=300s
```

#### Deploy Assistant Service

```bash
# Get API URL
API_URL=$(gcloud run services describe hail-mary-api --region=us-central1 --format='value(status.url)')

# Build and deploy Assistant
gcloud run deploy hail-mary-assistant \
  --source=. \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=3002 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --set-env-vars=NODE_ENV=production,ASSISTANT_PORT=3002,API_BASE_URL="$API_URL",GEMINI_MODEL=gemini-1.5-flash \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --timeout=300s
```

#### Deploy PWA Service

```bash
# Build and deploy PWA
gcloud run deploy hail-mary-pwa \
  --source=. \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars=NODE_ENV=production \
  --timeout=60s
```

## Post-Deployment

### 1. Run Database Migrations

Connect to the API service and run migrations:

```bash
# Get a shell in the Cloud Run container
gcloud run services proxy hail-mary-api --region=us-central1

# In another terminal, connect and run migrations
# (Or use Cloud SQL proxy to connect directly to the database)
```

For production, consider running migrations as part of the deployment process or using a Cloud Build step.

### 2. Access Your Application

```bash
# Get service URLs
gcloud run services list --platform=managed --region=us-central1

# Test the API
API_URL=$(gcloud run services describe hail-mary-api --region=us-central1 --format='value(status.url)')
curl $API_URL/health

# Access the PWA
PWA_URL=$(gcloud run services describe hail-mary-pwa --region=us-central1 --format='value(status.url)')
echo "Visit: $PWA_URL"
```

### 3. Configure Custom Domain (Optional)

```bash
# Add a custom domain to your PWA
gcloud run domain-mappings create \
  --service=hail-mary-pwa \
  --domain=yourdomain.com \
  --region=us-central1

# Follow the instructions to verify domain ownership and configure DNS
```

## Environment Variables

### API Service

| Variable | Description | Source |
|----------|-------------|--------|
| `DATABASE_URL` | PostgreSQL connection string | Secret Manager |
| `JWT_SECRET` | Secret for JWT tokens | Secret Manager |
| `PORT` | Server port | Environment |
| `NODE_ENV` | Environment (production) | Environment |
| `INITIAL_ADMIN_EMAIL` | First admin user email (optional) | Secret Manager |
| `INITIAL_ADMIN_PASSWORD` | First admin password (optional) | Secret Manager |

### Assistant Service

| Variable | Description | Source |
|----------|-------------|--------|
| `GEMINI_API_KEY` | Google Gemini API key | Secret Manager |
| `DATABASE_URL` | PostgreSQL connection string | Secret Manager |
| `API_BASE_URL` | URL of the API service | Environment |
| `ASSISTANT_PORT` | Server port | Environment |
| `GEMINI_MODEL` | Gemini model to use | Environment |
| `NODE_ENV` | Environment (production) | Environment |

### PWA Service

The PWA is a static site served by nginx. Environment variables are baked into the build.

## Monitoring and Logging

### View Logs

```bash
# API logs
gcloud run services logs read hail-mary-api --region=us-central1 --limit=50

# Assistant logs
gcloud run services logs read hail-mary-assistant --region=us-central1 --limit=50

# PWA logs
gcloud run services logs read hail-mary-pwa --region=us-central1 --limit=50

# Follow logs in real-time
gcloud run services logs tail hail-mary-api --region=us-central1
```

### Monitoring Dashboard

Access Cloud Run metrics:
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Navigate to Cloud Run
- Select your service
- View metrics: requests, latency, errors, CPU, memory

### Set Up Alerts

```bash
# Example: Create alert for high error rate
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High API Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-expression='
    resource.type = "cloud_run_revision"
    AND resource.labels.service_name = "hail-mary-api"
    AND metric.type = "run.googleapis.com/request_count"
    AND metric.labels.response_code_class = "5xx"'
```

## Scaling

Cloud Run automatically scales based on traffic. Adjust settings:

```bash
# Update API scaling
gcloud run services update hail-mary-api \
  --region=us-central1 \
  --min-instances=1 \
  --max-instances=20 \
  --concurrency=80

# Update memory/CPU
gcloud run services update hail-mary-api \
  --region=us-central1 \
  --memory=2Gi \
  --cpu=2
```

## Cost Optimization

### Free Tier Limits

Cloud Run provides generous free tier:
- 2 million requests/month
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds of compute time

### Optimization Tips

1. **Use `min-instances=0`** - Scale to zero when idle
2. **Right-size resources** - Start with smaller instances
3. **Enable request timeout** - Prevent runaway requests
4. **Use Cloud CDN** - Cache static assets from PWA
5. **Monitor usage** - Set up billing alerts

```bash
# Set billing alert
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Hail-Mary Monthly Budget" \
  --budget-amount=50USD
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
gcloud run services logs read hail-mary-api --region=us-central1 --limit=100

# Verify secrets are accessible
gcloud secrets versions access latest --secret=DATABASE_URL

# Test container locally
docker run -p 3001:3001 \
  -e DATABASE_URL="postgres://..." \
  -e JWT_SECRET="..." \
  us-central1-docker.pkg.dev/PROJECT_ID/hail-mary/api:latest
```

### Database Connection Issues

- Verify Cloud SQL instance is running
- Check database credentials in DATABASE_URL secret
- Ensure Cloud Run service account has Cloud SQL Client role
- Consider using Cloud SQL Proxy for secure connections

### High Cold Start Times

- Increase `min-instances` to keep instances warm
- Optimize Docker image size
- Use Cloud Build caching

## Security Best Practices

1. **Use Secret Manager** - Never hardcode secrets
2. **Enable VPC Connector** - Isolate database traffic
3. **Restrict IAM permissions** - Follow least privilege
4. **Enable Cloud Armor** - Add WAF protection
5. **Regular security updates** - Keep dependencies updated

```bash
# Example: Restrict API to authenticated users only
gcloud run services update hail-mary-api \
  --region=us-central1 \
  --no-allow-unauthenticated
```

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy-gcp.yml`:

```yaml
name: Deploy to Google Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - id: auth
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Deploy to Cloud Build
        run: |
          gcloud builds submit --config cloudbuild.yaml
```

## Updating Deployments

```bash
# Redeploy after code changes
gcloud builds submit --config cloudbuild.yaml

# Or deploy individual services
./scripts/deploy-api-gcp.sh --project YOUR_PROJECT_ID --build
./scripts/deploy-assistant-gcp.sh --project YOUR_PROJECT_ID --api-url "$API_URL" --build
./scripts/deploy-pwa-gcp.sh --project YOUR_PROJECT_ID --build
```

## Rolling Back

```bash
# List revisions
gcloud run revisions list --service=hail-mary-api --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic hail-mary-api \
  --region=us-central1 \
  --to-revisions=REVISION_NAME=100
```

## Additional Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)

## Support

For issues specific to Hail-Mary deployment:
- Check existing deployment guides: [Fly.io](DEPLOYMENT-FLY.md), [unRAID](DEPLOYMENT-unRAID.md)
- Open an issue on GitHub
- Review Cloud Run logs for error details
