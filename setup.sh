#!/usr/bin/env bash
#
# Hail Mary / Atlas Setup Script
# Automated deployment for Ubuntu Server 24.04
#
# Usage:
#   sudo ./setup.sh [OPTIONS]
#
# Options:
#   --skip-docker         Skip Docker installation
#   --skip-clone          Skip repository cloning (use existing directory)
#   --data-dir PATH       Custom data directory (default: /data/atlas)
#   --backup-dir PATH     Custom backup directory (default: /data/backups)
#   --pwa-port PORT       PWA port (default: 3000)
#   --domain DOMAIN       Domain for BASE_URL (default: localhost:3000)
#   --help                Show this help message
#
# This script is idempotent - safe to run multiple times.
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
DATA_DIR="/data/atlas"
BACKUP_DIR="/data/backups"
REPO_URL="https://github.com/martinbibb-cmd/Hail-Mary"
REPO_DIR="/opt/hail-mary"
PWA_PORT="3000"
DOMAIN="localhost:3000"
SKIP_DOCKER=false
SKIP_CLONE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-docker)
      SKIP_DOCKER=true
      shift
      ;;
    --skip-clone)
      SKIP_CLONE=true
      shift
      ;;
    --data-dir)
      DATA_DIR="$2"
      shift 2
      ;;
    --backup-dir)
      BACKUP_DIR="$2"
      shift 2
      ;;
    --pwa-port)
      PWA_PORT="$2"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --help)
      head -n 25 "$0" | tail -n +2 | sed 's/^# //' | sed 's/^#//'
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Helper functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
  if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
  fi
}

check_ubuntu() {
  if ! grep -q "Ubuntu" /etc/os-release; then
    log_warning "This script is designed for Ubuntu Server 24.04"
    log_warning "Your OS: $(grep PRETTY_NAME /etc/os-release | cut -d'"' -f2)"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
}

generate_secure_password() {
  # Generate 32 character random hex string
  openssl rand -hex 16
}

install_prerequisites() {
  log_info "Installing prerequisites..."

  # Update package list
  apt-get update -qq

  # Install essentials
  apt-get install -y -qq \
    curl \
    wget \
    git \
    openssl \
    ca-certificates \
    gnupg \
    lsb-release \
    jq \
    > /dev/null 2>&1

  log_success "Prerequisites installed"
}

install_docker() {
  if $SKIP_DOCKER; then
    log_info "Skipping Docker installation (--skip-docker flag)"
    return
  fi

  if command -v docker &> /dev/null; then
    log_info "Docker already installed: $(docker --version)"
    return
  fi

  log_info "Installing Docker..."

  # Add Docker's official GPG key
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  # Set up the repository
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  # Install Docker Engine
  apt-get update -qq
  apt-get install -y -qq \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin \
    > /dev/null 2>&1

  # Start and enable Docker
  systemctl enable docker --now

  log_success "Docker installed: $(docker --version)"
  log_success "Docker Compose installed: $(docker compose version)"
}

clone_repository() {
  if $SKIP_CLONE; then
    log_info "Skipping repository clone (--skip-clone flag)"
    if [[ ! -d "$REPO_DIR" ]]; then
      log_error "Repository directory does not exist: $REPO_DIR"
      exit 1
    fi
    return
  fi

  if [[ -d "$REPO_DIR" ]]; then
    log_info "Repository already exists at $REPO_DIR"
    log_info "Updating repository..."
    cd "$REPO_DIR"
    git fetch origin
    git pull origin main
    log_success "Repository updated"
  else
    log_info "Cloning repository..."
    git clone "$REPO_URL" "$REPO_DIR"
    log_success "Repository cloned to $REPO_DIR"
  fi
}

create_directories() {
  log_info "Creating directory structure..."

  # Create data directories
  mkdir -p "$DATA_DIR"
  mkdir -p "$BACKUP_DIR"

  # Set permissions (allow postgres user to access)
  chmod 755 "$DATA_DIR"
  chmod 755 "$BACKUP_DIR"

  log_success "Directories created:"
  log_success "  Data: $DATA_DIR"
  log_success "  Backups: $BACKUP_DIR"
}

