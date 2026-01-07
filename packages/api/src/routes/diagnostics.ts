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

const router = Router();

// All diagnostics routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/diagnostics/health
 * Returns aggregate health status of API, database, and services
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = {
      apiOk: true,
      dbOk: false,
      assistantReachable: null as boolean | null,
      schemaVersion: 'unknown',
      buildSha: process.env.BUILD_SHA || 'unknown',
      buildTime: process.env.BUILD_TIME || 'unknown',
      serverTime: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    };

    // Check database connectivity
    try {
      await db.select().from(users).limit(1);
      health.dbOk = true;
    } catch (err) {
      health.dbOk = false;
      console.error('DB health check failed in diagnostics:', err);
    }

    // Check database schema version (if migrations table exists)
    try {
      const schemaResult = await db.execute(
        sql`SELECT version FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 1`
      );
      if (schemaResult.rows && schemaResult.rows.length > 0) {
        health.schemaVersion = String(schemaResult.rows[0].version || 'unknown');
      }
    } catch (err) {
      // Migrations table may not exist or may have different structure
      health.schemaVersion = 'no_migrations_table';
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
    } catch (err) {
      health.assistantReachable = false;
    }

    return res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Error in diagnostics health check:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check health status',
    });
  }
});

/**
 * GET /api/diagnostics/schema
 * Returns database schema information: tables and migration status
 */
router.get('/schema', async (_req: Request, res: Response) => {
  try {
    // Get list of tables from information_schema
    const tablesResult = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );

    const tables = tablesResult.rows.map(row => row.table_name as string);

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

    const missingTables = expectedTables.filter(t => !tables.includes(t));

    // Get migration information
    let migrations: any[] = [];
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
      migrations = [];
    }

    return res.json({
      success: true,
      data: {
        tables,
        expectedTables,
        missingTables,
        tableCount: tables.length,
        migrations: migrations.length > 0 ? migrations : null,
      },
    });
  } catch (error) {
    console.error('Error in diagnostics schema check:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check schema',
    });
  }
});

/**
 * GET /api/diagnostics/stats
 * Returns counts for key entities in the database
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // Count entities using Promise.all for parallel execution
    const [
      usersCount,
      accountsCount,
      leadsCount,
      addressesCount,
      addressAppointmentsCount,
      assetsCount,
      visitEventsCount,
      photosCount,
      scansCount,
      filesCount,
      spinePropertiesCount,
      spineVisitsCount,
      spineTimelineEventsCount,
      presentationDraftsCount,
      bugReportsCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(accounts).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(leads).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(addresses).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(addressAppointments).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(assets).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(visitEvents).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(photos).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(scans).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(files).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(spineProperties).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(spineVisits).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(spineTimelineEvents).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(presentationDrafts).then(r => Number(r[0]?.count || 0)),
      db.select({ count: sql<number>`count(*)` }).from(bugReports).then(r => Number(r[0]?.count || 0)),
    ]);

    // Get recent activity (last 10 created records)
    const recentLeads = await db
      .select({
        id: leads.id,
        name: sql<string>`concat(${leads.firstName}, ' ', ${leads.lastName})`,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .orderBy(sql`${leads.createdAt} DESC`)
      .limit(10);

    const recentAddresses = await db
      .select({
        id: addresses.id,
        postcode: addresses.postcode,
        createdAt: addresses.createdAt,
      })
      .from(addresses)
      .orderBy(sql`${addresses.createdAt} DESC`)
      .limit(10);

    const recentVisits = await db
      .select({
        id: spineVisits.id,
        propertyId: spineVisits.propertyId,
        createdAt: spineVisits.createdAt,
      })
      .from(spineVisits)
      .orderBy(sql`${spineVisits.createdAt} DESC`)
      .limit(10);

    return res.json({
      success: true,
      data: {
        counts: {
          users: usersCount,
          accounts: accountsCount,
          leads: leadsCount,
          addresses: addressesCount,
          addressAppointments: addressAppointmentsCount,
          assets: assetsCount,
          visitEvents: visitEventsCount,
          photos: photosCount,
          scans: scansCount,
          files: filesCount,
          spineProperties: spinePropertiesCount,
          spineVisits: spineVisitsCount,
          spineTimelineEvents: spineTimelineEventsCount,
          presentationDrafts: presentationDraftsCount,
          bugReports: bugReportsCount,
        },
        recentActivity: {
          recentLeads,
          recentAddresses,
          recentVisits,
        },
      },
    });
  } catch (error) {
    console.error('Error in diagnostics stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
    });
  }
});

export default router;
