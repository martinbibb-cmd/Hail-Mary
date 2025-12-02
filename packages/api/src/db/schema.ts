/**
 * Database Schema for Hail-Mary Quote Tool
 * 
 * Legacy SQLite schema using better-sqlite3 - DEVELOPMENT ONLY.
 * In production (when DATABASE_URL is set), Postgres is used via Drizzle ORM.
 * 
 * Note: better-sqlite3 requires native bindings that may not be available in
 * all environments (e.g., Docker containers). In production, we skip SQLite
 * initialization entirely since Postgres is the primary database.
 */

import path from 'path';

// Only import better-sqlite3 if explicitly enabled for dev
// This prevents crashes in production where the native module isn't built
let Database: typeof import('better-sqlite3') | null = null;
const USE_SQLITE_DEV = process.env.USE_SQLITE_DEV === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const HAS_POSTGRES = !!process.env.DATABASE_URL;

// Only load better-sqlite3 in development mode when explicitly enabled
if (USE_SQLITE_DEV && !IS_PRODUCTION) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Database = require('better-sqlite3');
  } catch (error) {
    console.warn('better-sqlite3 native module not available. SQLite features disabled.');
    console.warn('This is expected in production Docker containers. Using Postgres via DATABASE_URL.');
    Database = null;
  }
}

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/hailmary.db');

export function getDatabase(): import('better-sqlite3').Database {
  if (!Database) {
    throw new Error(
      'SQLite is not available. In production, use the Drizzle ORM with DATABASE_URL (Postgres). ' +
      'To use SQLite in development, set USE_SQLITE_DEV=true.'
    );
  }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function initializeDatabase(): void {
  // Skip SQLite initialization in production or when Postgres is configured
  if (IS_PRODUCTION || HAS_POSTGRES) {
    console.log('Skipping SQLite initialization - using PostgreSQL via DATABASE_URL');
    return;
  }
  
  if (!USE_SQLITE_DEV) {
    console.log('SQLite disabled. Set USE_SQLITE_DEV=true to enable local SQLite database.');
    return;
  }
  
  if (!Database) {
    console.warn('SQLite initialization skipped - better-sqlite3 module not available');
    return;
  }

  const db = getDatabase();

  // Customers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      address_city TEXT,
      address_postcode TEXT,
      address_country TEXT DEFAULT 'UK',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Leads table
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      description TEXT,
      property_type TEXT,
      estimated_value REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      manufacturer TEXT,
      model TEXT,
      sku TEXT,
      price REAL NOT NULL,
      cost_price REAL,
      specifications TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Quotes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      quote_number TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      title TEXT NOT NULL,
      description TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      vat_rate REAL NOT NULL DEFAULT 20,
      vat_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      valid_until TEXT,
      notes TEXT,
      terms TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Quote lines table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quote_lines (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0,
      line_total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Appointments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      quote_id TEXT REFERENCES quotes(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      scheduled_at TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 60,
      address_line1 TEXT,
      address_line2 TEXT,
      address_city TEXT,
      address_postcode TEXT,
      address_country TEXT DEFAULT 'UK',
      notes TEXT,
      assigned_to TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Surveys table
  db.exec(`
    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      property_type TEXT,
      number_of_bedrooms INTEGER,
      heating_type TEXT,
      current_boiler TEXT,
      pipe_work TEXT,
      gas_meter_location TEXT,
      access_notes TEXT,
      photos TEXT,
      measurements TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      quote_id TEXT REFERENCES quotes(id) ON DELETE SET NULL,
      mime_type TEXT,
      size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
    CREATE INDEX IF NOT EXISTS idx_quote_lines_quote_id ON quote_lines(quote_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_surveys_customer_id ON surveys(customer_id);
    CREATE INDEX IF NOT EXISTS idx_documents_customer_id ON documents(customer_id);
    CREATE INDEX IF NOT EXISTS idx_documents_quote_id ON documents(quote_id);
  `);

  db.close();
  console.log('Database initialized successfully');
}
