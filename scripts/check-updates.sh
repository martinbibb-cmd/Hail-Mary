#!/bin/bash
# ==============================================================================
# Hail-Mary Automatic Update Checker
# ==============================================================================
# This script checks for new Docker images and automatically updates the
# running containers if updates are available.
#
# Usage:
#   ./check-updates.sh
#
# Environment Variables:
#   DEPLOY_DIR      - Directory where Hail-Mary is installed (auto-detected)
#   COMPOSE_FILE    - Docker Compose file to use (auto-detected)
#   LOG_FILE        - Log file location (default: /var/log/hail-mary-updates.log)
#
# This script is typically run by cron, installed via:
#   ./scripts/enable-autoupdate.sh
# ==============================================================================

# Auto-detect unRAID
if [[ -d "/mnt/user" ]]; then
    DEPLOY_DIR="${DEPLOY_DIR:-/mnt/user/appdata/hailmary}"
    COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.unraid.yml}"
else
    DEPLOY_DIR="${DEPLOY_DIR:-/opt/hail-mary}"
    COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.prod.yml}"
fi

LOG_FILE="${LOG_FILE:-/var/log/hail-mary-updates.log}"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
if [[ ! -d "$DEPLOY_DIR" ]]; then
    log "ERROR: Deploy directory $DEPLOY_DIR does not exist"
    exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
    log "ERROR: Compose file $COMPOSE_FILE does not exist"
    exit 1
fi

cd "$DEPLOY_DIR" || exit 1

# Get current running container image ID
get_container_image_id() {
    docker inspect --format='{{.Image}}' "hailmary-$1" 2>/dev/null || echo "none"
}

# Get image ID from compose config (what would be used if we deploy)
get_compose_image_id() {
    local image_name
    image_name=$(docker-compose -f "$COMPOSE_FILE" config 2>/dev/null | grep -A5 "hailmary-$1:" | grep "image:" | awk '{print $2}')
    if [[ -n "$image_name" ]]; then
        docker image inspect --format='{{.Id}}' "$image_name" 2>/dev/null || echo "none"
    else
        echo "none"
    fi
}

# Store current running image IDs
api_old=$(get_container_image_id api)
pwa_old=$(get_container_image_id pwa)
assistant_old=$(get_container_image_id assistant)

# Pull latest images and capture output
pull_output=$(docker-compose -f "$COMPOSE_FILE" pull 2>&1)

# Check if any new images were downloaded
if echo "$pull_output" | grep -q "Downloaded\|Pulling\|Pull complete"; then
    log "Updates detected, checking what changed..."
    
    # Get new image IDs from what was pulled
    api_new=$(get_compose_image_id api)
    pwa_new=$(get_compose_image_id pwa)
    assistant_new=$(get_compose_image_id assistant)
    
    # Check what changed
    updates_found=false
    if [[ "$api_old" != "$api_new" ]] && [[ "$api_new" != "none" ]]; then
        log "  → API service updated"
        updates_found=true
    fi
    if [[ "$pwa_old" != "$pwa_new" ]] && [[ "$pwa_new" != "none" ]]; then
        log "  → PWA service updated"
        updates_found=true
    fi
    if [[ "$assistant_old" != "$assistant_new" ]] && [[ "$assistant_new" != "none" ]]; then
        log "  → Assistant service updated"
        updates_found=true
    fi
    
    if [[ "$updates_found" == "true" ]]; then
        # Restart with new images
        log "Restarting containers with new images..."
        if docker-compose -f "$COMPOSE_FILE" up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE"; then
            log "✓ Update completed successfully"
            
            # Cleanup old images
            docker image prune -f &> /dev/null
        else
            log "✗ Update failed - check logs"
        fi
    else
        log "Images pulled but no version changes detected"
    fi
else
    log "No updates available"
fi
