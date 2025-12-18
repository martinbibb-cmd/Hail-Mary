# Rocky Worker - Cloudflare Worker for AI Analysis

This Cloudflare Worker provides Rocky AI analysis endpoints with provider fallback (Gemini → OpenAI → Anthropic).

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
Analyses visit observations using AI with provider fallback.

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

## Deployment

### Prerequisites
- Wrangler CLI installed: `npm install -g wrangler`
- Cloudflare account with Workers enabled

### Set Secrets
```bash
# Navigate to worker directory
cd packages/worker

# Set API keys as secrets
wrangler secret put GEMINI_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

### Deploy
```bash
# Development
npm run dev

# Production
npm run deploy
```

## Provider Fallback

Rocky attempts to use providers in this order:
1. **Gemini** (default) - Fast and cost-effective
2. **OpenAI** - Fallback if Gemini fails
3. **Anthropic** - Final fallback if both fail

If all providers fail, Rocky returns a safe response indicating manual mode.

## CORS

The worker allows cross-origin requests from:
- hail-mary.cloudbibb.uk
- localhost (for development)

CORS can be tightened in production by modifying the `corsHeaders` function.

## Environment Variables

All API keys are stored as Cloudflare Worker secrets:
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
