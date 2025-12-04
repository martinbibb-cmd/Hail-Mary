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
# Auto-detect unRAID
if [[ -d "/mnt/user" ]]; then
    DEPLOY_DIR="${DEPLOY_DIR:-/mnt/user/appdata/hailmary}"
else
    DEPLOY_DIR="${DEPLOY_DIR:-/opt/hail-mary}"
fi
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

# Auto-detect unRAID
if [[ -d "/mnt/user" ]]; then
    DEPLOY_DIR="${DEPLOY_DIR:-/mnt/user/appdata/hailmary}"
    COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.unraid.yml"
else
    DEPLOY_DIR="${DEPLOY_DIR:-/opt/hail-mary}"
    COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"
fi
LOG_FILE="/var/log/hail-mary-updates.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

# Get current image ID for a container
get_current_image_id() {
    docker inspect --format='{{.Id}}' "hailmary-$1" 2>/dev/null || echo "none"
}

# Get new image ID after pull
get_new_image_id() {
    docker-compose -f "$COMPOSE_FILE" config --images | grep "$1" | xargs -I{} docker inspect --format='{{.Id}}' {} 2>/dev/null || echo "new"
}

# Pull images and check for changes
cd "$DEPLOY_DIR"

# Store current image IDs
api_old=$(get_current_image_id api)
pwa_old=$(get_current_image_id pwa)
assistant_old=$(get_current_image_id assistant)

# Pull latest images
docker-compose -f "$COMPOSE_FILE" pull --quiet 2>/dev/null

# Check if any images changed
api_new=$(get_new_image_id api)
pwa_new=$(get_new_image_id pwa)
assistant_new=$(get_new_image_id assistant)

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
