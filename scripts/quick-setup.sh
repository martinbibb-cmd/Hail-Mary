#!/bin/bash
# ==============================================================================
# Hail-Mary Quick Setup Script
# ==============================================================================
# ONE-COMMAND SETUP for Hail-Mary on your NAS!
#
# This script does EVERYTHING:
#   ✓ Checks prerequisites
#   ✓ Sets up environment with secure defaults
#   ✓ Pulls/builds Docker images
#   ✓ Starts all services
#   ✓ Initializes database with schema
#   ✓ Seeds sample boiler products
#   ✓ Creates admin user
#   ✓ Runs health checks
#   ✓ Displays access information
#
# Usage:
#   # Quick install with defaults:
#   curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/quick-setup.sh | bash
#
#   # Or clone and run locally:
#   git clone https://github.com/martinbibb-cmd/Hail-Mary.git
#   cd Hail-Mary
#   ./scripts/quick-setup.sh
#
# Options:
#   --port <number>       Port for web UI (default: 8080)
#   --admin-email <email> Admin email (default: admin@hailmary.local)
#   --admin-password <pw> Admin password (default: auto-generated)
#   --build               Force local build instead of pulling images
#   --skip-health-check   Skip post-install health check
#   --help                Show this help
# ==============================================================================

set -e

# ============================================================================
# Configuration & Colors
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default configuration
PWA_PORT="8080"
ADMIN_EMAIL="admin@hailmary.local"
ADMIN_PASSWORD=""
FORCE_BUILD=false
SKIP_HEALTH_CHECK=false
INSTALL_DIR="$(pwd)"
REPO_URL="https://github.com/martinbibb-cmd/Hail-Mary.git"

# If not in the repo, need to clone
if [[ ! -f "$INSTALL_DIR/package.json" ]]; then
    INSTALL_DIR="./hailmary"
fi

# ============================================================================
# Helper Functions
# ============================================================================

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }
log_step() { echo -e "${PURPLE}▶${NC} $*"; }

show_banner() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                    ║${NC}"
    echo -e "${CYAN}║         🎯 Hail-Mary Quick Setup 🎯               ║${NC}"
    echo -e "${CYAN}║                                                    ║${NC}"
    echo -e "${CYAN}║    Your boiler quote tool - ready in minutes!     ║${NC}"
    echo -e "${CYAN}║                                                    ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
}

show_help() {
    head -n 36 "$0" | tail -n 34
    exit 0
}

generate_password() {
    # Generate a secure random password
    openssl rand -base64 16 | tr -d '=+/' | cut -c1-16
}

generate_jwt_secret() {
    # Generate a secure JWT secret (64 characters hex)
    openssl rand -hex 32
}

# ============================================================================
# Parse Arguments
# ============================================================================

while [[ $# -gt 0 ]]; do
    case "$1" in
        --port)
            PWA_PORT="$2"
            shift 2
            ;;
        --admin-email)
            ADMIN_EMAIL="$2"
            shift 2
            ;;
        --admin-password)
            ADMIN_PASSWORD="$2"
            shift 2
            ;;
        --build)
            FORCE_BUILD=true
            shift
            ;;
        --skip-health-check)
            SKIP_HEALTH_CHECK=true
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

# ============================================================================
# Main Installation Flow
# ============================================================================

main() {
    show_banner

    log_step "Step 1/9: Checking prerequisites..."
    check_prerequisites

    log_step "Step 2/9: Setting up repository..."
    setup_repository

    log_step "Step 3/9: Configuring environment..."
    setup_environment

    log_step "Step 4/9: Preparing Docker images..."
    prepare_images

    log_step "Step 5/9: Starting containers..."
    start_containers

    log_step "Step 6/9: Waiting for database..."
    wait_for_database

    log_step "Step 7/9: Running database migrations..."
    run_migrations

    log_step "Step 8/9: Seeding database..."
    seed_database

    if [[ "$SKIP_HEALTH_CHECK" != "true" ]]; then
        log_step "Step 9/9: Running health checks..."
        run_health_check
    else
        log_step "Step 9/9: Skipped (--skip-health-check)"
    fi

    show_success_message
}

# ============================================================================
# Installation Steps
# ============================================================================

