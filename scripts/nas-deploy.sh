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
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"

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
    fi
    
    success "Prerequisites check passed"
}

# Login to registry (for private repos)
registry_login() {
    if [[ "$REGISTRY_LOGIN" == "true" ]]; then
        info "Logging in to GitHub Container Registry..."
        if [[ -z "$GITHUB_TOKEN" ]]; then
            error "GITHUB_TOKEN environment variable is required for registry login"
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
