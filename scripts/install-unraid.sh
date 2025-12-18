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

# Build error output limit (number of lines to show on failure)
BUILD_ERROR_LINES=50

# Container names (used for detection and cleanup)
# Listed in dependency order (reverse for cleanup)
HAILMARY_CONTAINERS=(
    "hailmary-postgres"
    "hailmary-api"
    "hailmary-assistant"
    "hailmary-pwa"
    "hailmary-migrator"
)

# Logging functions
log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }
log_debug() { 
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $*" 
    fi
}

# Build manual cleanup command from container array
build_cleanup_command() {
    printf "docker rm -f"
    printf " %s" "${HAILMARY_CONTAINERS[@]}"
}

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

# Check for existing Hail-Mary containers
check_existing_containers() {
    log_info "Checking for existing Hail-Mary containers..."
    
    local existing=()
    for container in "${HAILMARY_CONTAINERS[@]}"; do
        if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
            existing+=("$container")
            log_debug "Found existing container: $container"
        fi
    done
    
    if [[ ${#existing[@]} -eq 0 ]]; then
        log_success "No conflicting containers found"
        return 0
    fi
    
    log_warn "Found ${#existing[@]} existing Hail-Mary container(s):"
    for container in "${existing[@]}"; do
        local status
        status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
        echo "  - $container (status: $status)"
    done
    
    return 1
}

# Stop and remove existing containers
cleanup_existing_containers() {
    log_info "Cleaning up existing Hail-Mary containers..."
    
    # Cleanup in reverse dependency order
    local containers=()
    for ((i=${#HAILMARY_CONTAINERS[@]}-1; i>=0; i--)); do
        containers+=("${HAILMARY_CONTAINERS[i]}")
    done
    
    local removed_count=0
    local failed_count=0
    
    for container in "${containers[@]}"; do
        if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
            log_debug "Processing container: $container"
            
            # Stop the container if it's running
            local status
            status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
            if [[ "$status" == "running" ]]; then
                log_info "Stopping running container: $container"
                if docker stop "$container" &>/dev/null; then
                    log_debug "Successfully stopped $container"
                else
                    log_warn "Failed to stop $container, will try to remove anyway"
                fi
            fi
            
            # Remove the container
            log_info "Removing container: $container"
            if docker rm -f "$container" &>/dev/null; then
                log_success "Removed container: $container"
                ((removed_count++))
            else
                log_error "Failed to remove container: $container"
                ((failed_count++))
            fi
        fi
    done
    
    # Clean up the network if it exists and is not in use
    if docker network ls --format '{{.Name}}' | grep -q "^hailmary-network$"; then
        log_info "Removing existing Hail-Mary network..."
        if docker network rm hailmary-network &>/dev/null; then
            log_success "Removed network: hailmary-network"
        else
            log_debug "Network hailmary-network still in use or cannot be removed (will be reused)"
        fi
    fi
    
    if [[ $failed_count -gt 0 ]]; then
        log_error "Failed to remove $failed_count container(s)"
        log_info "You may need to manually remove them with: docker rm -f <container-name>"
        return 1
    fi
    
    if [[ $removed_count -gt 0 ]]; then
        log_success "Successfully removed $removed_count container(s)"
    else
        log_debug "No containers needed removal"
    fi
    
    return 0
}

# Handle container conflicts
handle_container_conflicts() {
    if ! check_existing_containers; then
        echo ""
        log_warn "Existing Hail-Mary containers detected!"
        echo ""
        echo "These containers may cause conflicts. You have the following options:"
        echo "  1. Remove existing containers and continue (recommended)"
        echo "  2. Stop existing containers and continue"
        echo "  3. Cancel installation"
        echo ""
        
        read -p "Choose an option (1-3): " -n 1 -r
        echo ""
        
        case "$REPLY" in
            1)
                log_info "Removing existing containers..."
                if ! cleanup_existing_containers; then
                    log_error "Failed to clean up some containers"
                    log_info "Please manually remove them or use: $(build_cleanup_command)"
                    exit 1
                fi
                log_success "Cleanup complete, continuing installation..."
                ;;
            2)
                log_info "Stopping existing containers..."
                # Only stop containers that actually exist
                for container in "${HAILMARY_CONTAINERS[@]}"; do
                    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
                        docker stop "$container" 2>/dev/null || true
                    fi
                done
                log_warn "Containers stopped but not removed - conflicts may still occur"
                log_info "Continuing installation..."
                ;;
            3)
                log_info "Installation cancelled by user"
                exit 0
                ;;
            *)
                log_error "Invalid option selected"
                exit 1
                ;;
        esac
    fi
}

# Clone or update repository
setup_repository() {
    log_info "Setting up repository at $INSTALL_DIR..."

    if [[ -d "$INSTALL_DIR/.git" ]]; then
        log_info "Repository already exists. Updating code..."
        cd "$INSTALL_DIR"
        
        # Stash any local changes before pulling
        if ! git diff-index --quiet HEAD --; then
            log_info "Stashing local changes..."
            git stash
        fi
        
        # Update repository
        log_info "Fetching latest changes from origin..."
        git fetch --all
        
        log_info "Resetting to latest main branch..."
        git reset --hard origin/main
        
        log_success "Repository updated to latest version"
    elif [[ -d "$INSTALL_DIR" ]]; then
        log_warn "Folder exists but is not a git repo. Cleaning and re-cloning..."
        rm -rf "$INSTALL_DIR"
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
        log_success "Repository cloned successfully"
    else
        log_info "Cloning repository..."
        mkdir -p "$(dirname "$INSTALL_DIR")"
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
        log_success "Repository cloned successfully"
    fi

    log_success "Repository ready at $INSTALL_DIR"
}

# Setup environment file
setup_environment() {
    log_info "Setting up environment configuration..."
    local env_file="$INSTALL_DIR/.env"

    if [[ -f "$env_file" ]]; then
        log_warn ".env file already exists, skipping creation"
    else
        log_info "Creating .env file with default configuration..."
        
        # Interactive password prompt
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Database Password Configuration"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        log_info "Please enter a secure password for the PostgreSQL database."
        log_info "This password will be used to secure your Hail-Mary database."
        echo ""
        log_info "Requirements:"
        echo "  • Minimum 12 characters recommended"
        echo "  • Use a mix of letters, numbers, and symbols"
        echo ""
        log_warn "If you leave this blank, a secure random password will be generated."
        echo ""
        
        local DB_PASS=""
        read -s -p "Enter PostgreSQL password (or press Enter to auto-generate): " -r DB_PASS
        echo ""
        
        # If user didn't provide a password, generate one
        if [[ -z "$DB_PASS" ]]; then
            DB_PASS=$(openssl rand -hex 24)
            log_info "Generated secure random password"
            SHOW_PASSWORD_AT_END=true
        else
            log_success "Using your custom password"
            SHOW_PASSWORD_AT_END=false
        fi
        
        # Generate JWT secret
        local JWT_SEC=$(openssl rand -hex 32)

        cat > "$env_file" << EOF
# Hail-Mary Environment Configuration
APPDATA_PATH=/mnt/user/appdata/hailmary
PWA_PORT=$PWA_PORT

# Database
POSTGRES_DB=hailmary
POSTGRES_USER=hailmary
POSTGRES_PASSWORD=$DB_PASS
DATABASE_URL=postgres://hailmary:$DB_PASS@hailmary-postgres:5432/hailmary

# Security
JWT_SECRET=$JWT_SEC

# Base URL
BASE_URL=http://$(hostname -I | awk '{print $1}'):$PWA_PORT
EOF
        log_success "Created .env file"
        
        # Store password for display at end if it was auto-generated
        if [[ "$SHOW_PASSWORD_AT_END" == "true" ]]; then
            GENERATED_DB_PASSWORD="$DB_PASS"
        fi
    fi
}

# Pull Docker images
pull_images() {
    log_info "Pulling Docker images from GitHub Container Registry..."
    cd "$INSTALL_DIR"

    local pull_output
    local pull_exit_code
    
    log_debug "Using compose file: docker-compose.unraid.yml"
    
    if docker compose version &> /dev/null; then
        log_debug "Using 'docker compose' command"
        pull_output=$(docker compose -f docker-compose.unraid.yml pull 2>&1)
        pull_exit_code=$?
    else
        log_debug "Using 'docker-compose' command"
        pull_output=$(docker-compose -f docker-compose.unraid.yml pull 2>&1)
        pull_exit_code=$?
    fi

    if [[ $pull_exit_code -eq 0 ]]; then
        log_success "Docker images pulled successfully"
        log_debug "Pull output: $pull_output"
        return 0
    else
        log_warn "Failed to pull pre-built images from GitHub Container Registry"
        log_info "This is expected if the images haven't been published yet"
        log_debug "Pull error output: $pull_output"
        log_debug "Exit code: $pull_exit_code"
        
        # Log specific error messages if they indicate common issues
        if echo "$pull_output" | grep -qi "manifest unknown\|not found"; then
            log_info "Images not found in registry (not yet published)"
        elif echo "$pull_output" | grep -qi "denied\|unauthorized"; then
            log_warn "Access denied to registry (authentication issue)"
        elif echo "$pull_output" | grep -qi "network\|timeout\|connection"; then
            log_warn "Network error while pulling images"
        fi
        
        return 1
    fi
}

# Build Docker images locally
build_images() {
    log_info "Building Docker images locally (this may take several minutes)..."
    cd "$INSTALL_DIR"

    local build_output
    local build_exit_code
    
    log_debug "Using compose file: docker-compose.unraid-build.yml"
    
    # Check if compose file exists
    if [[ ! -f "docker-compose.unraid-build.yml" ]]; then
        log_error "Build compose file not found: docker-compose.unraid-build.yml"
        return 1
    fi
    
    if docker compose version &> /dev/null; then
        log_debug "Using 'docker compose' command"
        build_output=$(docker compose -f docker-compose.unraid-build.yml build 2>&1)
        build_exit_code=$?
    else
        log_debug "Using 'docker-compose' command"
        build_output=$(docker-compose -f docker-compose.unraid-build.yml build 2>&1)
        build_exit_code=$?
    fi

    if [[ $build_exit_code -eq 0 ]]; then
        log_success "Docker images built successfully"
        log_debug "Build completed successfully"
        return 0
    else
        log_error "Failed to build Docker images locally"
        log_error "Build output (last $BUILD_ERROR_LINES lines):"
        echo "$build_output" | tail -n "$BUILD_ERROR_LINES"
        log_debug "Full build output: $build_output"
        log_debug "Exit code: $build_exit_code"
        
        # Provide specific guidance based on error patterns
        if echo "$build_output" | grep -qi "no space left"; then
            log_error "Insufficient disk space for building images"
            log_info "Free up disk space and try again"
        elif echo "$build_output" | grep -qi "network\|timeout\|connection"; then
            log_error "Network error during build"
            log_info "Check your internet connection and try again"
        elif echo "$build_output" | grep -qi "dockerfile"; then
            log_error "Dockerfile not found or has errors"
            log_info "Ensure the repository is properly cloned"
        elif echo "$build_output" | grep -qi "denied\|permission"; then
            log_error "Permission error during build"
            log_info "Ensure Docker has proper permissions"
        fi
        
        log_info "For more details, check the full output above"
        return 1
    fi
}

# Start containers
start_containers() {
    log_info "Starting containers..."
    cd "$INSTALL_DIR"

    local compose_file="$1"
    local start_output
    local start_exit_code
    
    log_debug "Starting containers with compose file: $compose_file"
    
    # Verify compose file exists
    if [[ ! -f "$compose_file" ]]; then
        log_error "Compose file not found: $compose_file"
        return 1
    fi
    
    if docker compose version &> /dev/null; then
        log_debug "Using 'docker compose' command"
        start_output=$(docker compose -f "$compose_file" up -d 2>&1)
        start_exit_code=$?
    else
        log_debug "Using 'docker-compose' command"
        start_output=$(docker-compose -f "$compose_file" up -d 2>&1)
        start_exit_code=$?
    fi

    if [[ $start_exit_code -eq 0 ]]; then
        log_success "Containers started successfully"
        log_debug "Start output: $start_output"
        
        # Show container status
        log_info "Container status:"
        if docker compose version &> /dev/null; then
            docker compose -f "$compose_file" ps
        else
            docker-compose -f "$compose_file" ps
        fi
        
        return 0
    else
        log_error "Failed to start containers"
        log_error "Error output:"
        echo "$start_output"
        
        # Check for common issues
        if echo "$start_output" | grep -qi "already in use\|conflict"; then
            log_error "Container name conflict detected"
            log_info "Some containers with the same names are already running"
            log_info "Run this script again and choose to remove existing containers"
        elif echo "$start_output" | grep -qi "port.*already allocated"; then
            log_error "Port conflict detected"
            log_info "Another service is using the required ports"
            log_info "Check which service is using port $PWA_PORT with: netstat -tuln | grep $PWA_PORT"
        elif echo "$start_output" | grep -qi "no such image"; then
            log_error "Docker image not found"
            log_info "Images may not have been built or pulled correctly"
        fi
        
        return 1
    fi
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
    
    # Display generated password if one was auto-generated
    if [[ -n "${GENERATED_DB_PASSWORD:-}" ]]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  🔐 IMPORTANT: Generated Database Password"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        log_warn "A secure random password was auto-generated for your database."
        log_warn "Please save this password in a secure location!"
        log_warn "⚠️  WARNING: This password will be visible in your terminal."
        log_warn "⚠️  Clear your terminal history if needed for security."
        echo ""
        echo "  Database Password: $GENERATED_DB_PASSWORD"
        echo ""
        log_info "You can also find this password in: $INSTALL_DIR/.env"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
    fi
    
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
    
    # Check for and handle any existing container conflicts
    handle_container_conflicts
    
    local compose_file=""
    
    if [[ "$FORCE_BUILD" == "true" ]]; then
        log_info "Local build mode enabled (--build flag)"
        if ! build_images; then
            log_error "Installation failed: Could not build Docker images"
            exit 1
        fi
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
            if ! build_images; then
                log_error "Installation failed: Could not build Docker images"
                log_info "Please check the error messages above and try again."
                exit 1
            fi
            compose_file="docker-compose.unraid-build.yml"
        fi
    fi
    
    if ! start_containers "$compose_file"; then
        log_error "Installation failed: Could not start containers"
        log_info "Please check the error messages above"
        log_info "You may need to manually clean up with: $(build_cleanup_command)"
        exit 1
    fi
    
    wait_for_services
    setup_auto_update
    show_completion "$compose_file"
}

main
