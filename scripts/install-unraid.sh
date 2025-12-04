#!/bin/bash
# ==============================================================================
# Hail-Mary unRAID Installation Script
# ==============================================================================
# This script automates the installation of Hail-Mary on unRAID.
#
# Features:
#   - Installs to /mnt/user/appdata/hailmary
#   - Pulls pre-built images from GitHub Container Registry
#   - Falls back to local build if pre-built images are not available
#   - Sets up environment configuration
#   - Optionally configures automatic updates
#
# Usage:
#   wget -O - https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/install-unraid.sh | bash
#
#   Or for local installation:
#   ./scripts/install-unraid.sh
#
# Options:
#   --auto-update    Enable automatic updates (requires User Scripts plugin)
#   --port <number>  Set PWA port (default: 8080)
#   --build          Force local build instead of pulling pre-built images
#   --help           Show this help message
# ==============================================================================

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/mnt/user/appdata/hailmary"
REPO_URL="https://github.com/martinbibb-cmd/Hail-Mary.git"
PWA_PORT="8080"
AUTO_UPDATE=false
FORCE_BUILD=false

# Logging functions
log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }

# Show help
show_help() {
    head -n 30 "$0" | tail -n 28
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --auto-update)
            AUTO_UPDATE=true
            shift
            ;;
        --port)
            PWA_PORT="$2"
            shift 2
            ;;
        --build)
            FORCE_BUILD=true
            shift
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
echo "║     Hail-Mary unRAID Installation         ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if running on unRAID
    if [[ ! -d "/mnt/user" ]]; then
        log_warn "Warning: /mnt/user not found. Are you running on unRAID?"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    # Check Docker Compose
    if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        log_info "Please install Docker Compose Manager from Community Applications"
        exit 1
    fi

    # Check git
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed"
        log_info "Install the Nerd Tools plugin from Community Applications"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Clone or update repository
setup_repository() {
    log_info "Setting up repository at $INSTALL_DIR..."

    if [[ -d "$INSTALL_DIR/.git" ]]; then
        log_info "Repository already exists. Pulling latest changes..."
        cd "$INSTALL_DIR"
        git pull
    else
        log_info "Cloning repository..."
        mkdir -p "$(dirname "$INSTALL_DIR")"
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    log_success "Repository ready at $INSTALL_DIR"
}

# Setup environment file
setup_environment() {
    log_info "Setting up environment configuration..."

    local env_file="$INSTALL_DIR/.env"

    if [[ -f "$env_file" ]]; then
        log_warn ".env file already exists, skipping creation"
        log_info "You can edit it at: $env_file"
    else
        log_info "Creating .env file with default configuration..."
        cat > "$env_file" << EOF
# Hail-Mary Environment Configuration for unRAID
# Generated on $(date)

# unRAID appdata path
APPDATA_PATH=/mnt/user/appdata/hailmary

# Port configuration
PWA_PORT=$PWA_PORT

# Security (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=change-this-to-a-random-secret-$(openssl rand -hex 16)

# Base URL (update this if using a custom domain)
BASE_URL=http://$(hostname -I | awk '{print $1}'):$PWA_PORT

# AI Assistant (optional - leave empty if not using)
# GEMINI_API_KEY=your-gemini-api-key-here
# GEMINI_MODEL=gemini-1.5-flash

# Initial admin user (optional - will be created on first run)
# INITIAL_ADMIN_EMAIL=admin@example.com
# INITIAL_ADMIN_PASSWORD=change-this-password
EOF
        log_success "Created .env file"
        log_warn "Remember to update JWT_SECRET and other settings in $env_file"
    fi
}

# Pull Docker images
pull_images() {
    log_info "Pulling Docker images from GitHub Container Registry..."
    cd "$INSTALL_DIR"

    local pull_success=true
    if docker compose version &> /dev/null; then
        if ! docker compose -f docker-compose.unraid.yml pull 2>&1; then
            pull_success=false
        fi
    else
        if ! docker-compose -f docker-compose.unraid.yml pull 2>&1; then
            pull_success=false
        fi
    fi

    if [[ "$pull_success" == "true" ]]; then
        log_success "Docker images pulled successfully"
        return 0
    else
        log_warn "Failed to pull pre-built images from GitHub Container Registry"
        log_info "This is expected if the images haven't been published yet"
        return 1
    fi
}

# Build Docker images locally
build_images() {
    log_info "Building Docker images locally (this may take several minutes)..."
    cd "$INSTALL_DIR"

    if docker compose version &> /dev/null; then
        docker compose -f docker-compose.unraid-build.yml build
    else
        docker-compose -f docker-compose.unraid-build.yml build
    fi

    log_success "Docker images built successfully"
}

# Start containers
start_containers() {
    log_info "Starting containers..."
    cd "$INSTALL_DIR"

    local compose_file="$1"
    
    if docker compose version &> /dev/null; then
        docker compose -f "$compose_file" up -d
    else
        docker-compose -f "$compose_file" up -d
    fi

    log_success "Containers started"
}

