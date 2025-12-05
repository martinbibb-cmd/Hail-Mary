#!/bin/sh
# Docker entrypoint script for Hail-Mary API
# This script validates configuration, runs database migrations and seeds, then starts the API

# Don't use set -e globally - we want to handle errors gracefully
# and continue with startup even if migration/seed has issues

# Helper command for generating JWT secret
JWT_GEN_CMD='node -e "console.log(require('\''crypto'\'').randomBytes(32).toString('\''hex'\''))"'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting Hail-Mary API..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ================================
# Step 1: Validate Environment
# ================================
echo "📋 Validating environment configuration..."

# Check JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔴 FATAL: JWT_SECRET is not set!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "JWT_SECRET is required for authentication security."
  echo ""
  echo "Generate a secure secret with:"
  echo "  $JWT_GEN_CMD"
  echo ""
  echo "Then set it in your environment:"
  echo "  JWT_SECRET=your-generated-secret-here"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

if [ "$JWT_SECRET" = "development-secret-change-in-production" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔴 FATAL: JWT_SECRET is using the unsafe default value!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "The default value 'development-secret-change-in-production'"
  echo "is NOT secure for production use."
  echo ""
  echo "Generate a new secret with:"
  echo "  $JWT_GEN_CMD"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

echo "   ✅ JWT_SECRET is configured"

# Log configuration status
echo ""
echo "📋 Configuration Status:"
echo "   • DATABASE_URL: ${DATABASE_URL:-postgres://postgres@hailmary-postgres:5432/hailmary (default)}"
echo "   • PORT: ${PORT:-3001 (default)}"
echo "   • NODE_ENV: ${NODE_ENV:-development (default)}"
echo "   • GOOGLE_AUTH_ENABLED: ${GOOGLE_AUTH_ENABLED:-false (default)}"
echo "   • NAS_AUTH_MODE: ${NAS_AUTH_MODE:-false (default)}"

# Warn if Google Auth is enabled but credentials are missing
if [ "$GOOGLE_AUTH_ENABLED" = "true" ]; then
  if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo ""
    echo "⚠️  WARNING: GOOGLE_AUTH_ENABLED=true but credentials are missing!"
    echo "   Google OAuth will be disabled until GOOGLE_CLIENT_ID and"
    echo "   GOOGLE_CLIENT_SECRET are provided."
  else
    echo "   • Google OAuth: Enabled with credentials"
  fi
fi

echo ""

# ================================
# Step 2: Database Connection
# ================================
# Use DATABASE_URL if set, otherwise use the same default as drizzle-client.ts
DB_URL="${DATABASE_URL:-postgres://postgres@hailmary-postgres:5432/hailmary}"

echo "⏳ Checking database connection..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if node -e "
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: '$DB_URL' });
    pool.query('SELECT 1').then(() => { pool.end(); process.exit(0); }).catch(() => { pool.end(); process.exit(1); });
  " 2>/dev/null; then
    echo "   ✅ Database connection successful"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   Waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔴 FATAL: Failed to connect to database after $MAX_RETRIES attempts"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Check that:"
  echo "  1. PostgreSQL container is running"
  echo "  2. DATABASE_URL is correct: $DB_URL"
  echo "  3. Network connectivity between containers"
  echo ""
  exit 1
fi

# ================================
# Step 3: Database Migrations
# ================================
echo ""
echo "📦 Running database migrations..."
if npm run db:push -w packages/api 2>&1; then
  echo "   ✅ Database migrations completed"
else
  echo "   ⚠️  Migration returned non-zero (schema may already be up to date)"
fi

# ================================
# Step 4: Database Seeding
# ================================
echo ""
echo "🌱 Running database seed..."
if npm run db:seed -w packages/api 2>&1; then
  echo "   ✅ Database seed completed"
else
  echo "   ⚠️  Seed returned non-zero (data may already be seeded)"
fi

# ================================
# Step 5: Start Application
# ================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting API server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
exec npm run start -w packages/api
