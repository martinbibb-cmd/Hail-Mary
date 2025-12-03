#!/bin/bash
# ==============================================================================
# Hail-Mary NAS Cron Setup Script
# ==============================================================================
# This script sets up a cron job to periodically check for and pull
# updated Docker images from GitHub Container Registry.
#
# Usage:
#   ./setup-cron.sh [interval]
#
# Arguments:
#   interval    Check interval in minutes (default: 5)
#
# The cron job will:
#   1. Check if any images have updates
#   2. Pull new images if available
#   3. Restart containers with updated images
# ==============================================================================

set -e

# Configuration
DEPLOY_DIR="${DEPLOY_DIR:-/opt/hail-mary}"
CRON_USER="${CRON_USER:-root}"
CHECK_INTERVAL="${1:-5}"

echo "=========================================="
echo "Hail-Mary Cron Setup"
echo "=========================================="
echo "Deploy directory: $DEPLOY_DIR"
echo "Check interval: Every $CHECK_INTERVAL minutes"
echo "Cron user: $CRON_USER"
echo ""

# Create the check-and-update script
cat > "$DEPLOY_DIR/scripts/check-updates.sh" << 'SCRIPT'
#!/bin/bash
# Check for image updates and deploy if needed

DEPLOY_DIR="${DEPLOY_DIR:-/opt/hail-mary}"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"
LOG_FILE="/var/log/hail-mary-updates.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

# Pull images and check for changes
cd "$DEPLOY_DIR"

# Store current image IDs
api_old=$(docker inspect --format='{{.Id}}' hailmary-api 2>/dev/null || echo "none")
pwa_old=$(docker inspect --format='{{.Id}}' hailmary-pwa 2>/dev/null || echo "none")
assistant_old=$(docker inspect --format='{{.Id}}' hailmary-assistant 2>/dev/null || echo "none")

# Pull latest images
docker-compose -f "$COMPOSE_FILE" pull --quiet 2>/dev/null

# Check if any images changed
api_new=$(docker-compose -f "$COMPOSE_FILE" config --images | grep api | xargs -I{} docker inspect --format='{{.Id}}' {} 2>/dev/null || echo "new")
pwa_new=$(docker-compose -f "$COMPOSE_FILE" config --images | grep pwa | xargs -I{} docker inspect --format='{{.Id}}' {} 2>/dev/null || echo "new")
assistant_new=$(docker-compose -f "$COMPOSE_FILE" config --images | grep assistant | xargs -I{} docker inspect --format='{{.Id}}' {} 2>/dev/null || echo "new")

# Restart if any images changed
if [[ "$api_old" != "$api_new" ]] || [[ "$pwa_old" != "$pwa_new" ]] || [[ "$assistant_old" != "$assistant_new" ]]; then
    log "Image updates detected, restarting containers..."
    docker-compose -f "$COMPOSE_FILE" up -d --remove-orphans
    docker image prune -f
    log "Containers restarted successfully"
else
    log "No updates found"
fi
SCRIPT

chmod +x "$DEPLOY_DIR/scripts/check-updates.sh"

# Add cron job
CRON_ENTRY="*/$CHECK_INTERVAL * * * * $DEPLOY_DIR/scripts/check-updates.sh"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "check-updates.sh"; then
    echo "Cron job already exists. Updating..."
    crontab -l 2>/dev/null | grep -v "check-updates.sh" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "Cron job installed successfully!"
echo ""
echo "Current cron jobs:"
crontab -l
echo ""
echo "To view update logs:"
echo "  tail -f /var/log/hail-mary-updates.log"
echo ""
echo "To remove the cron job:"
echo "  crontab -l | grep -v 'check-updates.sh' | crontab -"
