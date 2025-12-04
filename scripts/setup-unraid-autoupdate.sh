#!/bin/bash
# ==============================================================================
# Hail-Mary unRAID Auto-Update Setup
# ==============================================================================
# This script configures automatic updates for Hail-Mary on unRAID using the
# User Scripts plugin.
#
# Prerequisites:
#   - User Scripts plugin installed (from Community Applications)
#   - Hail-Mary already installed at /mnt/user/appdata/hailmary
#
# Usage:
#   ./scripts/setup-unraid-autoupdate.sh [--interval <cron>]
#
# Options:
#   --interval    Cron schedule (default: "0 * * * *" = hourly)
#                 Examples:
#                   "*/15 * * * *"  - Every 15 minutes
#                   "0 */2 * * *"   - Every 2 hours
#                   "0 0 * * *"     - Daily at midnight
#   --help        Show this help message
# ==============================================================================

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/mnt/user/appdata/hailmary}"
USERSCRIPTS_DIR="/boot/config/plugins/user.scripts/scripts"
SCRIPT_NAME="hailmary-auto-update"
CRON_SCHEDULE="0 * * * *"  # Default: every hour

# Logging functions
log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }

# Show help
show_help() {
    head -n 23 "$0" | tail -n 21
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --interval)
            CRON_SCHEDULE="$2"
            shift 2
            ;;
        --help)
            show_help
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            ;;
    esac
done

# Banner
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   Hail-Mary Auto-Update Setup (unRAID)    ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if Hail-Mary is installed
    if [[ ! -d "$INSTALL_DIR" ]]; then
        log_error "Hail-Mary installation not found at $INSTALL_DIR"
        log_info "Run the installation script first: scripts/install-unraid.sh"
        exit 1
    fi

    # Check if User Scripts plugin is installed
    if [[ ! -d "$USERSCRIPTS_DIR" ]]; then
        log_error "User Scripts plugin not found"
        log_info "Install the User Scripts plugin from Community Applications:"
        log_info "  1. Go to Apps in unRAID"
        log_info "  2. Search for 'User Scripts'"
        log_info "  3. Click Install"
        exit 1
    fi

    # Check Docker Compose
    if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Create the auto-update script
create_update_script() {
    log_info "Creating auto-update script..."

    local script_dir="$USERSCRIPTS_DIR/$SCRIPT_NAME"
    mkdir -p "$script_dir"

    # Create the main script
    cat > "$script_dir/script" << 'UPDATESCRIPT'
#!/bin/bash
# Hail-Mary Auto-Update Script
# Checks for new Docker images and updates containers if available

INSTALL_DIR="/mnt/user/appdata/hailmary"
COMPOSE_FILE="docker-compose.unraid.yml"
LOG_PREFIX="[Hail-Mary Update]"

echo "$LOG_PREFIX Starting update check at $(date)"

# Change to install directory
if ! cd "$INSTALL_DIR"; then
    echo "$LOG_PREFIX ERROR: Cannot access $INSTALL_DIR"
    exit 1
fi

# Update git repository
echo "$LOG_PREFIX Checking for repository updates..."
git fetch origin
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "$LOG_PREFIX New commits found, pulling changes..."
    git pull
    REPO_UPDATED=true
else
    echo "$LOG_PREFIX Repository is up to date"
    REPO_UPDATED=false
fi

# Check for Docker image updates
echo "$LOG_PREFIX Checking for Docker image updates..."

# Capture pull output to check if images were updated
PULL_OUTPUT=$(docker compose -f "$COMPOSE_FILE" pull 2>&1)

# Check if any new images were downloaded
if echo "$PULL_OUTPUT" | grep -q "Downloaded newer image\|Status: Image is up to date"; then
    if echo "$PULL_OUTPUT" | grep -q "Downloaded newer image"; then
        IMAGE_UPDATED=true
        echo "$LOG_PREFIX New Docker images found!"
    else
        IMAGE_UPDATED=false
        echo "$LOG_PREFIX Docker images are up to date"
    fi
else
    IMAGE_UPDATED=false
    echo "$LOG_PREFIX No image updates available"
fi

# Restart containers if repository or images were updated
if [ "$REPO_UPDATED" = true ] || [ "$IMAGE_UPDATED" = true ]; then
    echo "$LOG_PREFIX Updates detected, restarting containers..."

    # Recreate containers with new images/config
    docker compose -f "$COMPOSE_FILE" up -d

    # Clean up old images
    echo "$LOG_PREFIX Cleaning up old Docker images..."
    docker image prune -f

    echo "$LOG_PREFIX ✓ Update completed successfully at $(date)"

    # Send unRAID notification (if notify command is available)
    if command -v /usr/local/emhttp/webGui/scripts/notify &> /dev/null; then
        /usr/local/emhttp/webGui/scripts/notify -i normal -s "Hail-Mary Updated" -d "Hail-Mary has been updated to the latest version"
    fi
else
    echo "$LOG_PREFIX No updates needed at $(date)"
fi

echo "$LOG_PREFIX Update check complete"
UPDATESCRIPT

    chmod +x "$script_dir/script"

    log_success "Update script created at $script_dir/script"
}

