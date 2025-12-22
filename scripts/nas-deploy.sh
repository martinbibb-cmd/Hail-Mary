#!/bin/bash
# ==============================================================================
# Hail-Mary NAS Deployment Script
# ==============================================================================
# This script pulls the latest Docker images from GitHub Container Registry
# and restarts the containers using docker-compose.
#
# Usage:
#   ./nas-deploy.sh [options]
#
# Options:
#   --registry-login    Login to GitHub Container Registry before pulling
#   --force-recreate    Force recreate containers even if no image changes
#   --service <name>    Deploy only a specific service (api, pwa, assistant)
#   --help              Show this help message
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - Access to GitHub Container Registry (for private repos)
#   - Repository cloned to /opt/hail-mary (or set DEPLOY_DIR)
# ==============================================================================

set -e

# Configuration
DEPLOY_DIR="${DEPLOY_DIR:-/opt/hail-mary}"
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_PREFIX="${IMAGE_PREFIX:-martinbibb-cmd/hail-mary}"
LOG_FILE="${LOG_FILE:-/var/log/hail-mary-deploy.log}"

# Auto-detect unRAID and set appropriate compose file
if [[ -d "/mnt/user" ]] && [[ -z "$COMPOSE_FILE" ]]; then
    # Running on unRAID
    DEPLOY_DIR="${DEPLOY_DIR:-/mnt/user/appdata/hailmary}"
    COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.unraid.yml"
else
    COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.prod.yml}"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

info() { log "INFO" "$@"; }
warn() { log "${YELLOW}WARN${NC}" "$@"; }
error() { log "${RED}ERROR${NC}" "$@"; }
success() { log "${GREEN}SUCCESS${NC}" "$@"; }

# Help message
show_help() {
    head -n 22 "$0" | tail -n 20
    exit 0
}

# Parse arguments
REGISTRY_LOGIN=false
FORCE_RECREATE=false
SPECIFIC_SERVICE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --registry-login)
            REGISTRY_LOGIN=true
            shift
            ;;
        --force-recreate)
            FORCE_RECREATE=true
            shift
            ;;
        --service)
            SPECIFIC_SERVICE="$2"
            shift 2
            ;;
        --help)
            show_help
            ;;
        *)
            error "Unknown option: $1"
            show_help
            ;;
    esac
done

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    if [[ ! -d "$DEPLOY_DIR" ]]; then
        error "Deployment directory $DEPLOY_DIR does not exist."
        exit 1
    fi
    
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        warn "Production compose file not found at $COMPOSE_FILE"
        warn "Falling back to ${DEPLOY_DIR}/docker-compose.yml"
        COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
        
        if [[ ! -f "$COMPOSE_FILE" ]]; then
            error "No valid docker-compose file found in $DEPLOY_DIR"
            error "Expected files: docker-compose.unraid.yml or docker-compose.prod.yml or docker-compose.yml"
            exit 1
        fi
    fi
    
    success "Prerequisites check passed"
}

# Validate environment variables
validate_environment() {
    info "Validating environment configuration..."
    
    local env_file="${DEPLOY_DIR}/.env"
    
    # Check if .env file exists
    if [[ ! -f "$env_file" ]]; then
        error ".env file not found at $env_file"
        error "Please create a .env file based on .env.example"
        error "Run: cp ${DEPLOY_DIR}/.env.example ${env_file}"
        exit 1
    fi
    
    info ".env file found at $env_file"
    
    # Source the .env file to check variables
    # Use a subshell to avoid polluting current environment
    (
        set -a
        # shellcheck disable=SC1090
        source "$env_file"
        set +a
        
        local has_errors=false
        
        # Check critical database variables
        if [[ -z "$POSTGRES_PASSWORD" ]]; then
            echo -e "${RED}ERROR${NC}: POSTGRES_PASSWORD is not set in .env file" >&2
            has_errors=true
        fi
        
        # Check JWT_SECRET (critical for security)
        if [[ -z "$JWT_SECRET" ]]; then
            echo -e "${RED}ERROR${NC}: JWT_SECRET is not set in .env file" >&2
            echo -e "${RED}ERROR${NC}: This is required for security. Generate one with:" >&2
            echo -e "  # Using Node.js:" >&2
            echo -e "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"" >&2
            echo -e "  # Or using OpenSSL:" >&2
            echo -e "  openssl rand -hex 32" >&2
            has_errors=true
        fi
        
        # Validate unRAID-specific paths if on unRAID
        if [[ -d "/mnt/user" ]]; then
            if [[ ! -f "${DEPLOY_DIR}/docker-compose.unraid.yml" ]]; then
                echo -e "${YELLOW}WARN${NC}: Running on unRAID but docker-compose.unraid.yml not found" >&2
                echo -e "${YELLOW}WARN${NC}: Expected at: ${DEPLOY_DIR}/docker-compose.unraid.yml" >&2
            fi
        fi
        
        # Return error status from subshell
        if [[ "$has_errors" == "true" ]]; then
            exit 1
        fi
    )
    
    # Check if subshell exited with error
    if [[ $? -ne 0 ]]; then
        error "Environment validation failed. Please fix the issues above."
        error "Refer to .env.example for required variables and their descriptions."
        exit 1
    fi
    
    success "Environment validation passed"
}