create_env_file() {
  cd "$REPO_DIR"

  if [[ -f .env ]]; then
    log_warning ".env file already exists"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log_info "Keeping existing .env file"
      return
    fi
  fi

  log_info "Generating .env file with secure credentials..."

  # Generate secure secrets
  DB_PASSWORD=$(generate_secure_password)
  JWT_SECRET=$(generate_secure_password)
  CSRF_SECRET=$(generate_secure_password)

  # Determine BASE_URL
  if [[ "$DOMAIN" == "localhost:"* ]] || [[ "$DOMAIN" == "127.0.0.1:"* ]]; then
    BASE_URL="http://${DOMAIN}"
  else
    BASE_URL="https://${DOMAIN}"
  fi

  # Create .env file
  cat > .env << EOF
# Hail Mary / Atlas Configuration
# Generated by setup.sh on $(date)

# ======================
# DATABASE (Required)
# ======================
POSTGRES_USER=hailmary
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=hailmary
DATABASE_URL=postgres://hailmary:${DB_PASSWORD}@hailmary-postgres:5432/hailmary

# ======================
# SERVER PORTS
# ======================
PORT=3001
ASSISTANT_PORT=3002
PWA_PORT=${PWA_PORT}

# ======================
# SECURITY (Required)
# ======================
JWT_SECRET=${JWT_SECRET}
CSRF_SECRET=${CSRF_SECRET}
BASE_URL=${BASE_URL}

# ======================
# INITIAL ADMIN USER
# ======================
INITIAL_ADMIN_EMAIL=admin@hailmary.local
INITIAL_ADMIN_PASSWORD=HailMary2024!
INITIAL_ADMIN_NAME=Admin

# ======================
# GUEST USER
# ======================
GUEST_EMAIL=guest@hailmary.local
GUEST_PASSWORD=guestpass

# ======================
# AI WORKER (Optional)
# ======================
WORKER_URL=https://hail-mary.martinbibb.workers.dev

# ======================
# SEEDING
# ======================
RUN_SEED=true

# ======================
# Add your API keys below if needed:
# ======================
# GEMINI_API_KEY=
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
# GOOGLE_CLIENT_SECRET=
EOF

  chmod 600 .env

  log_success ".env file created with secure credentials"
  log_warning "⚠️  IMPORTANT: Change the default admin password after first login!"
}

start_services() {
  cd "$REPO_DIR"

  log_info "Starting Docker services..."

  # Pull latest images
  docker compose pull

  # Start services
  docker compose up -d

  log_success "Docker services started"
}

wait_for_health() {
  log_info "Waiting for services to become healthy..."

  local max_attempts=60
  local attempt=0

  while [[ $attempt -lt $max_attempts ]]; do
    if docker ps --filter "name=hailmary-api" --filter "health=healthy" | grep -q hailmary-api; then
      log_success "API service is healthy"
      return 0
    fi

    attempt=$((attempt + 1))
    echo -n "."
    sleep 2
  done

  echo ""
  log_error "Services did not become healthy within timeout"
  log_info "Check logs with: docker compose -f $REPO_DIR/docker-compose.yml logs"
  return 1
}

run_health_checks() {
  log_info "Running health checks..."

  cd "$REPO_DIR"

  # Check containers
  log_info "Container status:"
  docker compose ps

  # Check API health
  log_info "Testing API endpoint..."
  if curl -sf "http://localhost:3001/health" > /dev/null; then
    log_success "✓ API is responding"
    curl -s "http://localhost:3001/health" | jq '.'
  else
    log_error "✗ API is not responding"
  fi

  # Check detailed health
  log_info "Testing detailed health endpoint..."
  if curl -sf "http://localhost:3001/health/detailed" > /dev/null; then
    log_success "✓ Detailed health check passed"
    curl -s "http://localhost:3001/health/detailed" | jq '.'
  else
    log_warning "✗ Detailed health check failed (may be degraded)"
    curl -s "http://localhost:3001/health/detailed" | jq '.' || true
  fi

  # Check database
  log_info "Testing database connection..."
  if curl -sf "http://localhost:3001/health/db" > /dev/null; then
    log_success "✓ Database is connected"
  else
    log_error "✗ Database connection failed"
  fi

  # Check PWA
  log_info "Testing PWA..."
  if curl -sf "http://localhost:${PWA_PORT}/" > /dev/null; then
    log_success "✓ PWA is serving"
  else
    log_error "✗ PWA is not responding"
  fi
}

