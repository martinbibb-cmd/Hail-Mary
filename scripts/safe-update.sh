#!/bin/bash

# Safe Update Script for Hail-Mary
# 
# This script implements the reliable update pattern that avoids pulling
# local-build services (like hailmary-admin-agent) which would fail.
#
# Usage: ./scripts/safe-update.sh
#
# What it does:
# 1. Pulls latest code from git
# 2. Pulls ONLY registry-backed images (hailmary-api, hailmary-pwa, hailmary-assistant, postgres)
# 3. Rebuilds admin-agent locally (never pulled from registry)
# 4. Brings everything up with --remove-orphans flag
#
# Why this is necessary:
# - hailmary-admin-agent is built locally (image: hailmary-admin-agent:local)
# - Attempting to pull it from a registry will fail with "pull access denied"
# - This script ensures only pullable services are pulled

set -e  # Exit on any error

# Services that can be safely pulled from a registry
# IMPORTANT: Keep this aligned with PULLABLE_SERVICES in scripts/admin-agent/server.js
# Order matches server.js for consistency
PULLABLE_SERVICES=(
  "hailmary-api"
  "hailmary-assistant"
  "hailmary-pwa"
  "hailmary-migrator"
  "hailmary-postgres"
)

# Default PWA port (can be overridden by PWA_PORT env var in .env)
DEFAULT_PWA_PORT=3000

echo "🔒 Safe Update for Hail-Mary"
echo ""
echo "This script safely updates your stack by:"
echo "  ✓ Pulling only registry-backed images"
echo "  ✓ Rebuilding local-only services"
echo "  ✓ Avoiding pull failures on local builds"
echo ""

# Step 1: Pull latest code
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📥 Step 1: Pulling latest code from git"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git pull

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 Step 2: Pulling registry-backed images"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Pulling: ${PULLABLE_SERVICES[*]}"
echo "(Skipping: hailmary-admin-agent - local build only)"
echo ""

# Pull ONLY services that are in a registry
# Do NOT include hailmary-admin-agent as it's a local build
# Note: hailmary-migrator uses the same image as hailmary-api, but we pull it explicitly for clarity
docker compose pull "${PULLABLE_SERVICES[@]}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 Step 3: Rebuilding local-only services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Building: hailmary-admin-agent (from ./scripts/admin-agent)"
echo ""

# Rebuild admin-agent from local source (no pulling)
docker compose build hailmary-admin-agent

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Step 4: Starting all services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Bring everything up with --remove-orphans to clean up any stale containers
docker compose up -d --remove-orphans

echo ""
echo "⏳ Waiting for services to stabilize..."
sleep 5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Service Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker compose ps

echo ""
echo "✅ Safe update complete!"
echo ""
echo "📝 Next steps:"
echo "  - Check logs: docker compose logs -f"
echo "  - Verify UI: http://localhost:${PWA_PORT:-$DEFAULT_PWA_PORT}"
echo "  - Run migrations if needed: docker exec hailmary-api npm run db:migrate -w packages/api"
echo ""
echo "💡 Troubleshooting:"
echo "  - Missing update UI? Ensure ADMIN_AGENT_TOKEN is set in .env"
echo "  - PWA not loading? Check: docker compose logs hailmary-pwa"
echo "  - API issues? Check: docker compose logs hailmary-api"
