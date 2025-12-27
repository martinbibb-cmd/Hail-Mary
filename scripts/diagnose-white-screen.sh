#!/bin/bash
# Automated White Screen Diagnostic Tool for NAS Deployment
# Run this on your NAS to diagnose PWA white screen issues

set -e

echo "🔍 Hail-Mary White Screen Diagnostic Tool"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ISSUES_FOUND=0

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "1. Checking Docker containers..."
echo "-----------------------------------"
CONTAINERS=$(docker ps --filter "name=hailmary" --format "{{.Names}}" | wc -l)
if [ "$CONTAINERS" -ge 3 ]; then
    print_status 0 "Found $CONTAINERS hailmary containers running"
    docker ps --filter "name=hailmary" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    print_status 1 "Expected 3+ containers, found $CONTAINERS"
    echo "  Run: docker compose up -d"
fi
echo ""

echo "2. Checking PWA container health..."
echo "-----------------------------------"
if docker ps | grep -q "hailmary-pwa"; then
    PWA_HEALTH=$(docker inspect hailmary-pwa --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-health-check")
    if [ "$PWA_HEALTH" = "healthy" ] || [ "$PWA_HEALTH" = "no-health-check" ]; then
        print_status 0 "PWA container is running"
    else
        print_status 1 "PWA container health: $PWA_HEALTH"
    fi
else
    print_status 1 "PWA container not running"
fi
echo ""

echo "3. Testing if index.html is served..."
echo "-----------------------------------"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    print_status 0 "Index page returns HTTP 200"
else
    print_status 1 "Index page returns HTTP $HTTP_CODE (expected 200)"
fi
echo ""

echo "4. Checking if HTML contains valid script tags..."
echo "-----------------------------------"
SCRIPT_COUNT=$(curl -s http://localhost:3000/ 2>/dev/null | grep -c '<script.*src.*>' || echo "0")
if [ "$SCRIPT_COUNT" -gt 0 ]; then
    print_status 0 "Found $SCRIPT_COUNT script tags in HTML"
    JS_FILE=$(curl -s http://localhost:3000/ 2>/dev/null | grep -o '/assets/index-[^"]*\.js' | head -1 || echo "")
    if [ -n "$JS_FILE" ]; then
        echo "  Sample JS file: $JS_FILE"
    fi
else
    print_status 1 "No script tags found in HTML"
fi
echo ""

echo "5. Testing if JavaScript files contain actual code..."
echo "-----------------------------------"
JS_FILE=$(curl -s http://localhost:3000/ 2>/dev/null | grep -o '/assets/index-[^"]*\.js' | head -1 || echo "")
if [ -n "$JS_FILE" ]; then
    FIRST_LINE=$(curl -s "http://localhost:3000$JS_FILE" 2>/dev/null | head -c 100 || echo "")
    if echo "$FIRST_LINE" | grep -q -E '^\(|^import|^const|^function|^var|^let|^/\*'; then
        print_status 0 "JavaScript file contains valid JS code"
        echo "  First 100 chars: ${FIRST_LINE:0:80}..."
    elif echo "$FIRST_LINE" | grep -q '<!DOCTYPE'; then
        print_status 1 "JavaScript file contains HTML (likely Cloudflare challenge)"
        echo "  First 100 chars: ${FIRST_LINE:0:80}..."
        print_warning "This indicates Cloudflare WAF is blocking your assets!"
        print_warning "See: docs/CLOUDFLARE_WAF_FIX.md"
    else
        print_status 1 "JavaScript file has unexpected content"
        echo "  First 100 chars: ${FIRST_LINE:0:80}..."
    fi
else
    print_status 1 "Could not find JavaScript file path in HTML"
fi
echo ""

echo "6. Checking cache headers on index.html..."
echo "-----------------------------------"
CACHE_HEADER=$(curl -s -I http://localhost:3000/ 2>/dev/null | grep -i "cache-control" | tr -d '\r' || echo "")
if echo "$CACHE_HEADER" | grep -q "no-cache"; then
    print_status 0 "Index has no-cache header (good for updates)"
    echo "  $CACHE_HEADER"
else
    print_status 1 "Index missing no-cache header (can cause stale content)"
    echo "  Found: ${CACHE_HEADER:-none}"
    print_warning "Container may need rebuild with latest nginx.conf"
fi
echo ""

echo "7. Checking manifest MIME type..."
echo "-----------------------------------"
MANIFEST_TYPE=$(curl -s -I http://localhost:3000/manifest.webmanifest 2>/dev/null | grep -i "content-type" | tr -d '\r' || echo "")
if echo "$MANIFEST_TYPE" | grep -q "application/manifest+json"; then
    print_status 0 "Manifest has correct MIME type"
    echo "  $MANIFEST_TYPE"
else
    print_status 1 "Manifest has wrong MIME type"
    echo "  Found: ${MANIFEST_TYPE:-none}"
    print_warning "Container may need rebuild with latest nginx.conf"
fi
echo ""

echo "8. Checking recent PWA container logs for errors..."
echo "-----------------------------------"
if docker logs hailmary-pwa --tail 20 2>&1 | grep -i -E 'error|fail|cannot|refused'; then
    print_status 1 "Found errors in PWA logs (see above)"
else
    print_status 0 "No obvious errors in recent PWA logs"
fi
echo ""

echo "9. Checking if API is accessible from PWA container..."
echo "-----------------------------------"
if docker exec hailmary-pwa wget -q -O- http://hailmary-api:3001/health 2>/dev/null | grep -q "ok\|healthy\|success" || [ $? -eq 0 ]; then
    print_status 0 "PWA can reach API backend"
else
    print_status 1 "PWA cannot reach API backend"
fi
echo ""

echo "=========================================="
echo "📊 Diagnostic Summary"
echo "=========================================="
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ No obvious issues detected${NC}"
    echo ""
    echo "If you're still seeing a white screen:"
    echo "1. Clear browser cache and service workers"
    echo "2. Check Cloudflare WAF settings (see docs/CLOUDFLARE_WAF_FIX.md)"
    echo "3. Check browser console for JavaScript errors"
else
    echo -e "${RED}✗ Found $ISSUES_FOUND issue(s)${NC}"
    echo ""
    echo "Recommended fixes:"
    echo "1. Rebuild containers: docker compose build --no-cache && docker compose up -d"
    echo "2. Check logs: docker logs hailmary-pwa --tail 100"
    echo "3. Review: WHITE_SCREEN_TROUBLESHOOTING.md"
fi
echo ""
