#!/bin/bash
# Quick Database Migration Script
# Run this on your production server to apply pending migrations

set -e  # Exit on error

echo "🔧 Hail-Mary Database Migration"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the API directory"
    echo "Please cd to packages/api first"
    exit 1
fi

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set, using default"
    echo "   postgres://postgres@hailmary-postgres:5432/hailmary"
else
    echo "✅ Using DATABASE_URL from environment"
fi

echo ""
echo "Running migrations..."
npm run db:migrate

echo ""
echo "✅ Migration complete!"
echo ""
echo "Your app should now work without errors."
