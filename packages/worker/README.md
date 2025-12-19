# Hail-Mary Worker - AI Analysis & Explanation

This Cloudflare Worker provides two AI services:
- **Rocky**: Deterministic analysis engine for visit observations
- **Sarah**: Human-friendly explanation layer for Rocky's results

Both services use provider fallback (Gemini → OpenAI → Anthropic).

## Endpoints

### GET /health
Returns health status and available providers.

**Response:**
```json
{
  "ok": true,
  "providers": {
    "gemini": true,
    "openai": true,
    "anthropic": false
  }
}
```

### POST /rocky/analyse
Analyses visit observations using AI with provider fallback. Rocky provides deterministic, structured analysis.

**Request:**
```json
{
  "visitId": "123",
  "transcriptChunk": "Boiler is making a whistling noise...",
  "snapshot": {}
}
```

**Response:**
```json
{
  "ok": true,
  "providerUsed": "gemini",
  "plainEnglishSummary": "Boiler has a whistling noise issue...",
  "technicalRationale": "Likely a pressure relief valve issue...",
  "keyDetailsDelta": {},
  "checklistDelta": {},
  "blockers": []
}
```

### POST /sarah/explain
Generates human-friendly explanations of Rocky's analysis results. Sarah never analyzes raw data directly—only explains Rocky's findings.

**Request:**
```json
{
  "rockyResult": {
    "providerUsed": "gemini",
    "plainEnglishSummary": "Boiler has a whistling noise issue...",
    "technicalRationale": "Likely a pressure relief valve issue...",
    "keyDetailsDelta": {},
    "checklistDelta": {},
    "blockers": []
  },
  "context": "customer"
}
```

**Context Options:**
- `"customer"` - Warm, simple, non-technical explanation
- `"engineer"` - Concise technical summary with actionable items

**Response:**
```json
{
  "ok": true,
  "message": "Your boiler is making a whistling sound, which usually indicates a pressure issue. The engineer will check the pressure relief valve and make sure everything is working safely."
}
```

## Deployment

### Prerequisites

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Ensure secrets are configured (run once):
   ```bash
   cd packages/worker
   wrangler secret put GEMINI_API_KEY
   wrangler secret put OPENAI_API_KEY
   wrangler secret put ANTHROPIC_API_KEY
   ```

### Deploy

```bash
cd packages/worker
wrangler deploy
```

This deploys to: `https://hail-mary.martinbibb.workers.dev`

### Verify Deployment

After deployment, verify the endpoints work:

```bash
# Check health endpoint
curl -i https://hail-mary.martinbibb.workers.dev/health

# Expected response:
# HTTP/2 200
# {
#   "ok": true,
#   "providers": {
#     "gemini": true,
#     "openai": false,
#     "anthropic": false
#   }
# }
```

### Check Logs

View real-time logs:
```bash
wrangler tail
```

## Architecture

### Rocky (Deterministic Analysis)
- Structured JSON output
- Rule-based analysis
- Numbers, facts, checklists
- No "thinking" or creativity

### Sarah (Explanation Layer)
- Natural language explanations
- Customer or engineer context
- Uses Rocky's output only
- Never invents facts or analyzes raw data

## Provider Fallback

Both Rocky and Sarah attempt to use providers in this order:
1. **Gemini** (default) - Fast and cost-effective
2. **OpenAI** - Fallback if Gemini fails
3. **Anthropic** - Final fallback if both fail

If all providers fail, both services return safe fallback responses.

## CORS

The worker allows cross-origin requests from:
- hail-mary.cloudbibb.uk
- localhost (for development)

CORS can be tightened in production by modifying the `corsHeaders` function.

## Configuration

AI configuration is set in `wrangler.toml`:
- `SARAH_MODEL`: Model for explanations (default: gemini-1.5-flash)
- `SARAH_TEMPERATURE`: Temperature for Sarah (default: 0.3)
- `SARAH_MAX_TOKENS`: Max tokens for Sarah (default: 500)
- `ROCKY_MODEL`: Model for analysis (default: gemini-1.5-pro)
- `ROCKY_TEMPERATURE`: Temperature for Rocky (default: 0.2)
- `ROCKY_MAX_TOKENS`: Max tokens for Rocky (default: 600)

**Never** add API keys to wrangler.toml - use `wrangler secret put` instead.

### Secrets (via `wrangler secret put`)
- `GEMINI_API_KEY` - Google Gemini API key
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key

## Development

The worker uses TypeScript and runs on Cloudflare's edge network for low latency globally.

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy
npm run deploy
```
