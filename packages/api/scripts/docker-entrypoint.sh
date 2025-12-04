#!/bin/sh
# Docker entrypoint script for Hail-Mary API
# This script runs database migrations and seeds the initial admin user on startup

set -e

echo "🚀 Starting Hail-Mary API..."

# Use DATABASE_URL if set, otherwise use the same default as drizzle-client.ts
DB_URL="${DATABASE_URL:-postgres://postgres@hailmary-postgres:5432/hailmary}"

# Wait for PostgreSQL to be ready (healthcheck should handle this, but double-check)
echo "⏳ Checking database connection..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if node -e "
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: '$DB_URL' });
    pool.query('SELECT 1').then(() => { pool.end(); process.exit(0); }).catch(() => { pool.end(); process.exit(1); });
  " 2>/dev/null; then
    echo "✅ Database connection successful"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   Waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Failed to connect to database after $MAX_RETRIES attempts"
  exit 1
fi

# Run database migrations (push schema to PostgreSQL)
echo "📦 Running database migrations..."
if npm run db:push -w packages/api 2>&1; then
  echo "✅ Database migrations completed successfully"
else
  echo "⚠️  Database migration returned non-zero (schema may already be up to date)"
fi

# Seed initial admin user if configured
echo "🌱 Running database seed..."
if npm run db:seed -w packages/api 2>&1; then
  echo "✅ Database seed completed successfully"
else
  echo "⚠️  Database seed returned non-zero (data may already be seeded)"
fi

# Start the application
echo "🚀 Starting API server..."
exec npm run start -w packages/api