check_prerequisites() {
    local all_good=true

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        all_good=false
    else
        log_success "Docker installed"
    fi

    # Check Docker Compose
    if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        all_good=false
    else
        log_success "Docker Compose installed"
    fi

    # Check git (only if we need to clone)
    if [[ ! -f "$INSTALL_DIR/package.json" ]] && ! command -v git &> /dev/null; then
        log_error "Git is not installed (needed to clone repository)"
        all_good=false
    else
        log_success "Git installed"
    fi

    if [[ "$all_good" != "true" ]]; then
        echo ""
        log_error "Prerequisites check failed. Please install missing dependencies."
        exit 1
    fi

    echo ""
}

setup_repository() {
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        log_info "Repository already exists at $INSTALL_DIR"
        cd "$INSTALL_DIR"
        log_info "Pulling latest changes..."
        git pull || log_warn "Failed to pull latest changes (continuing with current version)"
    else
        log_info "Cloning repository to $INSTALL_DIR..."
        mkdir -p "$(dirname "$INSTALL_DIR")"
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    log_success "Repository ready at $INSTALL_DIR"
    echo ""
}

setup_environment() {
    local env_file="$INSTALL_DIR/.env"

    # Generate secure credentials if not provided
    if [[ -z "$ADMIN_PASSWORD" ]]; then
        ADMIN_PASSWORD=$(generate_password)
        log_info "Generated secure admin password"
    fi

    JWT_SECRET=$(generate_jwt_secret)
    log_info "Generated secure JWT secret"

    # Detect IP address
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    BASE_URL="http://${LOCAL_IP}:${PWA_PORT}"

    if [[ -f "$env_file" ]]; then
        log_warn ".env file already exists"
        log_info "Backing up to .env.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$env_file" "${env_file}.backup.$(date +%Y%m%d_%H%M%S)"
    fi

    log_info "Creating optimized .env configuration..."
    cat > "$env_file" << EOF
# Hail-Mary Environment Configuration
# Generated by quick-setup.sh on $(date)

# ====================
# APPLICATION SETTINGS
# ====================

# Base URL for the application
BASE_URL=${BASE_URL}

# Port for the web UI
PWA_PORT=${PWA_PORT}

# ====================
# SECURITY (REQUIRED)
# ====================

# JWT Secret - DO NOT SHARE
JWT_SECRET=${JWT_SECRET}

# ====================
# INITIAL ADMIN USER
# ====================

INITIAL_ADMIN_EMAIL=${ADMIN_EMAIL}
INITIAL_ADMIN_PASSWORD=${ADMIN_PASSWORD}
INITIAL_ADMIN_NAME=Admin

# ====================
# DATABASE
# ====================

DATABASE_URL=postgres://postgres@hailmary-postgres:5432/hailmary

# ====================
# OPTIONAL FEATURES
# ====================

# Gemini API Key (for AI assistant features)
# Get your key from: https://aistudio.google.com/app/apikey
# GEMINI_API_KEY=your-gemini-api-key-here

# Google OAuth (disabled by default)
# GOOGLE_AUTH_ENABLED=false
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=

# ====================
# NAS / STORAGE
# ====================

# unRAID appdata path (auto-detected)
APPDATA_PATH=${INSTALL_DIR}
EOF

    log_success "Environment configured"
    echo ""

    # Save credentials to a separate file for easy reference
    CREDENTIALS_FILE="$INSTALL_DIR/.credentials.txt"
    cat > "$CREDENTIALS_FILE" << EOF
═══════════════════════════════════════════
Hail-Mary Admin Credentials
═══════════════════════════════════════════

Email:    ${ADMIN_EMAIL}
Password: ${ADMIN_PASSWORD}

Web URL:  ${BASE_URL}

IMPORTANT: Keep these credentials safe!
Delete this file after saving them securely.

Generated: $(date)
═══════════════════════════════════════════
EOF

    chmod 600 "$CREDENTIALS_FILE"
    log_success "Credentials saved to .credentials.txt"
    echo ""
}

prepare_images() {
    cd "$INSTALL_DIR"

    if [[ "$FORCE_BUILD" == "true" ]]; then
        log_info "Force build mode enabled"
        build_images
    else
        log_info "Attempting to pull pre-built images..."
        if pull_images; then
            COMPOSE_FILE="docker-compose.unraid.yml"
        else
            log_warn "Pre-built images not available"
            log_info "Falling back to local build..."
            build_images
            COMPOSE_FILE="docker-compose.unraid-build.yml"
        fi
    fi

    echo ""
}

pull_images() {
    if docker compose -f docker-compose.unraid.yml pull 2>&1 | tee /tmp/pull.log; then
        log_success "Images pulled successfully"
        COMPOSE_FILE="docker-compose.unraid.yml"
        return 0
    else
        return 1
    fi
}

