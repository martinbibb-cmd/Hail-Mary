/**
 * Admin System Routes for Hail-Mary
 *
 * Handles system/NAS management endpoints (requires admin role):
 * - GET /api/admin/system/status - Get system status (DB, migrations, config)
 * - POST /api/admin/system/migrate - Run database migrations
 * - GET /api/admin/system/update/stream - Stream system update logs via SSE
 * - GET /api/admin/system/update - Alias for /update/stream
 * - GET /api/admin/system/version - Check for available updates
 * - GET /api/admin/system/health - Check service health after update
 */

import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import http from 'http';
import { db } from '../db/drizzle-client';
import { API_VERSION } from '../index';

const execAsync = promisify(exec);

// System configuration
const API_DIR = process.env.API_DIR || '/app';
const ADMIN_AGENT_URL = process.env.ADMIN_AGENT_URL || 'http://hailmary-admin-agent:4010';
const ADMIN_AGENT_TOKEN = process.env.ADMIN_AGENT_TOKEN || '';

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

/**
 * Helper function to implement exponential backoff retry
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper function to proxy request to admin agent with retry logic
 */
async function proxyToAdminAgent(
  path: string,
  res: Response,
  isSSE: boolean = false
): Promise<void> {
  if (!ADMIN_AGENT_TOKEN) {
    res.status(503).json({
      success: false,
      error: 'Admin agent not configured',
    });
    return;
  }

  const MAX_RETRIES = 5;
  const INITIAL_DELAY = 200; // ms
  const MAX_DELAY = 2000; // ms

  let lastError: Error | null = null;

  // Retry loop - only retries connection failures, not streaming errors
  // Once SSE stream starts, no retries occur (connection established successfully)
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const url = new URL(path, ADMIN_AGENT_URL);

      await new Promise<void>((resolve, reject) => {
        const request = http.get(
          url.toString(),
          {
            headers: {
              'X-Admin-Token': ADMIN_AGENT_TOKEN,
            },
          },
          (proxyRes) => {
            if (isSSE) {
              // For SSE, proxy all headers and stream the response
              res.writeHead(proxyRes.statusCode || 200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no', // Disable nginx buffering
              });

              proxyRes.pipe(res);

              proxyRes.on('end', () => {
                resolve();
              });

              proxyRes.on('error', (error) => {
                console.error('Admin agent SSE error:', error);
                reject(error);
              });
            } else {
              // For JSON, buffer the response
              let data = '';
              proxyRes.on('data', (chunk) => {
                data += chunk;
              });

              proxyRes.on('end', () => {
                res.writeHead(proxyRes.statusCode || 200, {
                  'Content-Type': 'application/json',
                });
                res.end(data);
                resolve();
              });

              proxyRes.on('error', (error) => {
                console.error('Admin agent error:', error);
                reject(error);
              });
            }
          }
        );

        // Set timeout on the request
        request.setTimeout(5000, () => {
          request.destroy();
          reject(new Error('Request timeout'));
        });

        request.on('error', (error) => {
          reject(error);
        });

        request.end();
      });

      // Success - no need to retry
      return;
    } catch (error) {
      lastError = error as Error;
      console.error(
        `Admin agent connection attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
        error
      );

      // Don't retry on the last attempt
      if (attempt < MAX_RETRIES - 1) {
        // Calculate exponential backoff delay with proportional jitter
        const baseDelay = Math.min(INITIAL_DELAY * Math.pow(2, attempt), MAX_DELAY);
        const jitter = Math.random() * baseDelay * 0.1; // 10% jitter
        const delay = baseDelay + jitter;

        console.log(`Retrying in ${Math.round(delay)}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  console.error(
    `Admin agent connection failed after ${MAX_RETRIES} attempts:`,
    lastError
  );
  res.status(503).json({
    success: false,
    error: 'Failed to connect to admin agent - service may be restarting',
    details: lastError?.message,
  });
}

/**
 * GET /api/admin/system/update/stream
 * Proxy SSE stream from admin agent for system updates
 */
router.get('/update/stream', async (_req: Request, res: Response) => {
  try {
    await proxyToAdminAgent('/update/stream', res, true);
  } catch (error) {
    console.error('Error proxying update stream:', error);
    // Error already sent by proxy function
  }
});

/**
 * GET /api/admin/system/update
 * Alias for /update/stream - Proxy SSE stream from admin agent for system updates
 */
router.get('/update', async (_req: Request, res: Response) => {
  try {
    await proxyToAdminAgent('/update', res, true);
  } catch (error) {
    console.error('Error proxying update stream:', error);
    // Error already sent by proxy function
  }
});

/**
 * GET /api/admin/system/version
 * Check for available system updates
 */
router.get('/version', async (_req: Request, res: Response) => {
  try {
    await proxyToAdminAgent('/version', res, false);
  } catch (error) {
    console.error('Error checking version:', error);
    // Error already sent by proxy function
  }
});

/**
 * GET /api/admin/system/health
 * Check service health after update
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await proxyToAdminAgent('/health', res, false);
  } catch (error) {
    console.error('Error checking health:', error);
    // Error already sent by proxy function
  }
});

export default router;
