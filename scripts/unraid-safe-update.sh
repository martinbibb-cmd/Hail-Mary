#!/bin/bash
set -euo pipefail

PROJ_DIR="/boot/config/plugins/compose.manager/projects/hailmary"
cd "$PROJ_DIR"

echo "== Compose project dir =="
pwd
ls -la

# ---- sanity checks ----
if [[ ! -f ".env" ]]; then
  echo "❌ Missing .env in $PROJ_DIR"
  exit 1
fi

# shellcheck disable=SC1091
source ".env" || true

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "❌ POSTGRES_PASSWORD is missing/empty in $PROJ_DIR/.env"
  exit 1
fi

if [[ ! -f "docker-compose.yml" ]] || [[ ! -f "docker-compose.override.yml" ]]; then
  echo "❌ Missing docker-compose.yml and/or docker-compose.override.yml in $PROJ_DIR"
  exit 1
fi

# Use explicit files + env-file every time (avoid "wrong directory" + missing env)
DC="docker compose --env-file .env -f docker-compose.yml -f docker-compose.override.yml"

echo "== Pull latest images =="
$DC pull

echo "== Up (recreate if needed) =="
$DC up -d

echo "== Wait for Postgres to be ready =="
# Find the postgres container id from this compose project
PG_CID="$($DC ps -q hailmary-postgres || true)"
if [[ -z "$PG_CID" ]]; then
  # fallback: service name might be postgres
  PG_CID="$($DC ps -q postgres || true)"
fi
if [[ -z "$PG_CID" ]]; then
  echo "❌ Could not find Postgres container for this compose project"
  $DC ps
  exit 1
fi

# Wait until pg_isready succeeds inside the container
for i in {1..30}; do
  if docker exec "$PG_CID" sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1'; then
    echo "✅ Postgres ready"
    break
  fi
  echo "…waiting ($i/30)"
  sleep 2
done

echo "== Run DB migrations (idempotent) =="
API_CID="$($DC ps -q hailmary-api || true)"
if [[ -z "$API_CID" ]]; then
  API_CID="$($DC ps -q api || true)"
fi
if [[ -z "$API_CID" ]]; then
  echo "❌ Could not find API container for this compose project"
  $DC ps
  exit 1
fi

docker exec "$API_CID" sh -lc 'cd /app && npm -w @hail-mary/api run db:migrate'

echo "== Restart API + Assistant (pick up any code/env changes) =="
ASST_CID="$($DC ps -q hailmary-assistant || true)"
if [[ -z "$ASST_CID" ]]; then
  ASST_CID="$($DC ps -q assistant || true)"
fi

docker restart "$API_CID" >/dev/null
if [[ -n "$ASST_CID" ]]; then docker restart "$ASST_CID" >/dev/null; fi

echo "== Quick health =="
curl -sf http://127.0.0.1:3001/health >/dev/null && echo "API OK"
curl -sf http://127.0.0.1:3001/health/db >/dev/null && echo "DB OK"
curl -sfI http://127.0.0.1:3000/ >/dev/null && echo "PWA OK"

echo "✅ Update complete"
