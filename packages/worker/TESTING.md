# Testing Rocky Worker

## Manual Testing

### 1. Test Health Endpoint

Open in your browser or use curl:

```bash
curl https://hail-mary.martinbibb.workers.dev/health
```

**Expected Response:**
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

### 2. Test Analyse Endpoint

```bash
curl -X POST https://hail-mary.martinbibb.workers.dev/rocky/analyse \
  -H "Content-Type: application/json" \
  -d '{
    "visitId": "test-123",
    "transcriptChunk": "The boiler is making a whistling noise when it heats up.",
    "snapshot": {}
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "providerUsed": "gemini",
  "plainEnglishSummary": "The boiler has a whistling noise issue during heating...",
  "technicalRationale": "Likely a pressure issue or air in the system...",
  "keyDetailsDelta": {},
  "checklistDelta": {},
  "blockers": []
}
```

### 3. Test Invalid Request Handling

```bash
curl -X POST https://hail-mary.martinbibb.workers.dev/rocky/analyse \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "visitId and transcriptChunk required"
}
```

## Automated Testing

Run the test script:

```bash
node test-worker.js
```

Or test against a specific URL:

```bash
node test-worker.js https://your-worker.workers.dev
```

## Testing from PWA

1. Start the PWA in development mode:
   ```bash
   npm run pwa:dev
   ```

2. Open the Visit/Notes app and select a customer

3. Type or speak an observation

4. Check the browser console for:
   - Rocky health check logs
   - Analysis request/response logs
   - Status updates (connected/degraded)

5. Verify the timeline shows:
   - Your observation (user entry)
   - Rocky's response with plain English summary
   - Technical details (collapsible)
   - Provider used (e.g., "gemini")

## Testing Degraded Mode

To test that the UI works when Rocky is unavailable:

1. Set an invalid WORKER_URL:
   ```bash
   export VITE_WORKER_URL=https://invalid-url.example.com
   ```

2. Start the PWA and try logging an observation

3. Verify:
   - No blocking errors appear
   - Status badge shows "Rocky: ⚠️ Degraded" or "Rocky: ❌ Offline"
   - Manual observation logging still works
   - A friendly message appears instead of technical errors

## Testing Provider Fallback

This requires modifying API keys on the worker:

1. Remove GEMINI_API_KEY from worker secrets
2. Test - should fall back to OpenAI
3. Remove OPENAI_API_KEY as well
4. Test - should fall back to Anthropic
5. Remove all API keys
6. Test - should return safe fallback response with blockers

**Note:** Always restore API keys after testing!
