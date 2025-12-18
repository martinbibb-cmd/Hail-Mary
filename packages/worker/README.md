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

### Secrets (via `wrangler secret put`)
- `GEMINI_API_KEY` - Google Gemini API key
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key

### Variables (in wrangler.toml)

**Sarah Configuration:**
- `SARAH_MODEL` - Model to use (default: `gemini-1.5-flash`)
- `SARAH_TEMPERATURE` - Creativity level 0.0-1.0 (default: `0.3`)
- `SARAH_MAX_TOKENS` - Maximum response length (default: `500`)

**Rocky Configuration:**
- `ROCKY_MODEL` - Model to use (default: `gemini-1.5-pro`)
- `ROCKY_TEMPERATURE` - Creativity level 0.0-1.0 (default: `0.2`)
- `ROCKY_MAX_TOKENS` - Maximum response length (default: `600`)

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
