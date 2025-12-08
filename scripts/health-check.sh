#!/bin/bash
# ==============================================================================
# Hail-Mary Health Check & Verification Script
# ==============================================================================
# Verifies that all Hail-Mary services are running correctly
#
# Usage:
#   ./scripts/health-check.sh [--verbose]
#
# Options:
#   --verbose    Show detailed information about each service
#
# Exit codes:
#   0    All services healthy
#   1    One or more services unhealthy
# ==============================================================================

set -e

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
VERBOSE=false
if [[ "$1" == "--verbose" ]]; then
    VERBOSE=true
fi

FAILED_CHECKS=0

# Banner
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Hail-Mary Health Check                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED_CHECKS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

check_info() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}ℹ${NC} $1"
    fi
}

# Check 1: Docker is running
echo "🐳 Checking Docker..."
if command -v docker &> /dev/null; then
    check_pass "Docker is installed"
    if docker ps &> /dev/null; then
        check_pass "Docker daemon is running"
    else
        check_fail "Docker daemon is not running"
    fi
else
    check_fail "Docker is not installed"
fi
echo ""

# Check 2: Container status
echo "📦 Checking containers..."
EXPECTED_CONTAINERS=(
    "hailmary-postgres"
    "hailmary-api"
    "hailmary-assistant"
    "hailmary-pwa"
)

for container in "${EXPECTED_CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        STATUS=$(docker inspect --format='{{.State.Status}}' "$container")
        if [[ "$STATUS" == "running" ]]; then
            check_pass "$container is running"

            # Check health status if available
            HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
            if [[ "$HEALTH" != "none" ]]; then
                if [[ "$HEALTH" == "healthy" ]]; then
                    check_info "  Health: $HEALTH"
                else
                    check_warn "  Health: $HEALTH"
                fi
            fi
        else
            check_fail "$container is not running (status: $STATUS)"
        fi
    else
        check_fail "$container is not found"
    fi
done
echo ""

