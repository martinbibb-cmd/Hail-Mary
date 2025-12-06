/**
 * Database migration script
 * 
 * PostgreSQL is the only database used. Migrations are handled by Drizzle Kit.
 * Run `npm run db:migrate` to apply migrations using Drizzle Kit.
 * 
 * Alternatively, this script can be run directly with `npm run migrate`
 * which uses Drizzle's programmatic migration API.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as path from "path";

const DEFAULT_DATABASE_URL = "postgres://postgres@hailmary-postgres:5432/hailmary";

async function runMigrations() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 Running database migrations...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const connectionString = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  console.log('   Database:', connectionString.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
  
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  
  try {
    // Use path.resolve to get absolute path from packages/api directory
    const migrationsFolder = path.resolve(__dirname, '../../drizzle');
    console.log('   Migrations folder:', migrationsFolder);
    
    await migrate(db, { migrationsFolder });
    
    console.log('');
    console.log('   ✅ Migrations completed successfully');
  } catch (error) {
    console.error('');
    console.error('   ❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

runMigrations();