# Create description file
create_description() {
    local script_dir="$USERSCRIPTS_DIR/$SCRIPT_NAME"
    cat > "$script_dir/description" << 'DESC'
Automatically checks for and installs Hail-Mary updates from GitHub.

This script:
- Pulls the latest code from the GitHub repository
- Checks for new Docker images
- Restarts containers if updates are found
- Cleans up old Docker images

No action needed if no updates are available.
DESC

    log_success "Description created"
}

# Set schedule
set_schedule() {
    local script_dir="$USERSCRIPTS_DIR/$SCRIPT_NAME"
    echo "$CRON_SCHEDULE" > "$script_dir/schedule"

    log_success "Schedule set to: $CRON_SCHEDULE"
}

# Create arrayStarted flag (optional - run on array start)
create_array_start() {
    local script_dir="$USERSCRIPTS_DIR/$SCRIPT_NAME"

    # Ask user if they want to run on array start
    read -p "Run update check when array starts? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        touch "$script_dir/arrayStarted"
        log_success "Script will run when array starts"
    else
        rm -f "$script_dir/arrayStarted"
        log_info "Script will NOT run on array start"
    fi
}

# Test the script
test_script() {
    log_info "Testing the update script..."

    local script_dir="$USERSCRIPTS_DIR/$SCRIPT_NAME"

    echo ""
    echo "────────────────────────────────────────"
    bash "$script_dir/script"
    echo "────────────────────────────────────────"
    echo ""

    log_success "Test completed"
}

# Show completion message
show_completion() {
    local server_ip=$(hostname -I | awk '{print $1}')

    echo ""
    echo "╔════════════════════════════════════════════╗"
    echo "║   Auto-Update Setup Complete!             ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""
    log_success "Hail-Mary automatic updates are now configured!"
    echo ""
    echo "Configuration:"
    echo "  • Schedule: $CRON_SCHEDULE"
    echo "  • Script location: $USERSCRIPTS_DIR/$SCRIPT_NAME"
    echo ""
    echo "Manage updates:"
    echo "  • Web UI: http://$server_ip/Settings/UserScripts"
    echo "  • Or go to: Settings > User Scripts > $SCRIPT_NAME"
    echo ""
    echo "Available actions in User Scripts:"
    echo "  • Run Now - Manually trigger update check"
    echo "  • Edit Schedule - Change update frequency"
    echo "  • View Logs - See update history"
    echo "  • Disable - Temporarily disable auto-updates"
    echo ""
    echo "Common schedules:"
    echo "  • */15 * * * *  - Every 15 minutes (fast updates)"
    echo "  • 0 * * * *     - Every hour (recommended)"
    echo "  • 0 */6 * * *   - Every 6 hours (light usage)"
    echo "  • 0 2 * * *     - Daily at 2 AM (minimal disruption)"
    echo ""
    echo "To change the schedule:"
    echo "  ./scripts/setup-unraid-autoupdate.sh --interval '*/15 * * * *'"
    echo ""
}

# Main execution
main() {
    check_prerequisites
    create_update_script
    create_description
    set_schedule
    create_array_start
    test_script
    show_completion
}

main
