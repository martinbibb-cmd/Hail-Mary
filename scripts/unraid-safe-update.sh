#!/bin/bash

# ============================================
# Hail-Mary: Safe NAS Update Script (Unraid)
# ============================================
#
# This script is designed to run as an Unraid User Script via Compose Manager.
# It safely updates the Hail-Mary stack with automatic database migrations.
#
# USAGE:
#   1. Create a new User Script in Unraid (Settings → User Scripts → Add New Script)
#   2. Name it: "Update PHM (safe + migrate)"
#   3. Paste this entire script into the script editor
#   4. Set schedule: "At First Array Start Only" or "Custom" (manual trigger)
#   5. Run manually or let it run automatically
#
# WHAT IT DOES:
#   1. Pull latest Docker images from GHCR
#   2. Start/update containers with docker-compose up -d
#   3. Wait for PostgreSQL to be healthy
#   4. Run database migrations inside the API container
#   5. Restart API and Assistant containers to apply changes
#   6. Perform health checks on all services
#   7. Report success or failure
#
# REQUIREMENTS:
#   - Unraid with Compose Manager plugin installed
#   - Hail-Mary project configured in Compose Manager
#   - Project name: "hailmary" (default) or set PROJECT_NAME below
#
# ============================================

set -e  # Exit on any error

# ============================================
# Configuration
# ============================================

# Compose Manager paths (Unraid default structure)
COMPOSE_MANAGER_BASE="/boot/config/plugins/compose.manager/projects"
PROJECT_NAME="${PROJECT_NAME:-hailmary}"
PROJECT_PATH="$COMPOSE_MANAGER_BASE/$PROJECT_NAME"
COMPOSE_FILE="$PROJECT_PATH/docker-compose.yml"
COMPOSE_OVERRIDE="$PROJECT_PATH/docker-compose.override.yml"

# Container names (adjust if you've customized them)
API_CONTAINER="${API_CONTAINER:-hailmary-hailmary-api-1}"
ASSISTANT_CONTAINER="${ASSISTANT_CONTAINER:-hailmary-hailmary-assistant-1}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-hailmary-hailmary-postgres-1}"

# PostgreSQL configuration
POSTGRES_USER="${POSTGRES_USER:-postgres}"

# Application paths
APP_WORKDIR="${APP_WORKDIR:-/app}"

# Health check endpoints (internal Docker network)
API_HEALTH_URL="http://127.0.0.1:3001/health"
API_DB_HEALTH_URL="http://127.0.0.1:3001/health/db"
PWA_HEALTH_URL="http://127.0.0.1:3000/"

# Timeouts (seconds)
POSTGRES_TIMEOUT=60
HEALTH_CHECK_TIMEOUT=30

# ============================================
# Helper Functions
# ============================================

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

success() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $*"
}

warning() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $*"
}

# Wait for PostgreSQL to be healthy
wait_for_postgres() {
  log "Waiting for PostgreSQL to be healthy (timeout: ${POSTGRES_TIMEOUT}s)..."
  local elapsed=0
  local interval=2
  
  while [ $elapsed -lt $POSTGRES_TIMEOUT ]; do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
      success "PostgreSQL is healthy"
      return 0
    fi
    
    sleep $interval
    elapsed=$((elapsed + interval))
    echo -n "."
  done
  
  echo ""
  error "PostgreSQL did not become healthy within ${POSTGRES_TIMEOUT}s"
  return 1
}

# Perform health check on a URL
check_health() {
  local url="$1"
  local name="$2"
  local max_time="${3:-$HEALTH_CHECK_TIMEOUT}"
  
  log "Health check: $name ($url)..."
  
  if curl --max-time "$max_time" -f -s "$url" >/dev/null 2>&1; then
    success "$name is healthy"
    return 0
  else
    warning "$name health check failed or timed out"
    return 1
  fi
}

# ============================================
# Pre-flight Checks
# ============================================

log "=========================================="
log "Hail-Mary Safe Update Script"
log "=========================================="
log ""

