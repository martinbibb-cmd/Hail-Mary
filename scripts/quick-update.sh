#!/bin/bash

# Quick update script - just pull and restart (no rebuild)
# Use this for fast updates when only code changed (no dependencies)

set -e

echo "⚡ Quick Update Mode"
echo ""
echo "🔄 Pulling latest changes..."
git pull

echo ""
echo "🔄 Restarting services..."
docker-compose restart

echo ""
echo "✅ Quick update complete!"
echo ""
echo "💡 If you see errors, run: make update (full rebuild)"
