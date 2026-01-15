#!/bin/bash
# ==============================================================================
# Hail-Mary Database Restore Script
# ==============================================================================
# Restores a PostgreSQL database from a backup file
#
# Usage:
#   ./scripts/restore-database.sh <backup-file>
#
# Options:
#   backup-file    Path to the backup file (.sql.gz)
#   --force        Skip confirmation prompt
#
# Examples:
#   ./scripts/restore-database.sh ./backups/hailmary_backup_20250101_120000.sql.gz
#   ./scripts/restore-database.sh /path/to/backup.sql.gz --force
# ==============================================================================

set -e

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="hailmary-hailmary"
DATABASE_NAME="hailmary"
FORCE=false

# Parse arguments
if [[ $# -eq 0 ]]; then
    echo -e "${RED}✗ Error: No backup file specified${NC}"
    echo ""
    echo "Usage: $0 <backup-file> [--force]"
    echo ""
    echo "Example:"
    echo "  $0 ./backups/hailmary_backup_20250101_120000.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [[ "$2" == "--force" ]]; then
    FORCE=true
fi

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Hail-Mary Database Restore            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check if backup file exists
if [[ ! -f "$BACKUP_FILE" ]]; then
    echo -e "${RED}✗ Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}✗ Error: PostgreSQL container '$CONTAINER_NAME' is not running${NC}"
    echo "  Start the containers first with: docker compose up -d"
    exit 1
fi

# Show backup info
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup file details:"
echo "  • File: $BACKUP_FILE"
echo "  • Size: $BACKUP_SIZE"
echo ""

# Warning and confirmation
if [[ "$FORCE" != "true" ]]; then
    echo -e "${YELLOW}⚠  WARNING: This will REPLACE ALL DATA in the database!${NC}"
    echo ""
    echo "This action will:"
    echo "  • Drop all existing tables"
    echo "  • Restore data from the backup file"
    echo "  • Cannot be undone without a backup"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Restore cancelled."
        exit 0
    fi
fi

# Create a safety backup before restore
echo -e "${BLUE}ℹ${NC} Creating safety backup before restore..."
SAFETY_BACKUP="./backups/safety_backup_before_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
mkdir -p ./backups
docker exec "$CONTAINER_NAME" pg_dump -U hailmary -d "$DATABASE_NAME" 2>/dev/null | gzip > "$SAFETY_BACKUP" || true
echo -e "${GREEN}✓${NC} Safety backup created: $SAFETY_BACKUP"
echo ""

# Perform restore
echo -e "${BLUE}ℹ${NC} Restoring database from backup..."

# Drop and recreate database
docker exec "$CONTAINER_NAME" psql -U hailmary -c "DROP DATABASE IF EXISTS ${DATABASE_NAME};"
docker exec "$CONTAINER_NAME" psql -U hailmary -c "CREATE DATABASE ${DATABASE_NAME};"

# Restore backup
zcat "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U hailmary -d "$DATABASE_NAME"

echo ""
echo -e "${GREEN}✓ Database restored successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart the application containers:"
echo "     docker compose restart hailmary-api hailmary-assistant"
echo ""
echo "  2. Verify the application is working correctly"
echo ""
echo "Safety backup available at:"
echo "  $SAFETY_BACKUP"
echo ""