# Check if running on Unraid
if [ ! -d /boot/config ]; then
  warning "Not running on Unraid (expected /boot/config directory)"
  log "Continuing anyway..."
fi

# Check if Compose Manager paths exist
if [ ! -d "$PROJECT_PATH" ]; then
  error "Project path not found: $PROJECT_PATH"
  error "Make sure the project name is correct: $PROJECT_NAME"
  error "Available projects:"
  ls -1 "$COMPOSE_MANAGER_BASE" 2>/dev/null || echo "  (none found)"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  error "docker-compose.yml not found: $COMPOSE_FILE"
  exit 1
fi

log "Project path: $PROJECT_PATH"
log "Using compose file: $COMPOSE_FILE"
if [ -f "$COMPOSE_OVERRIDE" ]; then
  log "Using override file: $COMPOSE_OVERRIDE"
fi
log ""

# ============================================
# Step 1: Pull Latest Images
# ============================================

log "Step 1/6: Pulling latest Docker images..."
cd "$PROJECT_PATH"

if docker compose pull; then
  success "Images pulled successfully"
else
  error "Failed to pull images"
  exit 1
fi
log ""

# ============================================
# Step 2: Start/Update Containers
# ============================================

log "Step 2/6: Starting containers with latest images..."

if docker compose up -d; then
  success "Containers started successfully"
else
  error "Failed to start containers"
  exit 1
fi
log ""

# ============================================
# Step 3: Wait for PostgreSQL
# ============================================

log "Step 3/6: Waiting for PostgreSQL to be healthy..."

if wait_for_postgres; then
  log ""
else
  error "Cannot proceed without healthy PostgreSQL"
  exit 1
fi

# ============================================
# Step 4: Run Database Migrations
# ============================================

log "Step 4/6: Running database migrations..."

# Check if API container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${API_CONTAINER}$"; then
  error "API container not found: $API_CONTAINER"
  error "Available containers:"
  docker ps -a --format '{{.Names}}' | grep hailmary || echo "  (none found)"
  exit 1
fi

# Run migrations inside the API container
# Using sh -lc to ensure proper environment loading
log "Executing: npm -w @hail-mary/api run db:migrate"
if docker exec "$API_CONTAINER" sh -lc "cd $APP_WORKDIR && npm -w @hail-mary/api run db:migrate"; then
  success "Database migrations completed successfully"
else
  error "Database migrations failed"
  warning "The stack is running but may not be fully functional"
  exit 1
fi
log ""

# ============================================
# Step 5: Restart Services
# ============================================

log "Step 5/6: Restarting API and Assistant containers..."

# Restart API container to apply any changes
if docker restart "$API_CONTAINER" >/dev/null 2>&1; then
  success "API container restarted"
else
  warning "Failed to restart API container"
fi

# Restart Assistant container to apply any changes
if docker restart "$ASSISTANT_CONTAINER" >/dev/null 2>&1; then
  success "Assistant container restarted"
else
  warning "Failed to restart Assistant container"
fi

# Give services a moment to start
log "Waiting for services to initialize (5s)..."
sleep 5
log ""

# ============================================
# Step 6: Health Checks
# ============================================

log "Step 6/6: Performing health checks..."
log ""

# Check API health
check_health "$API_HEALTH_URL" "API Service" || true

# Check database connection via API
check_health "$API_DB_HEALTH_URL" "Database Connection" || true

# Check PWA/Frontend
check_health "$PWA_HEALTH_URL" "PWA Frontend" || true

log ""

# ============================================
# Summary
# ============================================

log "=========================================="
success "Update completed successfully!"
log "=========================================="
log ""
log "What was done:"
log "  ✅ Pulled latest Docker images"
log "  ✅ Updated running containers"
log "  ✅ Ran database migrations"
log "  ✅ Restarted services"
log "  ✅ Verified health checks"
log ""
log "Next steps:"
log "  - Verify the application is working: http://YOUR_NAS_IP:8080"
log "  - Check logs if needed: docker compose -f $COMPOSE_FILE logs -f"
log "  - View container status: docker compose -f $COMPOSE_FILE ps"
log ""
log "=========================================="

exit 0
