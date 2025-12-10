#!/bin/bash
# ==============================================================================
# Hail-Mary unRAID Reinstall Script (Local Build)
# ==============================================================================
# This script reinstalls Hail-Mary on unRAID using the local build compose file.
# It stops any existing containers, ensures configuration is in place, and
# rebuilds/restarts the containers from source.
#
# Save this as: /mnt/user/appdata/hailmary/reinstall-hailmary.sh
# Then run:
#   chmod +x /mnt/user/appdata/hailmary/reinstall-hailmary.sh
#   /mnt/user/appdata/hailmary/reinstall-hailmary.sh
#
# Usage:
#   ./scripts/reinstall-hailmary.sh
#
#   Or from the default unRAID location:
#   /mnt/user/appdata/hailmary/reinstall-hailmary.sh
#
# What it does:
#   - Stops any existing Hail-Mary containers
#   - Ensures .env file exists (copies from .env.example if needed)
#   - Shows key environment values for verification
#   - Rebuilds and starts containers using docker-compose.unraid-build.yml
#   - Displays status and connection information
# ==============================================================================

set -e

BASE_DIR="/mnt/user/appdata/hailmary"

echo "📦 Reinstalling Hail Mary from ${BASE_DIR} (local build compose)..."

cd "${BASE_DIR}"

echo "🛑 Stopping any existing Hail Mary stacks (if present)..."
# Stop both variants if they exist – ignore errors
docker compose -f docker-compose.unraid.yml down || true
docker compose -f docker-compose.unraid-build.yml down || true

echo "📁 Ensuring .env exists..."
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "   → Copied .env.example to .env"
  else
    echo "❌ No .env or .env.example found. Create .env and rerun this script."
    exit 1
  fi
fi

echo "🔍 Showing key environment values (for sanity check)..."
grep -E '^(APPDATA_PATH|PWA_PORT|BASE_URL|JWT_SECRET|INITIAL_ADMIN_EMAIL|INITIAL_ADMIN_PASSWORD)=' .env || true
echo ""

# OPTIONAL: uncomment this block if you ever want a completely fresh database
# echo "⚠️ Skipping DB wipe. If you want a full reset later, run:"
# echo "   rm -rf ${BASE_DIR}/postgres"
# echo "   before rerunning this script."
# echo ""

echo "🚀 Starting Hail Mary using local-build unRAID compose..."
docker compose -f docker-compose.unraid-build.yml up -d --build

echo ""
echo "✅ Hail Mary containers rebuilt and started."
echo "   → Check status with: docker compose -f docker-compose.unraid-build.yml ps"
echo "   → API logs:         docker logs hailmary-api --tail 100"

# Get PWA_PORT from .env or use default
PWA_PORT=$(grep '^PWA_PORT=' .env 2>/dev/null | cut -d'=' -f2 || echo "8080")
echo "   → Web UI:           http://$(hostname -I | awk '{print $1}'):${PWA_PORT}"
echo ""
echo "Default admin (if not changed in .env):"
echo "   Email:    admin@hailmary.local"
echo "   Password: HailMary2024!"
