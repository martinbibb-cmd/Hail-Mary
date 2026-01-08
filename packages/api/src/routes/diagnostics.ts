/**
 * Diagnostics Routes for Hail-Mary
 *
 * Provides read-only health and diagnostic endpoints for admins.
 * Helps distinguish "UI hiding features" vs "backend has no data/tables".
 * 
 * Endpoints:
 * - GET /api/diagnostics/health - Aggregate health status
 * - GET /api/diagnostics/schema - Database schema information
 * - GET /api/diagnostics/stats - Entity counts
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { db } from '../db/drizzle-client';
import { 
  users, 
  accounts, 
  leads, 
  addresses, 
  addressAppointments,
  assets,
  visitEvents,
  photos,
  scans,
  files,
  spineProperties,
  spineVisits,
  spineTimelineEvents,
  presentationDrafts,
  bugReports
} from '../db/drizzle-schema';
import { sql } from 'drizzle-orm';
import { resolveSchemaConfig, resolveChecklistConfig } from '../utils/configLoader';

const router = Router();

// All diagnostics routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/diagnostics/health
 * Returns aggregate health status of API, database, and services
 * Always returns 200 OK for graceful degradation
 */
router.get('/health', async (_req: Request, res: Response) => {
  const health = {
    apiOk: true,
    dbOk: false,
    assistantReachable: null as boolean | null,
    schemaVersion: null as string | null,
    schemaAligned: false,
    missingTables: [] as string[],
    missingColumns: {} as Record<string, string[]>,
    pendingMigrations: [] as string[],
    buildSha: process.env.BUILD_SHA || 'unknown',
    buildTime: process.env.BUILD_TIME || 'unknown',
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    config: {
      schema: resolveSchemaConfig(),
      checklist: resolveChecklistConfig(),
    },
  };

  const errors: Array<{ component: string; message: string }> = [];

  // Check database connectivity
  try {
    await db.select().from(users).limit(1);
    health.dbOk = true;
  } catch (err) {
    health.dbOk = false;
    errors.push({
      component: 'database',
      message: 'Database connection failed',
    });
    console.error('DB health check failed in diagnostics:', err);
  }

  // Check database schema version (if migrations table exists)
  if (health.dbOk) {
    try {
      const schemaResult = await db.execute(
        sql`SELECT version FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 1`
      );
      if (schemaResult.rows && schemaResult.rows.length > 0) {
        health.schemaVersion = String(schemaResult.rows[0].version || 'unknown');
      } else {
        health.schemaVersion = 'no_migrations';
      }
    } catch (err) {
      health.schemaVersion = null;
      errors.push({
        component: 'schema',
        message: 'Unable to read schema version',
      });
    }

    // Check schema alignment
    try {
      const tablesResult = await db.execute(
        sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
      );
      const existingTables = tablesResult.rows.map(row => row.table_name as string);

      // Expected core tables
      const expectedTables = [
        'accounts',
        'users',
        'leads',
        'addresses',
        'address_appointments',
        'assets',
        'visit_events',
        'photos',
        'scans',
        'files',
        'spine_properties',
        'spine_visits',
        'spine_timeline_events',
        'presentation_drafts',
        'bug_reports',
      ];

      health.missingTables = expectedTables.filter(t => !existingTables.includes(t));
      health.schemaAligned = health.missingTables.length === 0;

      // Check for missing columns in existing tables
      const missingColumns: Record<string, string[]> = {};
      
      // Check key columns for critical tables
      const criticalTableColumns: Record<string, string[]> = {
        'users': ['id', 'email', 'name', 'role', 'created_at'],
        'leads': ['id', 'account_id', 'first_name', 'last_name', 'created_at'],
        'addresses': ['id', 'lead_id', 'postcode', 'created_at'],
      };

      for (const [tableName, expectedCols] of Object.entries(criticalTableColumns)) {
        if (existingTables.includes(tableName)) {
          try {
            const columnsResult = await db.execute(
              sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${tableName}`
            );
            const existingCols = columnsResult.rows.map(row => row.column_name as string);
            const missing = expectedCols.filter(col => !existingCols.includes(col));
            if (missing.length > 0) {
              missingColumns[tableName] = missing;
              health.schemaAligned = false;
            }
          } catch (err) {
            // Silently skip column check if it fails
          }
        }
      }

      health.missingColumns = missingColumns;

      if (!health.schemaAligned) {
        errors.push({
          component: 'schema',
          message: `Schema not aligned: ${health.missingTables.length} missing tables, ${Object.keys(missingColumns).length} tables with missing columns`,
        });
      }

      // Check for pending migrations
      try {
        const allMigrationsResult = await db.execute(
          sql`SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id ASC`
        );
        const appliedMigrations = allMigrationsResult.rows.map(row => row.hash as string);
        // Note: We can't easily determine pending migrations without filesystem access
        // This is a placeholder for future enhancement
        health.pendingMigrations = [];
      } catch (err) {
        // Skip if migrations table doesn't exist
      }
    } catch (err) {
      errors.push({
        component: 'schema',
        message: 'Unable to check schema alignment',
      });
      console.error('Schema alignment check failed:', err);
    }
  } else {
    errors.push({
      component: 'schema',
      message: 'Cannot check schema without database connection',
    });
  }

  // Check assistant service reachability
  const assistantUrl = process.env.ASSISTANT_URL || 'http://localhost:3002';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`${assistantUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    health.assistantReachable = response.ok;
    
    if (!response.ok) {
      errors.push({
        component: 'assistant',
        message: 'Assistant service returned non-OK status',
      });
    }
  } catch (err) {
    health.assistantReachable = false;
    errors.push({
      component: 'assistant',
      message: 'Assistant service unreachable',
    });
  }

  // Always return 200 OK
  return res.status(200).json({
    success: true,
    data: health,
    errors: errors.length > 0 ? errors : undefined,
  });
});

/**
 * GET /api/diagnostics/schema
 * Returns database schema information: tables and migration status
 * Degrades gracefully if tables are missing
 */
router.get('/schema', async (_req: Request, res: Response) => {
  const warnings: string[] = [];
  let tables: string[] = [];
  let migrations: any[] = [];
  let schemaAligned = false;
  let missingTables: string[] = [];
  let missingColumns: Record<string, string[]> = {};

  // Get config provenance
  const config = {
    schema: resolveSchemaConfig(),
    checklist: resolveChecklistConfig(),
  };

  // Get list of tables from information_schema
  try {
    const tablesResult = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    tables = tablesResult.rows.map(row => row.table_name as string);
  } catch (error) {
    console.error('Error fetching tables:', error);
    warnings.push('Unable to fetch table list from database');
    tables = [];
  }

  // Expected core tables
  const expectedTables = [
    'accounts',
    'users',
    'leads',
    'addresses',
    'address_appointments',
    'assets',
    'visit_events',
    'photos',
    'scans',
    'files',
    'spine_properties',
    'spine_visits',
    'spine_timeline_events',
    'presentation_drafts',
    'bug_reports',
  ];

  missingTables = expectedTables.filter(t => !tables.includes(t));

  if (missingTables.length > 0) {
    warnings.push(`Missing ${missingTables.length} expected tables: ${missingTables.join(', ')}`);
  }

  // Check for missing columns in existing tables
  const criticalTableColumns: Record<string, string[]> = {
    'users': ['id', 'email', 'name', 'role', 'created_at'],
    'leads': ['id', 'account_id', 'first_name', 'last_name', 'created_at'],
    'addresses': ['id', 'lead_id', 'postcode', 'created_at'],
  };

  for (const [tableName, expectedCols] of Object.entries(criticalTableColumns)) {
    if (tables.includes(tableName)) {
      try {
        const columnsResult = await db.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${tableName}`
        );
        const existingCols = columnsResult.rows.map(row => row.column_name as string);
        const missing = expectedCols.filter(col => !existingCols.includes(col));
        if (missing.length > 0) {
          missingColumns[tableName] = missing;
        }
      } catch (err) {
        // Silently skip column check if it fails
      }
    }
  }

  schemaAligned = missingTables.length === 0 && Object.keys(missingColumns).length === 0;

  // Get migration information
  try {
    const migrationsResult = await db.execute(
      sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 10`
    );
    migrations = migrationsResult.rows.map(row => ({
      id: row.id,
      hash: row.hash,
      createdAt: row.created_at,
    }));
  } catch (err) {
    // Migrations table doesn't exist or has different structure
    warnings.push('Unable to fetch migration history');
    migrations = [];
  }

  return res.status(200).json({
    success: true,
    data: {
      tables,
      expectedTables,
      missingTables,
      tableCount: tables.length,
      migrations: migrations.length > 0 ? migrations : null,
      schemaAligned,
      missingColumns,
      config,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  });
});

/**
 * GET /api/diagnostics/stats
 * Returns counts for key entities in the database
 * Degrades gracefully if tables are missing
 */
router.get('/stats', async (_req: Request, res: Response) => {
  const warnings: string[] = [];
  const counts: Record<string, number> = {};
  const recentActivity: Record<string, any[]> = {
    recentLeads: [],
    recentAddresses: [],
    recentVisits: [],
  };

  // Helper to safely count entities
  const safeCount = async (tableName: string, table: any): Promise<number> => {
    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(table);
      return Number(result[0]?.count || 0);
    } catch (error) {
      warnings.push(`Unable to count ${tableName}`);
      return 0;
    }
  };

  // Count entities - handle missing tables gracefully
  try {
    const countResults = await Promise.allSettled([
      safeCount('users', users),
      safeCount('accounts', accounts),
      safeCount('leads', leads),
      safeCount('addresses', addresses),
      safeCount('addressAppointments', addressAppointments),
      safeCount('assets', assets),
      safeCount('visitEvents', visitEvents),
      safeCount('photos', photos),
      safeCount('scans', scans),
      safeCount('files', files),
      safeCount('spineProperties', spineProperties),
      safeCount('spineVisits', spineVisits),
      safeCount('spineTimelineEvents', spineTimelineEvents),
      safeCount('presentationDrafts', presentationDrafts),
      safeCount('bugReports', bugReports),
    ]);

    counts.users = countResults[0].status === 'fulfilled' ? countResults[0].value : 0;
    counts.accounts = countResults[1].status === 'fulfilled' ? countResults[1].value : 0;
    counts.leads = countResults[2].status === 'fulfilled' ? countResults[2].value : 0;
    counts.addresses = countResults[3].status === 'fulfilled' ? countResults[3].value : 0;
    counts.addressAppointments = countResults[4].status === 'fulfilled' ? countResults[4].value : 0;
    counts.assets = countResults[5].status === 'fulfilled' ? countResults[5].value : 0;
    counts.visitEvents = countResults[6].status === 'fulfilled' ? countResults[6].value : 0;
    counts.photos = countResults[7].status === 'fulfilled' ? countResults[7].value : 0;
    counts.scans = countResults[8].status === 'fulfilled' ? countResults[8].value : 0;
    counts.files = countResults[9].status === 'fulfilled' ? countResults[9].value : 0;
    counts.spineProperties = countResults[10].status === 'fulfilled' ? countResults[10].value : 0;
    counts.spineVisits = countResults[11].status === 'fulfilled' ? countResults[11].value : 0;
    counts.spineTimelineEvents = countResults[12].status === 'fulfilled' ? countResults[12].value : 0;
    counts.presentationDrafts = countResults[13].status === 'fulfilled' ? countResults[13].value : 0;
    counts.bugReports = countResults[14].status === 'fulfilled' ? countResults[14].value : 0;
  } catch (error) {
    console.error('Error counting entities:', error);
    warnings.push('Unexpected error while counting entities');
  }

  // Get recent activity (last 10 created records) - efficient queries
  try {
    const recentLeadsResult = await db
      .select({
        id: leads.id,
        name: sql<string>`COALESCE(${leads.firstName}, '') || ' ' || COALESCE(${leads.lastName}, '')`,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .orderBy(sql`${leads.createdAt} DESC`)
      .limit(10);
    recentActivity.recentLeads = recentLeadsResult;
  } catch (error) {
    warnings.push('Unable to fetch recent leads');
  }

  try {
    const recentAddressesResult = await db
      .select({
        id: addresses.id,
        postcode: addresses.postcode,
        createdAt: addresses.createdAt,
      })
      .from(addresses)
      .orderBy(sql`${addresses.createdAt} DESC`)
      .limit(10);
    recentActivity.recentAddresses = recentAddressesResult;
  } catch (error) {
    warnings.push('Unable to fetch recent addresses');
  }

  try {
    const recentVisitsResult = await db
      .select({
        id: spineVisits.id,
        propertyId: spineVisits.propertyId,
        createdAt: spineVisits.createdAt,
      })
      .from(spineVisits)
      .orderBy(sql`${spineVisits.createdAt} DESC`)
      .limit(10);
    recentActivity.recentVisits = recentVisitsResult;
  } catch (error) {
    warnings.push('Unable to fetch recent visits');
  }

  return res.status(200).json({
    success: true,
    data: {
      counts,
      recentActivity,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  });
});

export default router;