# Login to registry (for private repos)
registry_login() {
    if [[ "$REGISTRY_LOGIN" == "true" ]]; then
        info "Logging in to GitHub Container Registry..."
        if [[ -z "$GITHUB_TOKEN" ]]; then
            error "GITHUB_TOKEN environment variable is required for registry login"
            exit 1
        fi
        if [[ -z "$GITHUB_USER" ]]; then
            error "GITHUB_USER environment variable is required for registry login"
            exit 1
        fi
        echo "$GITHUB_TOKEN" | docker login "$REGISTRY" -u "$GITHUB_USER" --password-stdin
        success "Registry login successful"
    fi
}

# Pull latest images
pull_images() {
    info "Pulling latest images..."
    cd "$DEPLOY_DIR"
    
    if [[ -n "$SPECIFIC_SERVICE" ]]; then
        info "Pulling image for service: $SPECIFIC_SERVICE"
        docker-compose -f "$COMPOSE_FILE" pull "hailmary-${SPECIFIC_SERVICE}"
    else
        docker-compose -f "$COMPOSE_FILE" pull
    fi
    
    success "Images pulled successfully"
}

# Update and restart containers
deploy_containers() {
    info "Deploying containers..."
    cd "$DEPLOY_DIR"
    
    local -a compose_args=("-f" "$COMPOSE_FILE" "up" "-d" "--remove-orphans")
    
    if [[ "$FORCE_RECREATE" == "true" ]]; then
        compose_args+=("--force-recreate")
    fi
    
    if [[ -n "$SPECIFIC_SERVICE" ]]; then
        docker-compose "${compose_args[@]}" "hailmary-${SPECIFIC_SERVICE}"
    else
        docker-compose "${compose_args[@]}"
    fi
    
    success "Containers deployed successfully"
}

# Cleanup old images
cleanup_images() {
    info "Cleaning up unused Docker images..."
    docker image prune -f
    success "Cleanup completed"
}

# Health check
health_check() {
    info "Performing health checks..."
    
    local max_attempts=30
    local attempt=1
    local healthy=false
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "http://localhost:${PWA_PORT:-3000}/" > /dev/null 2>&1; then
            healthy=true
            break
        fi
        info "Waiting for services to be healthy... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    if [[ "$healthy" == "true" ]]; then
        success "Health check passed - services are running"
    else
        error "Health check failed - services may not be running correctly"
        error "Check logs with: docker-compose -f $COMPOSE_FILE logs"
        exit 1
    fi
}

# Show container status
show_status() {
    info "Container status:"
    cd "$DEPLOY_DIR"
    docker-compose -f "$COMPOSE_FILE" ps
}

# Main execution
main() {
    info "=========================================="
    info "Hail-Mary NAS Deployment"
    info "=========================================="
    
    check_prerequisites
    validate_environment
    registry_login
    pull_images
    deploy_containers
    cleanup_images
    health_check
    show_status
    
    success "=========================================="
    success "Deployment completed successfully!"
    success "=========================================="
}

main
