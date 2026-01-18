#!/bin/bash
# ==============================================================================
# Hail-Mary Reinstall Script
# ==============================================================================
# This script reinstalls Hail-Mary by stopping existing containers,
# ensuring configuration is in place, and rebuilding/restarting containers.
#
# Usage:
#   ./scripts/reinstall-hailmary.sh [deployment-directory]
#
# Arguments:
#   deployment-directory    Optional path to Hail-Mary installation (default: current directory)
#
# What it does:
#   - Stops any existing Hail-Mary containers
#   - Ensures .env file exists (copies from .env.example if needed)
#   - Shows key environment values for verification
#   - Rebuilds and starts containers using docker-compose.prod.yml
#   - Displays status and connection information
# ==============================================================================

set -e

BASE_DIR="${1:-$(pwd)}"

echo "📦 Reinstalling Hail Mary from ${BASE_DIR}..."

cd "${BASE_DIR}"

echo "🛑 Stopping any existing Hail Mary stacks (if present)..."
# Stop using prod compose file – ignore errors if not running
docker compose -f docker-compose.prod.yml down || true

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
grep -E '^(PWA_PORT|BASE_URL|JWT_SECRET|INITIAL_ADMIN_EMAIL|INITIAL_ADMIN_PASSWORD)=' .env || true
echo ""

# OPTIONAL: uncomment this block if you ever want a completely fresh database
# echo "⚠️ Skipping DB wipe. If you want a full reset later, run:"
# echo "   rm -rf ${BASE_DIR}/postgres-data"
# echo "   before rerunning this script."
# echo ""

echo "🚀 Starting Hail Mary using production compose..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "✅ Hail Mary containers rebuilt and started."
echo "   → Check status with: docker compose -f docker-compose.prod.yml ps"
echo "   → API logs:         docker logs hailmary-api --tail 100"

# Get PWA_PORT from .env or use default
PWA_PORT=$(grep '^PWA_PORT=' .env 2>/dev/null | cut -d'=' -f2 || echo "8080")
echo "   → Web UI:           http://$(hostname -I | awk '{print $1}'):${PWA_PORT}"
echo ""
echo "Default admin (if not changed in .env):"
echo "   Email:    admin@hailmary.local"
echo "   Password: HailMary2024!"
