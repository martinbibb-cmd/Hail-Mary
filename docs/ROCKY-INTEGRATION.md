# Rocky Integration Guide

This document explains the Rocky AI analysis engine integration completed in this PR.

## Overview

Rocky is an AI-powered analysis engine that processes visit observations and provides:
- Plain English summaries (customer-safe)
- Technical rationale (engineer-oriented)
- Key details extraction
- Checklist updates
- Blockers identification

### Provider Fallback Strategy

Rocky uses multiple AI providers with automatic fallback:
1. **Gemini** (primary) - Fast, cost-effective
2. **OpenAI** (fallback) - If Gemini fails
3. **Anthropic** (final fallback) - If both above fail

If all providers fail, Rocky returns a safe response allowing manual mode to continue.

## Architecture

```
┌─────────────┐          ┌──────────────────┐          ┌─────────────┐
│   PWA       │          │ Cloudflare       │          │  AI         │
│  (VisitApp) │ ────────>│   Worker         │ ────────>│ Providers   │
│             │  HTTPS   │   (Rocky)        │  API     │             │
└─────────────┘          └──────────────────┘          └─────────────┘
      │                                                       │
      │                                                       ├─> Gemini
      │                                                       ├─> OpenAI
      │                                                       └─> Anthropic
      │
      └──> Falls back to manual mode if Worker unavailable
```

## Components

### 1. Cloudflare Worker (`packages/worker/`)

**Endpoints:**
- `GET /health` - Returns provider availability
- `POST /rocky/analyse` - Processes observations with AI

**Features:**
- TypeScript implementation
- CORS enabled for PWA access
- Safe error handling
- Graceful degradation

**Deployment:**
```bash
cd packages/worker
npm install
wrangler secret put GEMINI_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```

### 2. Rocky Client (`packages/pwa/src/services/rockyClient.ts`)

**Functions:**
- `initializeRocky()` - Check health on startup
- `checkRockyHealth()` - Periodic health checks
- `analyseWithRocky()` - Send observations for analysis
- `getRockyStatus()` - Get current status

**Status Types:**
- `connected` - Worker online, providers available
- `degraded` - Worker issues or no providers
- `blocked` - Worker URL missing

### 3. Visit App Updates (`packages/pwa/src/os/apps/visit/VisitApp.tsx`)

**New Features:**
- Rocky status badge in header
- AI analysis on each observation
- Enhanced timeline entries with:
  - Plain English summaries
  - Collapsible technical details
  - Blockers panel
  - Provider indication
- Graceful degradation to manual mode

### 4. Assistant Service (`packages/assistant/src/llmClient.ts`)

**Changes:**
- Removed blocking error: "I'm sorry, but the AI assistant is not configured"
- Now returns: "✅ Observation logged. (AI analysis unavailable - manual mode)"
- Changed to non-blocking warning instead of error

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Rocky Worker URL (PWA)
VITE_WORKER_URL=https://hail-mary.martinbibb.workers.dev
```

### Worker Secrets

Set via Wrangler CLI:

```bash
# Required: At least one provider
wrangler secret put GEMINI_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

## User Experience

### Normal Operation (Rocky Connected)

1. User logs an observation via voice or text
2. Observation appears in timeline immediately
3. Rocky analyzes in background (~1-2 seconds)
4. AI response appears with:
   - ✅ Plain English summary
   - 📋 Technical details (collapsible)
   - ⚠️ Blockers (if any)
   - Provider badge (gemini/openai/anthropic)
5. Status badge shows: "Rocky: ✅"

### Degraded Mode (Rocky Unavailable)

1. User logs an observation
2. Observation appears in timeline
3. Rocky client detects Worker unavailable
4. Returns safe fallback message
5. Status badge shows: "Rocky: ⚠️ Degraded" or "Rocky: ❌ Offline"
6. Manual mode continues working normally
7. **No blocking errors or broken UI**

## Testing

### Manual Testing

See `packages/worker/TESTING.md` for:
- Browser/curl tests
- PWA integration tests
- Degraded mode verification
- Provider fallback testing

### Automated Testing

```bash
cd packages/worker
node test-worker.js https://hail-mary.martinbibb.workers.dev
```

## Deployment Checklist

- [ ] Deploy Worker to Cloudflare
- [ ] Set Worker secrets (API keys)
- [ ] Verify `/health` endpoint returns valid JSON
- [ ] Test `/rocky/analyse` with sample data
- [ ] Set `VITE_WORKER_URL` in PWA environment
- [ ] Build and deploy PWA
- [ ] Test end-to-end in browser
- [ ] Verify degraded mode works (temporarily break Worker)
- [ ] Confirm no "assistant not configured" errors appear

## Troubleshooting

### "Rocky: ❌ Offline" in PWA

**Causes:**
- Worker not deployed
- Worker URL incorrect
- CORS issues
- Network connectivity

**Solutions:**
1. Check Worker is deployed: `curl https://your-worker.workers.dev/health`
2. Verify `VITE_WORKER_URL` is set correctly
3. Check browser console for CORS errors
4. Ensure Worker has CORS headers enabled

### All Providers Failing

**Causes:**
- API keys not set or invalid
- Rate limits exceeded
- Provider outages

**Solutions:**
1. Check Worker secrets: `wrangler secret list`
2. Verify API keys are valid
3. Check provider status pages
4. Review Worker logs: `wrangler tail`

### "AI analysis unavailable - manual mode"

**This is normal!** It means:
- Assistant service doesn't have GEMINI_API_KEY set
- But the app continues working in manual mode
- No action needed unless you want AI features in assistant service too

## Benefits

✅ **No Blocking Errors** - App always works, with or without AI
✅ **Provider Redundancy** - 3 AI providers with automatic fallback
✅ **Graceful Degradation** - Manual mode always available
✅ **Real-time Feedback** - Status badge shows connection state
✅ **Enhanced Analysis** - Technical details + plain English summaries
✅ **Cost Optimization** - Gemini primary (cheaper), OpenAI/Anthropic fallback

## Future Enhancements

- [ ] Key details extraction and state updates
- [ ] Checklist auto-updates based on analysis
- [ ] Conversation history for context-aware analysis
- [ ] Custom prompts per customer/job type
- [ ] Analytics dashboard for Rocky usage
- [ ] A/B testing different providers
- [ ] Local caching of common analyses

## Related Files

- `packages/worker/` - Cloudflare Worker implementation
- `packages/pwa/src/services/rockyClient.ts` - PWA client
- `packages/pwa/src/os/apps/visit/VisitApp.tsx` - Visit UI
- `packages/assistant/src/llmClient.ts` - Assistant service
- `packages/worker/README.md` - Worker documentation
- `packages/worker/TESTING.md` - Testing guide
