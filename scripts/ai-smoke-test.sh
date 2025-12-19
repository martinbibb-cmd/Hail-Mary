#!/bin/bash
# AI Gateway Smoke Test
# Tests that /api/ai/health endpoint is reachable and returns 200
# This ensures the API is properly wired to the Cloudflare Worker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default host and port
API_HOST="${API_HOST:-localhost}"
API_PORT="${API_PORT:-3001}"
API_URL="http://${API_HOST}:${API_PORT}"

echo "=========================================="
echo "AI Gateway Smoke Test"
echo "=========================================="
echo "Testing: ${API_URL}/api/ai/health"
echo ""

# Check if API is reachable first
echo -n "Checking if API is running... "
if ! curl -fsS "${API_URL}/health" > /dev/null 2>&1; then
  echo -e "${RED}FAILED${NC}"
  echo "Error: API is not reachable at ${API_URL}"
  echo "Make sure the API server is running:"
  echo "  npm run api:dev"
  exit 1
fi
echo -e "${GREEN}OK${NC}"

# Test AI health endpoint
echo -n "Testing /api/ai/health endpoint... "
HTTP_CODE=$(curl -fsS -w "%{http_code}" -o /tmp/ai-health-response.json "${API_URL}/api/ai/health" 2>&1 || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}OK${NC}"
  echo "Response:"
  cat /tmp/ai-health-response.json | python3 -m json.tool 2>/dev/null || cat /tmp/ai-health-response.json
  echo ""
  echo -e "${GREEN}✅ AI Gateway smoke test PASSED${NC}"
  echo "The API is properly wired to the Cloudflare Worker"
  rm -f /tmp/ai-health-response.json
  exit 0
elif [ "$HTTP_CODE" = "500" ]; then
  echo -e "${YELLOW}WARNING${NC}"
  echo "Response (HTTP $HTTP_CODE):"
  cat /tmp/ai-health-response.json 2>/dev/null || echo "(no response body)"
  echo ""
  echo -e "${YELLOW}⚠️  WORKER_URL environment variable not set${NC}"
  echo "The AI endpoints exist but WORKER_URL is not configured."
  echo "Set WORKER_URL in your .env file:"
  echo "  WORKER_URL=https://hail-mary.martinbibb.workers.dev"
  rm -f /tmp/ai-health-response.json
  exit 1
elif [ "$HTTP_CODE" = "503" ]; then
  echo -e "${YELLOW}WARNING${NC}"
  echo "Response (HTTP $HTTP_CODE):"
  cat /tmp/ai-health-response.json 2>/dev/null || echo "(no response body)"
  echo ""
  echo -e "${YELLOW}⚠️  Worker is not reachable${NC}"
  echo "WORKER_URL is set but the Cloudflare Worker is not responding."
  echo "Check:"
  echo "  1. Worker is deployed: cd packages/worker && wrangler deploy"
  echo "  2. Worker URL is correct in .env"
  echo "  3. Network connectivity to workers.dev"
  rm -f /tmp/ai-health-response.json
  exit 1
else
  echo -e "${RED}FAILED${NC}"
  echo "Expected HTTP 200, got: $HTTP_CODE"
  if [ -f /tmp/ai-health-response.json ]; then
    echo "Response:"
    cat /tmp/ai-health-response.json
  fi
  echo ""
  echo -e "${RED}❌ AI Gateway smoke test FAILED${NC}"
  rm -f /tmp/ai-health-response.json
  exit 1
fi
