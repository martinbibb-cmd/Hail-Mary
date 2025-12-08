#!/bin/bash
# PostgreSQL Initialization Script for Hail-Mary
# This script runs automatically on first container startup
#
# It ensures:
# - Database is created
# - Extensions are enabled
# - Initial schema is ready

set -e

echo "🚀 Initializing Hail-Mary database..."

# The POSTGRES_DB env var from docker-compose ensures the database is created
# We just need to enable any required extensions

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable required PostgreSQL extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";

    -- Create a function for updating updated_at timestamps
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    \$\$ language 'plpgsql';

    -- Log successful initialization
    SELECT 'Database initialized successfully!' as status;
EOSQL

echo "✅ Database initialization complete!"
