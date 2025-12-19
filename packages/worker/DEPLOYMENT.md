# Worker Deployment Guide

This guide walks through deploying the Hail-Mary Worker (Rocky + Sarah) to Cloudflare.

## Deployment Methods

There are two ways to deploy the worker:

1. **Automatic (Recommended)**: GitHub Actions automatically deploys when you push changes to main
2. **Manual**: Deploy directly from your local machine using Wrangler CLI

## Automatic Deployment (GitHub Actions)

The repository includes a GitHub Actions workflow that automatically deploys the worker when you push changes to the `main` branch.

### Setup GitHub Secrets

Before the automatic deployment can work, you need to add these secrets to your GitHub repository:

1. Go to your repository settings → Secrets and variables → Actions
2. Add the following secrets:
   - **CLOUDFLARE_API_TOKEN**: Create an API token at https://dash.cloudflare.com/profile/api-tokens
     - Click "Create Token"
     - Use the "Edit Cloudflare Workers" template
     - Copy the token and save it as a secret
   - **CLOUDFLARE_ACCOUNT_ID**: Find your account ID at https://dash.cloudflare.com/
     - Copy the Account ID from the right sidebar
     - Save it as a secret

### Trigger Automatic Deployment

The workflow automatically runs when:
- You push changes to `main` branch that affect `packages/worker/**`
- You manually trigger it from the Actions tab

The workflow includes retry logic (3 attempts with 10 second wait between retries) for reliable deployments.

### Manual Trigger

You can also manually trigger a deployment from GitHub:
1. Go to the "Actions" tab in your repository
2. Select "Deploy Cloudflare Worker" workflow
3. Click "Run workflow"
4. Select the branch and click "Run workflow"

## Manual Deployment

### Prerequisites

1. **Cloudflare Account**: Sign up at https://cloudflare.com
2. **Wrangler CLI**: Already installed in this project
3. **API Keys**: At least one of:
   - Gemini API Key (recommended, fastest): https://aistudio.google.com/app/apikey
   - OpenAI API Key (fallback): https://platform.openai.com/api-keys
   - Anthropic API Key (fallback): https://console.anthropic.com/

## Step 1: Authenticate with Cloudflare

```bash
cd packages/worker
npx wrangler login
```

This opens your browser to authenticate with Cloudflare.

## Step 2: Set API Keys as Secrets

Secrets are encrypted environment variables that are never visible in logs or code.

### Set Gemini API Key (Primary)

```bash
npx wrangler secret put GEMINI_API_KEY
```

When prompted, paste your Gemini API key and press Enter.

### Set OpenAI API Key (Optional Fallback)

```bash
npx wrangler secret put OPENAI_API_KEY
```

### Set Anthropic API Key (Optional Fallback)

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

**Note**: You only need ONE API key for the worker to function, but having all three provides maximum reliability through fallback.

## Step 3: Review Configuration

Open `wrangler.toml` and verify the configuration:

```toml
[vars]
# Sarah (explanation layer) configuration
SARAH_MODEL = "gemini-1.5-flash"      # Fast, cost-effective
SARAH_TEMPERATURE = "0.3"             # Balanced creativity
SARAH_MAX_TOKENS = "500"              # Enough for explanations

# Rocky (analysis engine) configuration  
ROCKY_MODEL = "gemini-1.5-pro"        # More capable for analysis
ROCKY_TEMPERATURE = "0.2"             # More deterministic
ROCKY_MAX_TOKENS = "600"              # Enough for structured output
```

You can adjust these values if needed:
- **Models**: Use Gemini model names (e.g., `gemini-2.0-flash`, `gemini-1.5-pro`)
- **Temperature**: 0.0 = deterministic, 1.0 = creative (recommended: 0.2-0.3)
- **Max Tokens**: Adjust based on your needs (200-1000)

## Step 4: Deploy the Worker

```bash
npx wrangler deploy
```

You'll see output like:

```
Total Upload: 11.99 KiB / gzip: 3.15 KiB
Uploaded hail-mary-worker (1.23 sec)
Deployed hail-mary-worker triggers (0.45 sec)
  https://hail-mary-worker.<your-subdomain>.workers.dev
✨ Done in 2.1s
```

**Important**: Copy the worker URL - you'll need it to configure your application.

## Step 5: Test the Deployment

### Test Health Endpoint

```bash
curl https://hail-mary-worker.<your-subdomain>.workers.dev/health
```

Expected response:
```json
{
  "ok": true,
  "providers": {
    "gemini": true,
    "openai": false,
    "anthropic": false
  }
}
```

### Test Rocky Endpoint

