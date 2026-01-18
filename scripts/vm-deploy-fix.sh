#!/bin/bash
# ==============================================================================
# VM Deployment Fix Script
# ==============================================================================
# This script handles deployment fixes on the VM:
# 1. Removes stray containers that may conflict with port/routing
# 2. Verifies API health endpoints respond correctly
# 3. Recreates compose stack cleanly
#
# Usage:
#   ./scripts/vm-deploy-fix.sh [--skip-verify]
#
# Options:
#   --skip-verify    Skip health check verification after deployment
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SKIP_VERIFY=false
API_PORT="${API_PORT:-3001}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-verify)
            SKIP_VERIFY=true
            shift
            ;;
        --help)
            # Extract help text from header comment block (lines 3-14)
            sed -n '3,14s/^# \?//p' "$0"
            exit 0
            ;;
        *)
            echo -e "${RED}Error:${NC} Unknown option: $1"
            exit 1
            ;;
    esac
done

# Helper functions
info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

success() {
    echo -e "${GREEN}✓${NC} $*"
}

error() {
    echo -e "${RED}✗${NC} $*"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $*"
}

# Banner
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     VM Deployment Fix                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Remove stray container
echo "🧹 Cleaning up stray containers..."
if docker ps -a --format '{{.Names}}' | grep -q '^jovial_banzai$'; then
    info "Found stray container 'jovial_banzai', removing..."
    docker rm -f jovial_banzai
    success "Removed stray container 'jovial_banzai'"
else
    info "No stray container 'jovial_banzai' found (already clean)"
fi

# Check for any other containers that might conflict with port 3001
# Using docker ps with port inspection to find actual port conflicts
CONFLICTING_CONTAINERS=$(docker ps -a --format '{{.Names}}' | while read -r container; do
    if docker port "$container" 2>/dev/null | grep -q "3001"; then
        if [[ "$container" != "hailmary-api" ]]; then
            echo "$container"
        fi
    fi
done)

if [[ -n "$CONFLICTING_CONTAINERS" ]]; then
    warn "Found containers using port 3001 (API port):"
    # Use for loop to properly track errors
    for container in $CONFLICTING_CONTAINERS; do
        warn "  - $container"
        info "  Removing $container..."
        docker rm -f "$container" || warn "  Failed to remove $container"
    done
    success "Cleaned up conflicting containers"
fi

echo ""

# Step 2: Recreate compose stack cleanly
echo "🔄 Recreating compose stack..."
info "Stopping current services..."
docker compose down || true

info "Pulling latest images..."
docker compose pull

info "Starting services with force-recreate..."
docker compose up -d --force-recreate

success "Compose stack recreated successfully"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Step 3: Verify API health (unless skipped)
if [[ "$SKIP_VERIFY" == "true" ]]; then
    warn "Skipping health verification (--skip-verify flag set)"
    exit 0
fi

echo "🏥 Verifying API health endpoints..."

# Check 1: Basic health endpoint
echo ""
info "Testing: GET http://127.0.0.1:${API_PORT}/api/health"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/api/health" || echo "000")

if [[ "$HEALTH_RESPONSE" == "200" ]]; then
    success "API health endpoint responding (HTTP $HEALTH_RESPONSE)"
    HEALTH_JSON=$(curl -s "http://127.0.0.1:${API_PORT}/api/health")
    echo "  Response: $HEALTH_JSON"
else
    error "API health endpoint not responding (HTTP $HEALTH_RESPONSE)"
    warn "API may still be starting up. Check logs with: docker compose logs hailmary-api"
fi

# Check 2: Auth config endpoint
echo ""
info "Testing: GET http://127.0.0.1:${API_PORT}/api/auth/config"
AUTH_CONFIG_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/api/auth/config" || echo "000")

if [[ "$AUTH_CONFIG_RESPONSE" == "200" ]]; then
    success "Auth config endpoint responding (HTTP $AUTH_CONFIG_RESPONSE)"
    AUTH_CONFIG_JSON=$(curl -s "http://127.0.0.1:${API_PORT}/api/auth/config")
    echo "  Response: $AUTH_CONFIG_JSON"
else
    error "Auth config endpoint not responding (HTTP $AUTH_CONFIG_RESPONSE)"
    warn "API may still be starting up. Check logs with: docker compose logs hailmary-api"
fi

# Check 3: Detailed health with config status
echo ""
info "Testing: GET http://127.0.0.1:${API_PORT}/health/detailed"
DETAILED_HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/health/detailed" || echo "000")

if [[ "$DETAILED_HEALTH_RESPONSE" == "200" ]] || [[ "$DETAILED_HEALTH_RESPONSE" == "503" ]]; then
    if [[ "$DETAILED_HEALTH_RESPONSE" == "200" ]]; then
        success "Detailed health endpoint responding - system healthy (HTTP $DETAILED_HEALTH_RESPONSE)"
    else
        warn "Detailed health endpoint responding - system degraded (HTTP $DETAILED_HEALTH_RESPONSE)"
    fi
    
    DETAILED_JSON=$(curl -s "http://127.0.0.1:${API_PORT}/health/detailed")
    
    # Extract and display key information
    echo ""
    echo "  System Status:"
    echo "$DETAILED_JSON" | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"\([^"]*\)"/    Status: \1/'
    echo "$DETAILED_JSON" | grep -o '"database":"[^"]*"' | sed 's/"database":"\([^"]*\)"/    Database: \1/'
    
    # Check for config warnings
    if echo "$DETAILED_JSON" | grep -q '"usedFallback":true'; then
        warn "    Core config: Using embedded fallback (atlas-schema/checklist-config warnings)"
        info "    This is non-fatal - API uses embedded fallback as designed"
    else
        success "    Core config: Loaded from files"
    fi
else
    error "Detailed health endpoint not responding (HTTP $DETAILED_HEALTH_RESPONSE)"
    warn "API may still be starting up. Check logs with: docker compose logs hailmary-api"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════"

if [[ "$HEALTH_RESPONSE" == "200" ]] && [[ "$AUTH_CONFIG_RESPONSE" == "200" ]]; then
    success "VM deployment fix completed successfully!"
    echo ""
    echo "✓ Stray containers removed"
    echo "✓ Compose stack recreated cleanly"
    echo "✓ API health endpoints verified"
    echo ""
    info "Note: atlas-schema/checklist-config warnings are non-fatal."
    info "      API uses embedded fallback as designed."
    echo ""
    exit 0
else
    warn "VM deployment completed with warnings"
    echo ""
    echo "Troubleshooting:"
    echo "  • Check API logs: docker compose logs hailmary-api"
    echo "  • Check all services: docker compose ps"
    echo "  • Wait a moment and retry: curl http://127.0.0.1:${API_PORT}/api/health"
    echo ""
    exit 1
fi
