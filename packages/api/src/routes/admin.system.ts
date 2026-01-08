/**
 * Admin System Routes for Hail-Mary
 * 
 * Handles system/NAS management endpoints (requires admin role):
 * - GET /api/admin/system/status - Get system status (DB, migrations, config)
 * - POST /api/admin/system/migrate - Run database migrations
 */

import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { db } from '../db/drizzle-client';
import { API_VERSION } from '../index';

const execAsync = promisify(exec);

// System configuration
const API_DIR = process.env.API_DIR || '/app';

const router = Router();

/**
 * GET /api/admin/system/status
 * Get comprehensive system status including DB, migrations, and config
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    // Get app version info
    const appVersion = process.env.npm_package_version || API_VERSION;
    const nodeVersion = process.version;
    const uptimeSeconds = Math.floor(process.uptime());

    // Check database health with latency measurement
    let dbOk = false;
    let dbLatencyMs = 0;
    let dbUrlMasked = 'not configured';

    try {
      const startTime = Date.now();
      await db.execute('SELECT 1');
      dbLatencyMs = Date.now() - startTime;
      dbOk = true;

      // Mask database URL for security
      const dbUrl = process.env.DATABASE_URL || '';
      if (dbUrl) {
        try {
          const url = new URL(dbUrl);
          // Mask password in URL
          if (url.password) {
            url.password = '***';
          }
          dbUrlMasked = url.toString();
        } catch {
          dbUrlMasked = 'invalid URL format';
        }
      }
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Check migration status
    let migrationsOk = false;
    let lastRunAt = null;
    let migrationNotes = null;

    try {
      // Check if migrations table exists using literal SQL (safe - no user input)
      // Note: This queries the system information_schema table with a literal table name
      const result = await db.execute(
        "SELECT 1 FROM information_schema.tables WHERE table_name = '__drizzle_migrations' LIMIT 1"
      );
      migrationsOk = true;

      // Try to get last migration timestamp if table exists (safe - literal table name)
      try {
        const migrationData = await db.execute(
          "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1"
        );
        if (migrationData.rows && migrationData.rows.length > 0) {
          lastRunAt = migrationData.rows[0].created_at;
        }
      } catch {
        // Ignore errors getting migration timestamp
      }
    } catch {
      migrationNotes = 'Migrations table not found - run migrations to initialize';
    }

    // Get config status using new provenance system
    let configStatus = {
      schemaLoadedFrom: 'unknown',
      schemaUsedFallback: false,
      checklistConfigLoadedFrom: 'unknown',
      checklistConfigUsedFallback: false,
    };

    try {
      const { resolveSchemaConfig, resolveChecklistConfig } = await import('../utils/configLoader');
      const schemaProvenance = resolveSchemaConfig();
      const checklistProvenance = resolveChecklistConfig();
      
      configStatus = {
        schemaLoadedFrom: schemaProvenance.source === 'builtin' ? 'default (built-in)' : (schemaProvenance.reason || 'custom'),
        schemaUsedFallback: schemaProvenance.used === 'default',
        checklistConfigLoadedFrom: checklistProvenance.source === 'builtin' ? 'default (built-in)' : (checklistProvenance.reason || 'custom'),
        checklistConfigUsedFallback: checklistProvenance.used === 'default',
      };
    } catch (error) {
      console.error('Failed to get config status:', error);
    }

    // Get degraded subsystems information
    const { appStatus } = await import('../core/appStatus');
    const degradedSubsystems = appStatus.getAllDegraded();
    const degradedNotes = appStatus.getNotes();

    // Collect any warnings (excluding degraded subsystems as they're reported separately)
    // Note: Database and migration issues are tracked via degraded subsystems (appStatus),
    // so only config fallback warnings are included here
    const warnings: string[] = [];
    if (!dbOk && !appStatus.isDegraded('database')) {
      // Only add warning if not already tracked as degraded
      warnings.push('Database connection failed');
    }
    if (!migrationsOk) {
      warnings.push('Database migrations not initialized');
    }
    if (configStatus.schemaUsedFallback) {
      warnings.push('Using default Atlas schema configuration');
    }
    if (configStatus.checklistConfigUsedFallback) {
      warnings.push('Using default checklist configuration');
    }

    return res.json({
      success: true,
      data: {
        api: {
          version: appVersion,
          nodeVersion,
          uptimeSeconds,
        },
        db: {
          ok: dbOk,
          urlMasked: dbUrlMasked,
          latencyMs: dbOk ? dbLatencyMs : undefined,
        },
        migrations: {
          ok: migrationsOk,
          lastRunAt,
          notes: migrationNotes,
        },
        config: configStatus,
        degraded: appStatus.degraded,
        degradedSubsystems,
        degradedNotes,
        warnings,
      },
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get system status',
    });
  }
});

/**
 * POST /api/admin/system/migrate
 * Run database migrations (admin only)
 */
router.post('/migrate', async (_req: Request, res: Response) => {
  try {
    // Run migrations using npm script
    const { stdout, stderr } = await execAsync(`cd "${API_DIR}" && npm run migrate 2>&1`, {
      timeout: 120000, // 2 minute timeout
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });

    return res.json({
      success: true,
      message: 'Database migrations completed successfully',
      output: stdout + stderr,
    });
  } catch (error: any) {
    console.error('Error running migrations:', error);
    
    // Return error but don't crash the server
    return res.status(500).json({
      success: false,
      error: 'Failed to run database migrations',
      details: error.message,
      output: error.stdout || error.stderr,
    });
  }
});

export default router;
