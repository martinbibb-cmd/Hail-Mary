#!/bin/bash
# ==============================================================================
# Hail-Mary Auto-Update Setup Script
# ==============================================================================
# This script sets up automatic updates for your Hail-Mary NAS installation.
# It will configure your NAS to automatically pull and deploy new Docker images
# when you push code changes to GitHub.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/enable-autoupdate.sh | bash
#
# Or if repository is already cloned:
#   cd /opt/hail-mary
#   ./scripts/enable-autoupdate.sh [interval]
#
# Arguments:
#   interval    Check interval in minutes (default: 5)
# ==============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
CHECK_INTERVAL="${1:-5}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/hail-mary}"
REPO_URL="https://github.com/martinbibb-cmd/Hail-Mary.git"

# Auto-detect unRAID
if [[ -d "/mnt/user" ]]; then
    DEPLOY_DIR="/mnt/user/appdata/hailmary"
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Hail-Mary Auto-Update Setup                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if repository exists
if [[ ! -d "$DEPLOY_DIR" ]]; then
    echo -e "${YELLOW}Repository not found at $DEPLOY_DIR${NC}"
    echo -e "${BLUE}Cloning repository...${NC}"
    
    # Create parent directory if needed
    mkdir -p "$(dirname "$DEPLOY_DIR")"
    
    # Clone repository
    git clone "$REPO_URL" "$DEPLOY_DIR"
    
    echo -e "${GREEN}✓ Repository cloned${NC}"
fi

cd "$DEPLOY_DIR"

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "  Please install Docker first: https://docs.docker.com/engine/install/"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    echo "  Please install Docker Compose first"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose installed${NC}"

# Test GHCR access
echo -e "${BLUE}Testing access to GitHub Container Registry...${NC}"
if docker pull ghcr.io/martinbibb-cmd/hail-mary-api:latest &> /dev/null; then
    echo -e "${GREEN}✓ GHCR images are accessible${NC}"
else
    echo -e "${YELLOW}⚠ Cannot pull images from GHCR${NC}"
    echo ""
    echo -e "${YELLOW}This might be because:${NC}"
    echo "  1. Images are private (need authentication)"
    echo "  2. Images haven't been built yet (run GitHub Actions)"
    echo "  3. Network/firewall issues"
    echo ""
    echo -e "${BLUE}To authenticate with GHCR:${NC}"
    echo "  1. Create a GitHub Personal Access Token with 'read:packages' scope"
    echo "     https://github.com/settings/tokens"
    echo "  2. Run: echo \$TOKEN | docker login ghcr.io -u martinbibb-cmd --password-stdin"
    echo ""
    read -p "Do you want to continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Set up cron job
echo -e "${BLUE}Setting up automatic updates (checks every $CHECK_INTERVAL minutes)...${NC}"

# Create the check-updates script
mkdir -p "$DEPLOY_DIR/scripts"
cat > "$DEPLOY_DIR/scripts/check-updates.sh" << 'SCRIPT'
#!/bin/bash
# Automatic update checker for Hail-Mary

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
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

cd "$DEPLOY_DIR" || exit 1

# Get current image IDs
get_image_id() {
    docker inspect --format='{{.Image}}' "hailmary-$1" 2>/dev/null || echo "none"
}

api_old=$(get_image_id api)
pwa_old=$(get_image_id pwa)
assistant_old=$(get_image_id assistant)

# Pull latest images (quietly)
if docker-compose -f "$COMPOSE_FILE" pull --quiet 2>&1 | grep -q "Downloaded newer image"; then
    log "New images detected - pulling updates..."
    
    # Get new image IDs
    api_new=$(get_image_id api)
    pwa_new=$(get_image_id pwa)
    assistant_new=$(get_image_id assistant)
    
    # Check what changed
    if [[ "$api_old" != "$api_new" ]]; then
        log "  → API service updated"
    fi
    if [[ "$pwa_old" != "$pwa_new" ]]; then
        log "  → PWA service updated"
    fi
    if [[ "$assistant_old" != "$assistant_new" ]]; then
        log "  → Assistant service updated"
    fi
    
    # Restart with new images
    log "Restarting containers..."
    if docker-compose -f "$COMPOSE_FILE" up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE"; then
        log "✓ Update completed successfully"
        
        # Cleanup old images
        docker image prune -f &> /dev/null
    else
        log "✗ Update failed - check logs"
    fi
else
    log "No updates available"
fi
SCRIPT

chmod +x "$DEPLOY_DIR/scripts/check-updates.sh"
echo -e "${GREEN}✓ Update script created${NC}"

# Add to crontab
CRON_ENTRY="*/$CHECK_INTERVAL * * * * $DEPLOY_DIR/scripts/check-updates.sh"

# Remove existing entry if present
crontab -l 2>/dev/null | grep -v "check-updates.sh" | crontab - 2>/dev/null || true

# Add new entry
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo -e "${GREEN}✓ Cron job installed${NC}"

# Create log file with proper permissions
sudo touch /var/log/hail-mary-updates.log 2>/dev/null || touch /var/log/hail-mary-updates.log
sudo chmod 644 /var/log/hail-mary-updates.log 2>/dev/null || chmod 644 /var/log/hail-mary-updates.log

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Auto-Update Setup Complete!                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  • Update check interval: Every $CHECK_INTERVAL minutes"
echo "  • Deployment directory: $DEPLOY_DIR"
echo "  • Log file: /var/log/hail-mary-updates.log"
echo ""
echo -e "${BLUE}What happens next:${NC}"
echo "  1. Every $CHECK_INTERVAL minutes, the system checks for updates"
echo "  2. If new Docker images are available, they're pulled automatically"
echo "  3. Containers are restarted with the new images"
echo "  4. All updates are logged to /var/log/hail-mary-updates.log"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  View update logs:"
echo "    tail -f /var/log/hail-mary-updates.log"
echo ""
echo "  Force an immediate update:"
echo "    $DEPLOY_DIR/scripts/check-updates.sh"
echo ""
echo "  Check cron jobs:"
echo "    crontab -l"
echo ""
echo "  Remove auto-updates:"
echo "    crontab -l | grep -v 'check-updates.sh' | crontab -"
echo ""
echo -e "${GREEN}To push updates from development:${NC}"
echo "  1. Make code changes locally"
echo "  2. Push to GitHub: git push origin main"
echo "  3. GitHub Actions builds new Docker images (~5-10 min)"
echo "  4. Your NAS automatically pulls and deploys (within $CHECK_INTERVAL min)"
echo ""
echo -e "${YELLOW}Note:${NC} Manual trigger available at:"
echo "  https://github.com/martinbibb-cmd/Hail-Mary/actions"
echo ""
