#!/bin/bash

# Hail-Mary: Pull Updates and Restart Stack
# Usage: ./scripts/update-and-restart.sh

set -e  # Exit on any error

echo "🔄 Pulling latest changes from git..."
git pull

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🛑 Stopping current stack..."
docker-compose down

echo ""
echo "🚀 Starting stack..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

echo ""
echo "📊 Service status:"
docker-compose ps

echo ""
echo "✅ Stack restarted successfully!"
echo ""
echo "📝 Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Run migrations: npm run db:migrate"
echo "  - Stop stack: docker-compose down"
