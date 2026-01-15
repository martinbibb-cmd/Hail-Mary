#!/bin/bash
# ==============================================================================
# Hail-Mary Database Backup Script
# ==============================================================================
# Creates a timestamped backup of the PostgreSQL database
#
# Usage:
#   ./scripts/backup-database.sh [backup-directory]
#
# Options:
#   backup-directory    Optional directory for backups (default: ./backups)
#
# Examples:
#   ./scripts/backup-database.sh
#   ./scripts/backup-database.sh /mnt/user/appdata/hailmary/backups
# ==============================================================================

set -e

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="hailmary_backup_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="hailmary-hailmary"

# Auto-detect if running on unRAID
if [[ -d "/mnt/user/appdata/hailmary" ]]; then
    BACKUP_DIR="${BACKUP_DIR:-/mnt/user/appdata/hailmary/backups}"
fi

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Hail-Mary Database Backup             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}✗ Error: PostgreSQL container '$CONTAINER_NAME' is not running${NC}"
    echo "  Start the containers first with: docker compose up -d"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo -e "${BLUE}ℹ${NC} Creating database backup..."
echo "  Container: $CONTAINER_NAME"
echo "  Database: hailmary"
echo "  Backup file: $BACKUP_FILE"
echo "  Destination: $BACKUP_DIR"
echo ""

# Create backup
docker exec "$CONTAINER_NAME" pg_dump -U hailmary -d hailmary | gzip > "$BACKUP_DIR/$BACKUP_FILE"

# Get backup file size
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)

echo ""
echo -e "${GREEN}✓ Backup completed successfully!${NC}"
echo ""
echo "Backup details:"
echo "  • File: $BACKUP_DIR/$BACKUP_FILE"
echo "  • Size: $BACKUP_SIZE"
echo ""

# Show last 5 backups
echo "Recent backups:"
ls -lht "$BACKUP_DIR"/hailmary_backup_*.sql.gz 2>/dev/null | head -n 5 | awk '{print "  • " $9 " (" $5 ")"}'
echo ""

# Cleanup old backups (keep last 10)
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/hailmary_backup_*.sql.gz 2>/dev/null | wc -l)
if [[ $BACKUP_COUNT -gt 10 ]]; then
    echo -e "${YELLOW}⚠${NC} Cleaning up old backups (keeping last 10)..."
    ls -t "$BACKUP_DIR"/hailmary_backup_*.sql.gz | tail -n +11 | xargs rm -f
    echo -e "${GREEN}✓${NC} Cleanup completed"
    echo ""
fi

echo "Restore this backup with:"
echo "  ./scripts/restore-database.sh $BACKUP_DIR/$BACKUP_FILE"
echo ""
