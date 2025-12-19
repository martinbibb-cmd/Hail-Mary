# AI Gateway Implementation Summary

## Overview

This document summarizes the implementation of the AI Gateway that wires the hailmary-api to the Cloudflare Worker, following **Option A** from the requirements.

## What Was Implemented

### 1. Environment Configuration

Added `WORKER_URL` environment variable to `.env.example`:
```bash
WORKER_URL=https://hail-mary.martinbibb.workers.dev
```

This variable:
- Is required for AI endpoints to work
- Points to the deployed Cloudflare Worker
- Is used by the API server (not exposed to PWA/browser)
- Backward compatible with `ROCKY_WORKER_URL` for existing deployments

### 2. API Gateway Endpoints

Three endpoints were updated in `packages/api/src/routes/ai.ts`:

#### GET `/api/ai/health`
- **Purpose**: Check if Worker is available
- **Proxies to**: `${WORKER_URL}/health`
- **Timeout**: 10 seconds
- **Auth**: None (public endpoint for monitoring)
- **Returns**: 
  - 200: Worker health status with provider availability
  - 500: `{"error": "WORKER_URL not set"}`
  - 503: `{"error": "fetch failed"}` when Worker unreachable

#### POST `/api/ai/rocky`
- **Purpose**: Proxy Rocky fact extraction requests
- **Proxies to**: `${WORKER_URL}/rocky/analyse`
- **Timeout**: 10 seconds
- **Auth**: Required (`requireAuth` middleware)
- **Returns**: Worker response or error

#### POST `/api/ai/sarah`
- **Purpose**: Proxy Sarah explanation generation requests  
- **Proxies to**: `${WORKER_URL}/sarah/explain`
- **Timeout**: 10 seconds
- **Auth**: Required (`requireAuth` middleware)
- **Returns**: Worker response or error

### 3. Request Logging

All proxy requests log the following:
```
🔍 AI Gateway: GET /health -> https://hail-mary.martinbibb.workers.dev/health
✅ AI Gateway: GET /health completed - status: 200, duration: 45ms
```

Or on error:
```
❌ AI Gateway: GET /health failed - duration: 11ms, error: fetch failed
```

This ensures visibility into:
- Which endpoint was called
- What Worker URL was used
- HTTP status code
- Request duration

### 4. PWA Client Update

Updated `packages/pwa/src/services/rockyClient.ts` to use API gateway:

**Before** (direct Worker calls):
```typescript
const WORKER_URL = 'https://hail-mary.martinbibb.workers.dev';
fetch(`${WORKER_URL}/health`)
fetch(`${WORKER_URL}/rocky/analyse`)
```

**After** (API gateway):
```typescript
const API_BASE_URL = '/api/ai';
fetch(`${API_BASE_URL}/health`, { credentials: 'include' })
fetch(`${API_BASE_URL}/rocky`, { credentials: 'include' })
```

Benefits:
- No CORS issues (same-origin requests)
- Authentication handled by API
- Worker URL not exposed to browser
- Centralized error handling

### 5. Smoke Test Script

Created `scripts/ai-smoke-test.sh` that:
- Tests if API is running
- Calls `/api/ai/health` endpoint
- Validates response
- Returns exit code 0 on success, 1 on failure
- Provides clear error messages for different scenarios

Added npm script:
```bash
npm run ai:smoke
```

Exit codes:
- `0`: Worker is reachable and healthy
- `1`: API not running, WORKER_URL not set, or Worker unreachable

### 6. Documentation

Created two comprehensive documentation files:
- `docs/AI_SMOKE_TEST.md` - Smoke test usage and troubleshooting
- `docs/IMPLEMENTATION_AI_GATEWAY.md` - This file

## Architecture

### Request Flow

```
┌─────────────┐
│ PWA Browser │
└──────┬──────┘
       │ /api/ai/health
       │ /api/ai/rocky
       │ /api/ai/sarah
       ↓
┌──────────────────┐
│ API Server       │ ← WORKER_URL env var
│ (Express)        │
└──────┬───────────┘
       │ https://hail-mary.martinbibb.workers.dev/health
       │ https://hail-mary.martinbibb.workers.dev/rocky/analyse
       │ https://hail-mary.martinbibb.workers.dev/sarah/explain
       ↓
┌──────────────────┐
│ Cloudflare       │ ← API keys in Worker secrets
│ Worker           │
└──────┬───────────┘
       │ Gemini API
       │ OpenAI API
       │ Anthropic API
       ↓
┌──────────────────┐
│ AI Providers     │
└──────────────────┘
```

### Security Boundaries

