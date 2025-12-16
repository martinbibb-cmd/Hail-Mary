/**
 * Admin Routes for Hail-Mary
 *
 * Handles administrative endpoints (requires admin role):
 * - GET /api/admin/users - List all users
 * - POST /api/admin/users/:userId/reset-password - Reset a user's password
 * - GET /api/admin/nas/status - Get NAS deployment status
 * - POST /api/admin/nas/check-updates - Check for Docker image updates
 * - POST /api/admin/nas/pull-updates - Pull latest Docker images
 * - POST /api/admin/nas/migrate - Run database migrations
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { listAllUsers, adminResetUserPassword, adminGenerateResetToken, AuthError } from '../services/auth.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { db } from '../db/drizzle-client';

const execAsync = promisify(exec);

// NAS deployment configuration
const DEPLOY_DIR = process.env.DEPLOY_DIR || '/opt/hail-mary';
const API_DIR = process.env.API_DIR || '/app';

const router = Router();

// All admin routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * List all users in the system
 */
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await listAllUsers();
    return res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    console.error('Error listing users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list users',
    });
  }
});

/**
 * POST /api/admin/users/:userId/reset-password
 * Reset a user's password (admin only)
 * Supports two modes:
 * - With newPassword: directly sets password
 * - Without newPassword: generates a one-time reset token/link
 */
router.post('/users/:userId/reset-password', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { newPassword } = req.body;

    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid user ID is required',
      });
    }

    // Mode A: Generate reset token (preferred - safer)
    if (!newPassword) {
      const adminUser = req.user;
      if (!adminUser) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const { token, resetLink } = await adminGenerateResetToken(userId, adminUser.id, baseUrl);

      return res.json({
        success: true,
        message: 'Reset token generated successfully',
        data: {
          resetLink,
          expiresIn: '1 hour',
        },
      });
    }

    // Mode B: Direct password reset (legacy support)
    await adminResetUserPassword(userId, newPassword);

    return res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    console.error('Error resetting password:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password',
    });
  }
});

/**
 * GET /api/admin/nas/status
 * Get current NAS deployment status with health checks
 */
router.get('/nas/status', async (_req: Request, res: Response) => {
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

    // Check if running in a Docker container using Node.js fs methods
    let isDocker = false;
    try {
      await fs.access('/.dockerenv');
      isDocker = true;
    } catch {
      isDocker = false;
    }
    
    // Get docker-compose status if available
    let containerStatus = null;
    if (isDocker) {
      try {
        const prodComposeFile = path.join(DEPLOY_DIR, 'docker-compose.prod.yml');
        const devComposeFile = path.join(DEPLOY_DIR, 'docker-compose.yml');
        
        // Try production compose file first, then dev
        const { stdout } = await execAsync(
          `docker-compose -f ${prodComposeFile} ps --format json 2>/dev/null || docker-compose -f ${devComposeFile} ps --format json 2>/dev/null || echo "[]"`
        );
        containerStatus = stdout.trim();
      } catch (error) {
        console.log('Could not get container status:', error);
      }
    }

    // Check migration status (optional - checks if migrations table exists)
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
        containerStatus,
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

/**
 * POST /api/admin/nas/check-updates
 * Check for available Docker image updates
 */
router.post('/nas/check-updates', async (_req: Request, res: Response) => {
  try {
    // Validate and sanitize paths
    const composeFile = path.join(DEPLOY_DIR, 'docker-compose.prod.yml');
    const scriptPath = path.join(DEPLOY_DIR, 'scripts/nas-deploy.sh');
    
    // Verify deploy directory exists and is within expected path
    if (!path.normalize(scriptPath).startsWith(path.normalize(DEPLOY_DIR))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deployment path configuration',
      });
    }
    
    // Check if the NAS deploy script exists using Node.js fs methods
    try {
      await fs.access(scriptPath, fs.constants.F_OK);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'NAS deployment scripts not found. This may not be a NAS deployment.',
      });
    }

    // Pull images to check for updates (this doesn't restart containers)
    const { stdout, stderr } = await execAsync(
      `cd "${DEPLOY_DIR}" && docker-compose -f "${composeFile}" pull 2>&1`,
      { timeout: 300000 }
    );
    
    // Check if any images were updated
    const hasUpdates = stdout.includes('Downloaded newer image') || stdout.includes('Pulled');
    
    return res.json({
      success: true,
      message: hasUpdates ? 'Updates available' : 'No updates available',
      hasUpdates,
      output: stdout + stderr,
    });
  } catch (error: any) {
    console.error('Error checking for updates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check for updates',
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/nas/pull-updates
 * Pull latest Docker images and restart containers
 */
router.post('/nas/pull-updates', async (_req: Request, res: Response) => {
  try {
    // Validate and sanitize paths
    const scriptPath = path.join(DEPLOY_DIR, 'scripts/nas-deploy.sh');
    
    // Verify script path is within expected directory
    if (!path.normalize(scriptPath).startsWith(path.normalize(DEPLOY_DIR))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deployment path configuration',
      });
    }
    
    // Check if the NAS deploy script exists using Node.js fs methods
    try {
      await fs.access(scriptPath, fs.constants.F_OK | fs.constants.X_OK);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'NAS deployment scripts not found. This may not be a NAS deployment.',
      });
    }

    // Run the NAS deploy script
    const { stdout, stderr } = await execAsync(`bash "${scriptPath}" 2>&1`, {
      timeout: 300000, // 5 minute timeout
      cwd: DEPLOY_DIR,
    });
    
    return res.json({
      success: true,
      message: 'Updates deployed successfully',
      output: stdout + stderr,
    });
  } catch (error: any) {
    console.error('Error deploying updates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to deploy updates',
      details: error.message,
      output: error.stdout || error.stderr,
    });
  }
});

/**
 * POST /api/admin/nas/migrate
 * Run database migrations
 */
router.post('/nas/migrate', async (_req: Request, res: Response) => {
  try {
    // Validate API directory path
    const normalizedApiDir = path.normalize(API_DIR);
    
    // Run migrations using npm script
    const { stdout, stderr } = await execAsync(`cd "${normalizedApiDir}" && npm run migrate 2>&1`, {
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
    return res.status(500).json({
      success: false,
      error: 'Failed to run database migrations',
      details: error.message,
      output: error.stdout || error.stderr,
    });
  }
});

export default router;
