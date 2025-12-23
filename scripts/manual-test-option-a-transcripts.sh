#!/usr/bin/env bash
set -euo pipefail

# Minimal manual test for Option A transcription ingestion.
#
# Prereqs:
# - API running (defaults to http://localhost:3001)
# - You are authenticated (cookie-based). If you run this locally without auth,
#   either disable auth locally or replace the calls with an auth header/cookie.
#
# Usage:
#   BASE_URL=http://localhost:3001 LEAD_ID=123 ./scripts/manual-test-option-a-transcripts.sh

BASE_URL="${BASE_URL:-http://localhost:3001}"
LEAD_ID="${LEAD_ID:-}"

if [[ -z "${LEAD_ID}" ]]; then
  echo "LEAD_ID is required. Example: LEAD_ID=123 $0" >&2
  exit 1
fi

echo "==> Creating transcript session for lead ${LEAD_ID}"
SESSION_ID="$(
  curl -fsS \
    -H "Content-Type: application/json" \
    -c /tmp/hm_cookies.txt \
    -b /tmp/hm_cookies.txt \
    -X POST "${BASE_URL}/api/leads/${LEAD_ID}/transcripts/sessions" \
    -d '{"source":"curl","deviceId":"manual-test","language":"en-GB"}' \
  | python -c 'import json,sys; print(json.load(sys.stdin)["data"]["sessionId"])'
)"
echo "   sessionId=${SESSION_ID}"

echo "==> Upserting segments (seq 0,1,2)"
curl -fsS \
  -H "Content-Type: application/json" \
  -c /tmp/hm_cookies.txt \
  -b /tmp/hm_cookies.txt \
  -X POST "${BASE_URL}/api/transcripts/sessions/${SESSION_ID}/segments" \
  -d '{
    "segments": [
      { "seq": 0, "text": "Hello, this is a test segment.", "startMs": 0, "endMs": 1200, "confidence": 0.91 },
      { "seq": 1, "text": "Second segment arrives.", "startMs": 1300, "endMs": 2400, "confidence": 0.88 },
      { "seq": 2, "text": "Final segment.", "startMs": 2500, "endMs": 3100, "confidence": 0.93 }
    ]
  }' \
  | python -m json.tool

echo "==> Idempotency check: re-upsert seq 1 with updated text"
curl -fsS \
  -H "Content-Type: application/json" \
  -c /tmp/hm_cookies.txt \
  -b /tmp/hm_cookies.txt \
  -X POST "${BASE_URL}/api/transcripts/sessions/${SESSION_ID}/segments" \
  -d '{ "seq": 1, "text": "Second segment (updated).", "startMs": 1300, "endMs": 2400, "confidence": 0.90 }' \
  | python -m json.tool

echo "==> Poll segments afterSeq=-1 (should return 0..2)"
curl -fsS \
  -c /tmp/hm_cookies.txt \
  -b /tmp/hm_cookies.txt \
  "${BASE_URL}/api/transcripts/sessions/${SESSION_ID}/segments?afterSeq=-1" \
  | python -m json.tool

echo "==> Poll segments afterSeq=1 (should return seq 2 only)"
curl -fsS \
  -c /tmp/hm_cookies.txt \
  -b /tmp/hm_cookies.txt \
  "${BASE_URL}/api/transcripts/sessions/${SESSION_ID}/segments?afterSeq=1" \
  | python -m json.tool

echo "==> Finalize"
curl -fsS \
  -H "Content-Type: application/json" \
  -c /tmp/hm_cookies.txt \
  -b /tmp/hm_cookies.txt \
  -X POST "${BASE_URL}/api/transcripts/sessions/${SESSION_ID}/finalize" \
  -d '{}' \
  | python -m json.tool

echo "✅ Done"