# Wait for services to be healthy
wait_for_services() {
    log_info "Waiting for services to be ready..."

    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "http://localhost:$PWA_PORT/" > /dev/null 2>&1; then
            log_success "Services are ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo ""
    log_warn "Services did not become ready within expected time"
    log_info "Check container logs with: docker logs hailmary-pwa"
}

# Setup automatic updates
setup_auto_update() {
    if [[ "$AUTO_UPDATE" != "true" ]]; then
        return
    fi

    log_info "Setting up automatic updates..."

    local userscripts_dir="/boot/config/plugins/user.scripts/scripts"
    local script_dir="$userscripts_dir/hailmary-auto-update"

    if [[ ! -d "$userscripts_dir" ]]; then
        log_warn "User Scripts plugin not found"
        log_info "Install User Scripts from Community Applications to enable auto-updates"
        log_info "Then run: $INSTALL_DIR/scripts/setup-unraid-autoupdate.sh"
        return
    fi

    mkdir -p "$script_dir"

    cat > "$script_dir/script" << 'USERSCRIPT'
#!/bin/bash
# Hail-Mary Auto-Update Script for unRAID
# This script checks for new Docker images and updates containers if available

INSTALL_DIR="/mnt/user/appdata/hailmary"
cd "$INSTALL_DIR" || exit 1

echo "Checking for updates..."

# Pull latest images
if docker compose -f docker-compose.unraid.yml pull 2>&1 | grep -q "Downloaded newer image"; then
    echo "New images found! Updating containers..."
    docker compose -f docker-compose.unraid.yml up -d
    docker image prune -f
    echo "Update completed successfully"
else
    echo "No updates available"
fi
USERSCRIPT

    chmod +x "$script_dir/script"

    # Create description file
    echo "Automatically updates Hail-Mary containers when new images are available" > "$script_dir/description"

    # Create schedule file (run every hour)
    echo "0 * * * *" > "$script_dir/schedule"

    log_success "Auto-update script installed"
    log_info "Configure schedule in Settings > User Scripts > hailmary-auto-update"
}

# Show completion message
show_completion() {
    local compose_file="$1"
    
    echo ""
    echo "╔════════════════════════════════════════════╗"
    echo "║     Installation Complete!                ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""
    log_success "Hail-Mary is now running on your unRAID server!"
    echo ""
    echo "Access the application:"
    echo "  • Local: http://$(hostname -I | awk '{print $1}'):$PWA_PORT"
    echo "  • From unRAID Docker tab: Click the WebUI icon"
    echo ""
    echo "Default admin login:"
    echo "  • See your .env file for INITIAL_ADMIN_EMAIL/PASSWORD"
    echo "  • Or create a user in the application"
    echo ""
    echo "Configuration:"
    echo "  • Environment: $INSTALL_DIR/.env"
    echo "  • Compose file: $INSTALL_DIR/$compose_file"
    echo ""
    echo "Useful commands:"
    echo "  • View logs: docker logs hailmary-pwa"
    echo "  • Restart: docker compose -f $INSTALL_DIR/$compose_file restart"
    echo "  • Stop: docker compose -f $INSTALL_DIR/$compose_file stop"
    
    if [[ "$compose_file" == "docker-compose.unraid.yml" ]]; then
        echo "  • Update: docker compose -f $INSTALL_DIR/$compose_file pull && docker compose -f $INSTALL_DIR/$compose_file up -d"
    else
        echo "  • Update: cd $INSTALL_DIR && git pull && docker compose -f $compose_file build && docker compose -f $compose_file up -d"
    fi
    echo ""

    if [[ "$AUTO_UPDATE" == "true" ]]; then
        echo "Automatic updates:"
        echo "  • Configured in Settings > User Scripts > hailmary-auto-update"
        echo "  • Default: Checks hourly for new images"
        echo ""
    else
        echo "To enable automatic updates:"
        echo "  • Install User Scripts plugin from Community Applications"
        echo "  • Run: $INSTALL_DIR/scripts/setup-unraid-autoupdate.sh"
        echo ""
    fi

    echo "Documentation:"
    echo "  • Full guide: $INSTALL_DIR/docs/DEPLOYMENT-unRAID.md"
    echo "  • GitHub: https://github.com/martinbibb-cmd/Hail-Mary"
    echo ""
}

# Main installation flow
main() {
    check_prerequisites
    setup_repository
    setup_environment
    
    local compose_file=""
    
    if [[ "$FORCE_BUILD" == "true" ]]; then
        log_info "Local build mode enabled (--build flag)"
        build_images
        compose_file="docker-compose.unraid-build.yml"
    else
        # Try to pull pre-built images first
        if pull_images; then
            compose_file="docker-compose.unraid.yml"
        else
            # Fallback to local build
            log_info ""
            log_info "Falling back to local build mode..."
            log_info "This builds the Docker images on your NAS instead of downloading them."
            log_info ""
            build_images
            compose_file="docker-compose.unraid-build.yml"
        fi
    fi
    
    start_containers "$compose_file"
    wait_for_services
    setup_auto_update
    show_completion "$compose_file"
}

main