create_backup_script() {
  log_info "Creating backup script..."

  cat > "${BACKUP_DIR}/backup.sh" << 'EOF'
#!/bin/bash
# Hail Mary Database Backup Script
# Usage: ./backup.sh

BACKUP_DIR="/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/hailmary_backup_${TIMESTAMP}.sql"

# Create backup
docker exec hailmary-postgres pg_dump -U hailmary hailmary > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

echo "Backup created: ${BACKUP_FILE}.gz"

# Keep only last 30 backups
cd "$BACKUP_DIR"
ls -t hailmary_backup_*.sql.gz | tail -n +31 | xargs -r rm

echo "Old backups cleaned up (kept last 30)"
EOF

  chmod +x "${BACKUP_DIR}/backup.sh"

  log_success "Backup script created at ${BACKUP_DIR}/backup.sh"
}

print_next_steps() {
  local IP=$(hostname -I | awk '{print $1}')

  cat << EOF

${GREEN}╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║  ✓ Hail Mary / Atlas Setup Complete!                          ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝${NC}

${BLUE}📍 Access Points:${NC}
  PWA (Frontend):     http://${IP}:${PWA_PORT}
  API:                http://${IP}:3001
  API Health:         http://${IP}:3001/health
  Detailed Health:    http://${IP}:3001/health/detailed
  Control Deck:       http://${IP}:${PWA_PORT}/admin/control-deck

${BLUE}🔐 Default Credentials:${NC}
  Admin Email:        admin@hailmary.local
  Admin Password:     HailMary2024!

  Guest Email:        guest@hailmary.local
  Guest Password:     guestpass

  ${YELLOW}⚠️  IMPORTANT: Change the admin password after first login!${NC}

${BLUE}📂 Important Paths:${NC}
  Repository:         $REPO_DIR
  Data Directory:     $DATA_DIR
  Backup Directory:   $BACKUP_DIR
  Environment File:   $REPO_DIR/.env

${BLUE}🔧 Common Commands:${NC}
  View logs:          cd $REPO_DIR && docker compose logs -f
  Restart services:   cd $REPO_DIR && docker compose restart
  Stop services:      cd $REPO_DIR && docker compose down
  Backup database:    $BACKUP_DIR/backup.sh
  Update images:      cd $REPO_DIR && docker compose pull && docker compose up -d
  Run health check:   curl http://localhost:3001/health/detailed | jq

${BLUE}📊 Health Monitoring:${NC}
  Check container status:
    docker compose -f $REPO_DIR/docker-compose.yml ps

  View API logs:
    docker logs -f hailmary-api

  Run Rocky health checker:
    cd $REPO_DIR && npm run rocky

${BLUE}🔄 Next Steps:${NC}
  1. Login to the PWA at http://${IP}:${PWA_PORT}
  2. Change the default admin password
  3. Configure API keys in $REPO_DIR/.env if needed:
     - GEMINI_API_KEY (for AI assistant)
     - OPENAI_API_KEY (for Whisper transcription)
     - ANTHROPIC_API_KEY (for Claude AI)
  4. Set up automated backups (cron job):
     echo "0 2 * * * $BACKUP_DIR/backup.sh" | crontab -

${BLUE}🆘 Troubleshooting:${NC}
  If services fail to start:
    1. Check logs: docker compose -f $REPO_DIR/docker-compose.yml logs
    2. Verify .env file: cat $REPO_DIR/.env
    3. Check disk space: df -h
    4. Restart Docker: systemctl restart docker

${BLUE}📚 Documentation:${NC}
  Repository:         https://github.com/martinbibb-cmd/Hail-Mary
  Issues:             https://github.com/martinbibb-cmd/Hail-Mary/issues

EOF
}

# Main execution
main() {
  log_info "Starting Hail Mary / Atlas setup..."

  check_root
  check_ubuntu
  install_prerequisites
  install_docker
  clone_repository
  create_directories
  create_env_file
  start_services
  wait_for_health
  run_health_checks
  create_backup_script

  log_success "Setup completed successfully!"
  print_next_steps
}

# Run main function
main