1. **Browser → API**: Standard CORS, authentication via JWT
2. **API → Worker**: HTTPS, timeout protection, error handling
3. **Worker → AI Providers**: API keys stored as Worker secrets

The PWA **never** has access to:
- Worker URL (only API knows it)
- API keys (only Worker has them)

## Configuration

### Development

Create `.env` file:
```bash
# Required for API
JWT_SECRET=your-secure-jwt-secret-here
DATABASE_URL=postgres://...

# Required for AI Gateway
WORKER_URL=https://hail-mary.martinbibb.workers.dev

# Optional
PORT=3001
NODE_ENV=development
```

### Production

Set environment variables in your deployment platform:
```bash
JWT_SECRET=...
DATABASE_URL=...
WORKER_URL=https://hail-mary.martinbibb.workers.dev
```

### Docker Compose

Add to `docker-compose.yml`:
```yaml
services:
  api:
    environment:
      - WORKER_URL=https://hail-mary.martinbibb.workers.dev
```

## Verification

### 1. Check API is running
```bash
curl http://localhost:3001/health
```

### 2. Check AI Gateway is configured
```bash
curl http://localhost:3001/api/ai/health
```

Expected responses:

**Success** (Worker reachable):
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

**WORKER_URL not set**:
```json
{
  "error": "WORKER_URL not set"
}
```

**Worker unreachable**:
```json
{
  "error": "fetch failed"
}
```

### 3. Run smoke test
```bash
npm run ai:smoke
```

Expected output on success:
```
==========================================
AI Gateway Smoke Test
==========================================
Testing: http://localhost:3001/api/ai/health

Checking if API is running... OK
Testing /api/ai/health endpoint... OK
Response:
{
  "ok": true,
  "providers": {
    "gemini": true,
    "openai": false,
    "anthropic": false
  }
}

✅ AI Gateway smoke test PASSED
The API is properly wired to the Cloudflare Worker
```

### 4. Check Cloudflare Worker analytics

After calling the endpoints, verify in Cloudflare dashboard:
1. Go to Workers & Pages → hail-mary-worker
2. Check Metrics tab
3. Confirm requests are appearing

## Troubleshooting

### API logs show "WORKER_URL not configured"
**Solution**: Add `WORKER_URL` to your `.env` file

### API logs show "fetch failed"
**Possible causes**:
1. Worker not deployed - run `cd packages/worker && wrangler deploy`
2. Worker URL incorrect - verify in Cloudflare dashboard
3. Network connectivity issues - check firewall/proxy settings

### PWA shows "Network error"
**Check**:
1. API server is running: `curl http://localhost:3001/health`
2. AI endpoints exist: `curl http://localhost:3001/api/ai/health`
3. Browser console for detailed error messages

### Smoke test fails
**Possible causes**:
1. API not running - start with `npm run api:dev`
2. Wrong port - check `PORT` environment variable
3. WORKER_URL not set - add to `.env`

## CI Integration (Optional)

To add smoke test to CI, add this job to `.github/workflows/test.yml`:

```yaml
jobs:
  ai-smoke-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build:base && npm run build -w packages/api
      
      - name: Start API
        run: |
          JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
          WORKER_URL=${{ secrets.WORKER_URL }} \
          JWT_SECRET=$JWT_SECRET \
          NODE_ENV=test \
          npm run start -w packages/api &
          sleep 10
      
      - name: Run smoke test
        run: npm run ai:smoke
```

Add `WORKER_URL` to GitHub repository secrets.

## Maintenance

### Updating Worker URL

1. Update in `.env` file (development)
2. Update in deployment config (production)
3. Restart API server
4. Run smoke test to verify: `npm run ai:smoke`

### Monitoring

The smoke test can be run periodically to verify the integration:
- Run in CI/CD pipeline
- Run from monitoring service (e.g., cron job)
- Manual testing before deployment

Endpoint `/api/ai/health` is designed for health checks and should not be rate-limited by monitoring systems.

## Related Files

- `packages/api/src/routes/ai.ts` - API gateway implementation
- `packages/pwa/src/services/rockyClient.ts` - PWA client (updated to use API)
- `packages/pwa/src/services/ai.service.ts` - Alternative PWA client
- `packages/worker/src/index.ts` - Cloudflare Worker implementation
- `scripts/ai-smoke-test.sh` - Smoke test script
- `.env.example` - Environment variable documentation

## See Also

- [AI Smoke Test Documentation](./AI_SMOKE_TEST.md)
- [Worker README](../packages/worker/README.md)
- [API Documentation](../packages/api/README.md)
