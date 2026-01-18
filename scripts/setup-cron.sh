#!/bin/bash
# ==============================================================================
# Hail-Mary NAS Cron Setup Script
# ==============================================================================
# This script sets up a cron job to periodically check for and pull
# updated Docker images from GitHub Container Registry.
#
# Usage:
#   ./setup-cron.sh [interval]
#
# Arguments:
#   interval    Check interval in minutes (default: 5)
#
# The cron job will:
#   1. Check if any images have updates
#   2. Pull new images if available
#   3. Restart containers with updated images
# ==============================================================================

set -e

# Configuration
DEPLOY_DIR="${DEPLOY_DIR:-/opt/hail-mary}"
CRON_USER="${CRON_USER:-root}"
CHECK_INTERVAL="${1:-5}"

echo "=========================================="
echo "Hail-Mary Cron Setup"
echo "=========================================="
echo "Deploy directory: $DEPLOY_DIR"
echo "Check interval: Every $CHECK_INTERVAL minutes"
echo "Cron user: $CRON_USER"
echo ""

# Ensure the check-updates script exists in the deployment directory
mkdir -p "$DEPLOY_DIR/scripts"

# Get the script directory (where this script is located)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Copy the check-updates script if it exists in the repo, otherwise download it
if [[ -f "$SCRIPT_DIR/check-updates.sh" ]]; then
    echo "Copying check-updates.sh from repository..."
    cp "$SCRIPT_DIR/check-updates.sh" "$DEPLOY_DIR/scripts/check-updates.sh"
else
    echo "Downloading check-updates.sh from GitHub..."
    curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/check-updates.sh -o "$DEPLOY_DIR/scripts/check-updates.sh"
fi

chmod +x "$DEPLOY_DIR/scripts/check-updates.sh"
echo "Update script installed successfully!"
echo ""

# Add cron job
CRON_ENTRY="*/$CHECK_INTERVAL * * * * $DEPLOY_DIR/scripts/check-updates.sh"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "check-updates.sh"; then
    echo "Cron job already exists. Updating..."
    crontab -l 2>/dev/null | grep -v "check-updates.sh" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "Cron job installed successfully!"
echo ""
echo "Current cron jobs:"
crontab -l
echo ""
echo "To view update logs:"
echo "  tail -f /var/log/hail-mary-updates.log"
echo ""
echo "To remove the cron job:"
echo "  crontab -l | grep -v 'check-updates.sh' | crontab -"
