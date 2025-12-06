# Google Cloud Deployment - Quick Reference

## Prerequisites Checklist

- [ ] Google Cloud account with billing enabled
- [ ] gcloud CLI installed and authenticated
- [ ] Project created in Google Cloud Console
- [ ] PostgreSQL database (Cloud SQL or external)

## One-Time Setup (5 minutes)

```bash
# Clone the repository
git clone https://github.com/martinbibb-cmd/Hail-Mary.git
cd Hail-Mary

# Run the setup script
./scripts/setup-gcp.sh --project YOUR_PROJECT_ID
```

This will:
- Enable required Google Cloud APIs
- Create Artifact Registry repository
- Configure Docker authentication
- Set up IAM permissions
- Create secrets in Secret Manager

## Deploy All Services

### Option 1: Using Cloud Build (Recommended)

```bash
gcloud builds submit --config cloudbuild.yaml
```

### Option 2: Using Deployment Scripts

```bash
# 1. Deploy API
./scripts/deploy-api-gcp.sh --project YOUR_PROJECT_ID --build

# 2. Get API URL and deploy Assistant
API_URL=$(gcloud run services describe hail-mary-api --region=us-central1 --format='value(status.url)')
./scripts/deploy-assistant-gcp.sh --project YOUR_PROJECT_ID --api-url "$API_URL" --build

# 3. Deploy PWA
./scripts/deploy-pwa-gcp.sh --project YOUR_PROJECT_ID --build
```

## Access Your Application

```bash
# Get all service URLs
gcloud run services list --region=us-central1

# Test API
API_URL=$(gcloud run services describe hail-mary-api --region=us-central1 --format='value(status.url)')
curl $API_URL/health

# Visit PWA
PWA_URL=$(gcloud run services describe hail-mary-pwa --region=us-central1 --format='value(status.url)')
echo "Visit: $PWA_URL"
```

## Common Commands

### View Logs
```bash
# API logs
gcloud run services logs read hail-mary-api --region=us-central1 --limit=50

# Follow logs in real-time
gcloud run services logs tail hail-mary-api --region=us-central1
```

### Update Deployment
```bash
# Redeploy all services
gcloud builds submit --config cloudbuild.yaml

# Or redeploy individual service
./scripts/deploy-api-gcp.sh --project YOUR_PROJECT_ID --build
```

### Rollback
```bash
# List revisions
gcloud run revisions list --service=hail-mary-api --region=us-central1

# Rollback to specific revision
gcloud run services update-traffic hail-mary-api \
  --region=us-central1 \
  --to-revisions=REVISION_NAME=100
```

### Scale Services
```bash
# Increase max instances
gcloud run services update hail-mary-api \
  --region=us-central1 \
  --max-instances=20

# Keep at least 1 instance warm (no cold starts)
gcloud run services update hail-mary-api \
  --region=us-central1 \
  --min-instances=1
```

### Update Secrets
```bash
# Update DATABASE_URL
echo -n "new-connection-string" | \
  gcloud secrets versions add DATABASE_URL --data-file=-

# Services will automatically use new version on next deployment
```

## Troubleshooting

### Service won't start
```bash
# Check logs for errors
gcloud run services logs read hail-mary-api --region=us-central1 --limit=100

# Verify secrets are accessible
gcloud secrets versions access latest --secret=DATABASE_URL
```

### Database connection issues
```bash
# Test database connection
gcloud sql connect hail-mary-db --user=postgres

# Or use Cloud SQL Proxy locally
cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_NAME
```

### Build fails
```bash
# Check build logs
gcloud builds list --limit=5

# View specific build
gcloud builds log BUILD_ID
```

## Cost Management

### Monitor spending
```bash
# Set up billing alerts in Cloud Console
# Navigation: Billing > Budgets & alerts

# Or use CLI
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Hail-Mary Monthly Budget" \
  --budget-amount=50USD
```

### Optimize costs
- Use `--min-instances=0` to scale to zero when idle
- Right-size CPU and memory allocations
- Enable request timeout to prevent runaway costs
- Use Cloud CDN for static assets

## GitHub Actions (CI/CD)

The repository includes a GitHub Actions workflow for automated deployments.

### Setup Workload Identity Federation (Recommended)

1. Create Workload Identity Pool and Provider
2. Add repository secrets:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - `GCP_SERVICE_ACCOUNT`

### Or use Service Account Key (Alternative)

1. Create service account with required permissions
2. Generate JSON key
3. Add as GitHub secret: `GCP_SA_KEY`

See `.github/workflows/deploy-gcp.yml` for details.

## Resources

- [Full Documentation](docs/DEPLOYMENT-GCP.md)
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)
- [Cloud Build Docs](https://cloud.google.com/build/docs)
- [Secret Manager Docs](https://cloud.google.com/secret-manager/docs)

## Support

For deployment issues:
1. Check the logs: `gcloud run services logs read SERVICE_NAME`
2. Review [docs/DEPLOYMENT-GCP.md](docs/DEPLOYMENT-GCP.md)
3. Open an issue on GitHub with error logs