```bash
curl -X POST https://hail-mary-worker.<your-subdomain>.workers.dev/rocky/analyse \
  -H "Content-Type: application/json" \
  -d '{
    "visitId": "test-123",
    "transcriptChunk": "Boiler making whistling noise",
    "snapshot": {}
  }'
```

### Test Sarah Endpoint

```bash
curl -X POST https://hail-mary-worker.<your-subdomain>.workers.dev/sarah/explain \
  -H "Content-Type: application/json" \
  -d '{
    "rockyResult": {
      "providerUsed": "gemini",
      "plainEnglishSummary": "Boiler has a whistling noise issue",
      "technicalRationale": "Likely a pressure relief valve issue",
      "keyDetailsDelta": {},
      "checklistDelta": {},
      "blockers": []
    },
    "context": "customer"
  }'
```

### Run Full Test Suite

```bash
node test-worker.js https://hail-mary-worker.<your-subdomain>.workers.dev
```

## Step 6: Configure Your Application

Update your `.env` file with the worker URL:

```bash
# Rocky configuration
VITE_WORKER_URL=https://hail-mary-worker.<your-subdomain>.workers.dev

# Sarah configuration (same URL)
SARAH_BASE_URL=https://hail-mary-worker.<your-subdomain>.workers.dev
SARAH_WORKER_URL=https://hail-mary-worker.<your-subdomain>.workers.dev
```

Then rebuild and restart your application:

```bash
# If using Docker Compose
docker-compose down
docker-compose up -d --build

# Or if running locally
npm run build
npm run start
```

## Troubleshooting

### Health check shows all providers as false

**Problem**: All API keys are missing or incorrect.

**Solution**: 
```bash
# Check which secrets are set
npx wrangler secret list

# Set the missing secrets
npx wrangler secret put GEMINI_API_KEY
```

### Worker returns "Gemini failed: 400"

**Problem**: Invalid API key or incorrect model name.

**Solution**:
1. Verify your API key is valid: https://aistudio.google.com/app/apikey
2. Check that ROCKY_MODEL and SARAH_MODEL are valid Gemini model names
3. Re-set the secret:
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```

### Worker returns "All providers failed"

**Problem**: All API keys are either missing, invalid, or rate-limited.

**Solution**:
1. Check worker logs: `npx wrangler tail`
2. Verify API key quotas and billing
3. Ensure at least one API key is valid

### Cannot access worker URL from application

**Problem**: CORS or network connectivity issues.

**Solution**:
1. Check the worker logs: `npx wrangler tail`
2. Verify CORS headers allow your domain
3. Test from command line to isolate the issue:
   ```bash
   curl -v https://your-worker.workers.dev/health
   ```

## Monitoring

### View Real-time Logs

```bash
npx wrangler tail
```

This shows all requests and errors in real-time.

### View Usage Statistics

```bash
npx wrangler metrics
```

Shows request count, errors, and performance metrics.

## Updating the Worker

After making code changes:

```bash
cd packages/worker
npx wrangler deploy
```

Deployment is instant - no downtime.

## Custom Domains (Optional)

To use your own domain instead of `*.workers.dev`:

1. Add a Workers route in Cloudflare dashboard
2. Update `wrangler.toml`:
   ```toml
   routes = [
     { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
   ]
   ```
3. Deploy: `npx wrangler deploy`

## Cost Estimation

Cloudflare Workers:
- **Free Tier**: 100,000 requests/day
- **Paid**: $5/month for 10 million requests

AI Provider Costs (estimated):
- **Gemini Flash**: ~$0.02 per 1000 requests (cheapest)
- **GPT-4o-mini**: ~$0.15 per 1000 requests
- **Claude 3.5**: ~$3 per 1000 requests

**Recommended**: Use Gemini as primary for best cost/performance ratio.

## Security Best Practices

1. **Never commit API keys** - Always use `wrangler secret put`
2. **Rotate keys regularly** - Update secrets every 90 days
3. **Monitor usage** - Set up billing alerts
4. **Use rate limiting** - Consider adding rate limits in production
5. **Restrict domains** - Tighten CORS in production (edit `corsHeaders()` function)

## Next Steps

Now that Sarah is deployed:

1. ✅ Worker is live with both Rocky and Sarah endpoints
2. 🔄 Next: Update PWA to use Sarah for explanations
3. 🔄 Next: Add UI toggle between Rocky (technical) and Sarah (friendly) modes
4. 🔄 Next: Implement tablet mode with Sarah-assisted visit capture

The foundation is solid. Sarah is ready to explain Rocky's findings in a human-friendly way! 🚀
