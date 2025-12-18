# Testing Hail-Mary Worker (Rocky + Sarah)

This worker provides two AI services:
- **Rocky**: Deterministic analysis of visit observations
- **Sarah**: Human-friendly explanations of Rocky's results

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

### 4. Test Sarah Explain (Customer Context)

```bash
curl -X POST https://hail-mary.martinbibb.workers.dev/sarah/explain \
  -H "Content-Type: application/json" \
  -d '{
    "rockyResult": {
      "providerUsed": "gemini",
      "plainEnglishSummary": "Boiler has a whistling noise issue that needs attention.",
      "technicalRationale": "Likely a pressure relief valve issue or air in the system.",
      "keyDetailsDelta": {},
      "checklistDelta": {},
      "blockers": ["Need to confirm boiler model and age"]
    },
    "context": "customer"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "message": "Your boiler is making a whistling sound, which usually indicates a pressure issue. The engineer will check the pressure relief valve and make sure everything is working safely."
}
```

### 5. Test Sarah Explain (Engineer Context)

```bash
curl -X POST https://hail-mary.martinbibb.workers.dev/sarah/explain \
  -H "Content-Type: application/json" \
  -d '{
    "rockyResult": {
      "providerUsed": "gemini",
      "plainEnglishSummary": "Boiler has a whistling noise issue that needs attention.",
      "technicalRationale": "Likely a pressure relief valve issue or air in the system.",
      "keyDetailsDelta": {"pressure": "1.5 bar", "temperature": "65°C"},
      "checklistDelta": {"check_prv": true, "bleed_radiators": true},
      "blockers": ["Need to confirm boiler model and age"]
    },
    "context": "engineer"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "message": "Rocky identified a whistling noise issue likely caused by PRV problems or system air. Priority actions: check PRV and bleed radiators. Blocker: confirm boiler model/age before proceeding."
}
```

### 6. Test Sarah Invalid Context

```bash
curl -X POST https://hail-mary.martinbibb.workers.dev/sarah/explain \
  -H "Content-Type: application/json" \
  -d '{
    "rockyResult": {
      "providerUsed": "gemini",
      "plainEnglishSummary": "Test",
      "technicalRationale": "Test",
      "keyDetailsDelta": {},
      "checklistDelta": {},
      "blockers": []
    },
    "context": "invalid_context"
  }'
```

**Expected Response:**
```json
{
  "ok": false,
  "error": "context must be '\''customer'\'' or '\''engineer'\''"
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
2. Test Rocky and Sarah - should fall back to OpenAI
3. Remove OPENAI_API_KEY as well
4. Test - should fall back to Anthropic
5. Remove all API keys
6. Test - should return safe fallback responses

**Note:** Always restore API keys after testing!

## Testing Rocky + Sarah Integration

To test the full flow where Rocky analyzes and Sarah explains:

```bash
# Step 1: Get Rocky's analysis
ROCKY_RESULT=$(curl -s -X POST https://hail-mary.martinbibb.workers.dev/rocky/analyse \
  -H "Content-Type: application/json" \
  -d '{
    "visitId": "test-123",
    "transcriptChunk": "Boiler pressure is at 0.5 bar, much lower than normal.",
    "snapshot": {}
  }')

echo "Rocky Result:"
echo $ROCKY_RESULT | jq .

# Step 2: Pass Rocky's result to Sarah for customer-friendly explanation
curl -X POST https://hail-mary.martinbibb.workers.dev/sarah/explain \
  -H "Content-Type: application/json" \
  -d "{
    \"rockyResult\": $(echo $ROCKY_RESULT | jq -c '{providerUsed, plainEnglishSummary, technicalRationale, keyDetailsDelta, checklistDelta, blockers}'),
    \"context\": \"customer\"
  }" | jq .
```

This demonstrates the architectural principle:
1. Rocky analyzes raw data (deterministic)
2. Sarah explains Rocky's findings (conversational)
3. Sarah never touches raw data directly