# Check 3: Database connectivity
echo "🗄️  Checking database..."
if docker ps | grep -q "hailmary-postgres"; then
    if docker exec hailmary-postgres pg_isready -U postgres -d hailmary &> /dev/null; then
        check_pass "Database is accepting connections"

        # Count tables
        TABLE_COUNT=$(docker exec hailmary-postgres psql -U postgres -d hailmary -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
        if [[ "$TABLE_COUNT" -gt 0 ]]; then
            check_pass "Database schema initialized ($TABLE_COUNT tables)"
        else
            check_warn "Database schema not initialized (run migrations)"
        fi

        # Check for admin user
        USER_COUNT=$(docker exec hailmary-postgres psql -U postgres -d hailmary -t -c "SELECT COUNT(*) FROM users WHERE role = 'admin';" 2>/dev/null | xargs || echo "0")
        if [[ "$USER_COUNT" -gt 0 ]]; then
            check_pass "Admin user exists"
        else
            check_warn "No admin user found (check INITIAL_ADMIN_EMAIL/PASSWORD)"
        fi

        # Check for products
        PRODUCT_COUNT=$(docker exec hailmary-postgres psql -U postgres -d hailmary -t -c "SELECT COUNT(*) FROM products;" 2>/dev/null | xargs || echo "0")
        if [[ "$PRODUCT_COUNT" -gt 0 ]]; then
            check_pass "Product database seeded ($PRODUCT_COUNT products)"
        else
            check_warn "No products found (run seed script)"
        fi
    else
        check_fail "Database is not accepting connections"
    fi
else
    check_fail "Database container not running"
fi
echo ""

# Check 4: API service
echo "🔌 Checking API service..."
if docker ps | grep -q "hailmary-api"; then
    # Try to reach the API health endpoint
    API_URL="http://localhost:3001/api/health"
    if curl -sf "$API_URL" &> /dev/null; then
        check_pass "API service is responding"
        check_info "  URL: $API_URL"
    else
        check_warn "API service not responding on port 3001 (may be internal only)"
    fi

    # Check logs for errors
    ERROR_COUNT=$(docker logs --tail 50 hailmary-api 2>&1 | grep -i "error" | wc -l)
    if [[ "$ERROR_COUNT" -eq 0 ]]; then
        check_pass "No recent errors in API logs"
    else
        check_warn "Found $ERROR_COUNT errors in recent API logs"
        if [[ "$VERBOSE" == "true" ]]; then
            echo "  Recent errors:"
            docker logs --tail 50 hailmary-api 2>&1 | grep -i "error" | tail -n 3 | sed 's/^/    /'
        fi
    fi
else
    check_fail "API container not running"
fi
echo ""

# Check 5: Assistant service
echo "🤖 Checking Assistant service..."
if docker ps | grep -q "hailmary-assistant"; then
    check_pass "Assistant service is running"

    # Check if Gemini API key is configured
    GEMINI_KEY=$(docker exec hailmary-assistant printenv GEMINI_API_KEY 2>/dev/null || echo "")
    if [[ -n "$GEMINI_KEY" && "$GEMINI_KEY" != "your-gemini-api-key" ]]; then
        check_pass "Gemini API key is configured"
    else
        check_warn "Gemini API key not configured (AI features disabled)"
    fi
else
    check_fail "Assistant container not running"
fi
echo ""

# Check 6: PWA frontend
echo "🌐 Checking PWA frontend..."
PWA_PORT=$(docker port hailmary-pwa 2>/dev/null | grep "8080" | cut -d: -f2 || echo "8080")
PWA_URL="http://localhost:${PWA_PORT}"

if curl -sf "$PWA_URL" &> /dev/null; then
    check_pass "PWA frontend is accessible"
    check_info "  URL: $PWA_URL"
else
    check_fail "PWA frontend is not accessible at $PWA_URL"
fi
echo ""

# Check 7: Network connectivity
echo "🔗 Checking network..."
if docker network ls | grep -q "hailmary-network"; then
    check_pass "Docker network 'hailmary-network' exists"

    NETWORK_CONTAINERS=$(docker network inspect hailmary-network -f '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | wc -w)
    check_info "  Connected containers: $NETWORK_CONTAINERS"
else
    check_fail "Docker network 'hailmary-network' not found"
fi
echo ""

# Check 8: Data persistence
echo "💾 Checking data persistence..."
if [[ -d "/mnt/user/appdata/hailmary" ]]; then
    # unRAID
    APPDATA_PATH="/mnt/user/appdata/hailmary"
elif [[ -d "./postgres-data" ]]; then
    # Local development
    APPDATA_PATH="./postgres-data"
else
    APPDATA_PATH="./appdata"
fi

if [[ -d "$APPDATA_PATH/postgres" ]]; then
    check_pass "PostgreSQL data directory exists"
    POSTGRES_SIZE=$(du -sh "$APPDATA_PATH/postgres" 2>/dev/null | cut -f1)
    check_info "  Size: $POSTGRES_SIZE"
else
    check_warn "PostgreSQL data directory not found at $APPDATA_PATH/postgres"
fi
echo ""

# Summary
echo "═══════════════════════════════════════════════"
if [[ $FAILED_CHECKS -eq 0 ]]; then
    echo -e "${GREEN}✓ All health checks passed!${NC}"
    echo ""
    echo "Your Hail-Mary installation is healthy and ready to use."
    echo ""
    echo "Access your application:"
    echo "  • Web UI: $PWA_URL"
    echo "  • API: http://localhost:3001"
    echo ""
    exit 0
else
    echo -e "${RED}✗ $FAILED_CHECKS health check(s) failed${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. Check container logs:"
    echo "     docker compose logs"
    echo ""
    echo "  2. Restart containers:"
    echo "     docker compose restart"
    echo ""
    echo "  3. View detailed status:"
    echo "     docker compose ps"
    echo ""
    echo "  4. Re-run health check with verbose mode:"
    echo "     $0 --verbose"
    echo ""
    exit 1
fi
