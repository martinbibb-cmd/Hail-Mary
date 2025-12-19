# AI Gateway Smoke Test

This document describes the AI gateway smoke test that verifies the API is properly wired to the Cloudflare Worker.

## Overview

The smoke test (`scripts/ai-smoke-test.sh`) validates that:
1. The API server is running
2. The `/api/ai/health` endpoint exists
3. The endpoint properly proxies requests to the Cloudflare Worker

## Running the Smoke Test

### Locally

```bash
# Start the API server first
npm run api:dev

# In another terminal, run the smoke test
npm run ai:smoke
```

### Environment Variables

The smoke test uses these environment variables:
- `API_HOST` - API hostname (default: `localhost`)
- `API_PORT` - API port (default: `3001`)

Example:
```bash
API_HOST=myserver API_PORT=8080 npm run ai:smoke
```

## Exit Codes

The smoke test returns different exit codes based on the result:

- `0` - Success: API is properly wired to Worker and Worker returned 200
- `1` - Failure: One of the following:
  - API is not running
  - `/api/ai/health` endpoint doesn't exist or returned unexpected status
  - `WORKER_URL` environment variable is not set (HTTP 500)
  - Worker is not reachable (HTTP 503)

## Expected Responses

### Success (200)
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

### WORKER_URL Not Set (500)
```json
{
  "error": "WORKER_URL not set"
}
```

### Worker Unreachable (503)
```json
{
  "error": "fetch failed"
}
```

## CI Integration

To add this test to GitHub Actions, add a job to your workflow:

```yaml
  smoke-test:
    runs-on: ubuntu-latest
    needs: build-api
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build API
        run: npm run build:base && npm run build -w packages/api
      
      - name: Start API
        run: |
          JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
          WORKER_URL=https://hail-mary.martinbibb.workers.dev \
          JWT_SECRET=$JWT_SECRET \
          NODE_ENV=test \
          npm run start -w packages/api &
          sleep 10
      
      - name: Run AI smoke test
        run: npm run ai:smoke
```

## Troubleshooting

### API Not Running
```
Error: API is not reachable at http://localhost:3001
Make sure the API server is running:
  npm run api:dev
```

**Solution**: Start the API server in a separate terminal.

### WORKER_URL Not Set
```
⚠️  WORKER_URL environment variable not set
```

**Solution**: Add `WORKER_URL` to your `.env` file:
```
WORKER_URL=https://hail-mary.martinbibb.workers.dev
```

### Worker Not Reachable
```
⚠️  Worker is not reachable
```

**Solutions**:
1. Check that the Worker is deployed: `cd packages/worker && wrangler deploy`
2. Verify the Worker URL is correct in `.env`
3. Check network connectivity to `workers.dev`
4. Check Cloudflare Worker logs for errors

## Architecture

The AI gateway architecture ensures:
- **Security**: PWA never calls Worker directly (no CORS issues, API keys protected)
- **Logging**: All Worker requests are logged by the API (method/path/status/duration)
- **Analytics**: Cloudflare Worker analytics show all requests from the API
- **Error Handling**: API provides consistent error responses (500 for config issues, 503 for Worker issues)

### Request Flow

```
PWA (Browser)
    ↓ /api/ai/health
    ↓ /api/ai/rocky
    ↓ /api/ai/sarah
API Server (Express)
    ↓ https://hail-mary.martinbibb.workers.dev/health
    ↓ https://hail-mary.martinbibb.workers.dev/rocky/analyse
    ↓ https://hail-mary.martinbibb.workers.dev/sarah/explain
Cloudflare Worker
    ↓ Gemini/OpenAI/Anthropic APIs
AI Providers
```

## See Also

- [API Routes Documentation](../packages/api/src/routes/ai.ts)
- [Worker Implementation](../packages/worker/src/index.ts)
- [PWA AI Client](../packages/pwa/src/services/rockyClient.ts)
