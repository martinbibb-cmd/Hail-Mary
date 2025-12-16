/**
 * NAS Management Routes for Hail-Mary
 *
 * Public health check endpoints for NAS deployments.
 * These endpoints provide status information without requiring authentication
 * to support monitoring and health checks from load balancers or orchestrators.
 * 
 * For admin-only operations (updates, migrations), see /api/admin/nas/* routes.
 */

import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { db } from '../db/drizzle-client';

const execAsync = promisify(exec);

const router = Router();

/**
 * GET /api/nas/status
 * Get current NAS deployment status (public health check)
 * Similar to /api/admin/nas/status but without admin auth requirement
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    // Check database health with latency measurement
    let dbHealth = { ok: false, latencyMs: 0 };
    try {
      const startTime = Date.now();
      await db.execute('SELECT 1');
      const latencyMs = Date.now() - startTime;
      dbHealth = { ok: true, latencyMs };
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Get app version from package.json or environment
    const appVersion = process.env.npm_package_version || '0.2.0';
    
    // Get git commit if available
    let gitCommit = null;
    try {
      const { stdout } = await execAsync('git rev-parse --short HEAD 2>/dev/null || echo ""');
      gitCommit = stdout.trim() || null;
    } catch {
      // Git not available
    }

    // Check if running in a Docker container
    let isDocker = false;
    try {
      await fs.access('/.dockerenv');
      isDocker = true;
    } catch {
      isDocker = false;
    }

    // Check migration status (optional)
    let migrationsOk = false;
    try {
      await db.execute("SELECT 1 FROM information_schema.tables WHERE table_name = '__drizzle_migrations' LIMIT 1");
      migrationsOk = true;
    } catch {
      // Migrations table doesn't exist or query failed
    }

    return res.json({
      success: true,
      data: {
        db: dbHealth,
        app: {
          version: appVersion,
          commit: gitCommit,
        },
        migrations: {
          ok: migrationsOk,
        },
        isDocker,
        nasAuthMode: process.env.NAS_AUTH_MODE === 'true',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting NAS status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get NAS status',
    });
  }
});

export default router;
