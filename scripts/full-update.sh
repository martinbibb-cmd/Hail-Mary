#!/bin/bash

# Full update script - pull, rebuild, and restart everything
# Use this when dependencies or Dockerfiles changed

set -e

echo "🔧 Full Update Mode"
echo ""
echo "🔄 Pulling latest changes..."
git pull

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🛑 Stopping current stack..."
docker-compose down

echo ""
echo "🔨 Building containers (this may take a while)..."
docker-compose build --no-cache

echo ""
echo "🚀 Starting stack..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "📊 Service status:"
docker-compose ps

echo ""
echo "✅ Full update complete!"
echo ""
echo "📝 Next steps:"
echo "  - View logs: make logs"
echo "  - Run migrations: make migrate"
echo "  - Check status: make status"
