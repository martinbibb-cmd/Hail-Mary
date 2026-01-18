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
#   --build             Build images locally instead of pulling from registry
#   --no-cache          Build without cache (use with --build)
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
    head -n 24 "$0" | tail -n 22
    exit 0
}

# Parse arguments
BUILD_LOCALLY=false
NO_CACHE=false
REGISTRY_LOGIN=false
FORCE_RECREATE=false
SPECIFIC_SERVICE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --build)
            BUILD_LOCALLY=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
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

# Validate argument combinations
if [[ "$NO_CACHE" == "true" ]] && [[ "$BUILD_LOCALLY" != "true" ]]; then
    warn "--no-cache flag has no effect without --build flag"
    warn "Use both flags together: --build --no-cache"
fi

# Validate service name if specified
if [[ -n "$SPECIFIC_SERVICE" ]]; then
    case "$SPECIFIC_SERVICE" in
        api|pwa|assistant)
            # Valid service name
            ;;
        *)
            error "Invalid service name: $SPECIFIC_SERVICE"
            error "Valid services are: api, pwa, assistant"
            exit 1
            ;;
    esac
fi

# Set compose file if not already set
if [[ -z "$COMPOSE_FILE" ]]; then
    COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"
fi

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
            error "Expected files: docker-compose.prod.yml or docker-compose.yml"
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
        
        # Exit with error if has_errors is true
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

# Build images locally
build_images() {
    info "Building images locally..."
    cd "$DEPLOY_DIR" || {
        error "Failed to change to deployment directory: $DEPLOY_DIR"
        exit 1
    }
    
    local -a build_args=("-f" "$COMPOSE_FILE" "build")
    
    if [[ "$NO_CACHE" == "true" ]]; then
        info "Building without cache to ensure fresh build..."
        build_args+=("--no-cache")
    fi
    
    if [[ -n "$SPECIFIC_SERVICE" ]]; then
        info "Building image for service: $SPECIFIC_SERVICE"
        docker-compose "${build_args[@]}" "hailmary-${SPECIFIC_SERVICE}"
    else
        docker-compose "${build_args[@]}"
    fi
    
    success "Images built successfully"
}

# Pull latest images
pull_images() {
    info "Pulling latest images..."
    cd "$DEPLOY_DIR" || {
        error "Failed to change to deployment directory: $DEPLOY_DIR"
        exit 1
    }
    
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
    cd "$DEPLOY_DIR" || {
        error "Failed to change to deployment directory: $DEPLOY_DIR"
        exit 1
    }
    
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
        if curl -sf "http://localhost:${PWA_PORT:-8080}/" > /dev/null 2>&1; then
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
    cd "$DEPLOY_DIR" || {
        error "Failed to change to deployment directory: $DEPLOY_DIR"
        exit 1
    }
    docker-compose -f "$COMPOSE_FILE" ps
}

# Main execution
main() {
    info "=========================================="
    info "Hail-Mary NAS Deployment"
    info "=========================================="
    
    check_prerequisites
    validate_environment
    
    # Build or pull images depending on mode
    if [[ "$BUILD_LOCALLY" == "true" ]]; then
        info "Using local build mode (builds images from source)"
        build_images
    else
        info "Using registry pull mode (pulls pre-built images)"
        registry_login
        pull_images
    fi
    
    deploy_containers
    cleanup_images
    health_check
    show_status
    
    success "=========================================="
    success "Deployment completed successfully!"
    success "=========================================="
}

main