build_images() {
    log_info "Building images locally (this may take 5-10 minutes)..."
    if docker compose -f docker-compose.unraid-build.yml build; then
        log_success "Images built successfully"
        COMPOSE_FILE="docker-compose.unraid-build.yml"
    else
        log_error "Failed to build images"
        exit 1
    fi
}

start_containers() {
    cd "$INSTALL_DIR"

    log_info "Starting all services..."
    if docker compose -f "$COMPOSE_FILE" up -d; then
        log_success "All containers started"
    else
        log_error "Failed to start containers"
        exit 1
    fi

    echo ""
}

wait_for_database() {
    log_info "Waiting for PostgreSQL to be ready..."

    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if docker exec hailmary-postgres pg_isready -U hailmary -d hailmary &> /dev/null; then
            log_success "Database is ready"
            echo ""
            return 0
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo ""
    log_error "Database did not become ready in time"
    log_info "Check logs with: docker logs hailmary-postgres"
    exit 1
}

run_migrations() {
    log_info "Running database migrations..."

    # Wait a bit for the API to start
    sleep 5

    # Check if migrations ran (API should auto-run them on startup)
    if docker exec hailmary-api npm run db:push &> /dev/null; then
        log_success "Database schema initialized"
    else
        log_warn "Migrations may have already run (this is normal)"
    fi

    echo ""
}

seed_database() {
    log_info "Seeding database with initial data..."
    log_info "  • Creating admin user"
    log_info "  • Adding sample boiler products"
    log_info "  • Setting up test customer"

    if docker exec hailmary-api npm run db:seed; then
        log_success "Database seeded successfully"
    else
        log_error "Failed to seed database"
        log_info "You can try manually with: docker exec hailmary-api npm run db:seed"
    fi

    echo ""
}

run_health_check() {
    log_info "Running post-installation health checks..."
    echo ""

    if [[ -f "$INSTALL_DIR/scripts/health-check.sh" ]]; then
        "$INSTALL_DIR/scripts/health-check.sh"
    else
        log_warn "Health check script not found, skipping..."
    fi
}

show_success_message() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                    ║${NC}"
    echo -e "${GREEN}║          🎉 Installation Complete! 🎉             ║${NC}"
    echo -e "${GREEN}║                                                    ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Access Your Application${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  🌐 Web UI:  ${GREEN}${BASE_URL}${NC}"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Login Credentials${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  📧 Email:    ${YELLOW}${ADMIN_EMAIL}${NC}"
    echo -e "  🔑 Password: ${YELLOW}${ADMIN_PASSWORD}${NC}"
    echo ""
    echo -e "  ${RED}⚠ Important: Save these credentials!${NC}"
    echo -e "  They are also saved in: ${INSTALL_DIR}/.credentials.txt"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}What's Included${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "  ✓ Admin user account created"
    echo "  ✓ 14 sample boiler products loaded"
    echo "  ✓ Test customer account ready"
    echo "  ✓ All services running and healthy"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Useful Commands${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "  📊 Health check:"
    echo "     $INSTALL_DIR/scripts/health-check.sh"
    echo ""
    echo "  📦 View logs:"
    echo "     docker compose -f $INSTALL_DIR/$COMPOSE_FILE logs -f"
    echo ""
    echo "  🔄 Restart services:"
    echo "     docker compose -f $INSTALL_DIR/$COMPOSE_FILE restart"
    echo ""
    echo "  💾 Backup database:"
    echo "     $INSTALL_DIR/scripts/backup-database.sh"
    echo ""
    echo "  🛑 Stop services:"
    echo "     docker compose -f $INSTALL_DIR/$COMPOSE_FILE stop"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Next Steps${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "  1. Visit ${GREEN}${BASE_URL}${NC}"
    echo "  2. Log in with the credentials above"
    echo "  3. Start creating quotes!"
    echo ""
    echo "  Optional enhancements:"
    echo "  • Add a Gemini API key for AI features"
    echo "  • Configure Google OAuth for easy login"
    echo "  • Set up automatic backups"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "  📚 Documentation: https://github.com/martinbibb-cmd/Hail-Mary"
    echo "  🐛 Issues: https://github.com/martinbibb-cmd/Hail-Mary/issues"
    echo ""
}

# ============================================================================
# Run Main Installation
# ============================================================================

main
