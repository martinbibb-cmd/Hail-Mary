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
import { listAllUsers, adminResetUserPassword, AuthError } from '../services/auth.service';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password is required',
      });
    }

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
 * Get current NAS deployment status
 */
router.get('/nas/status', async (_req: Request, res: Response) => {
  try {
    // Check if running in a Docker container
    const { stdout: isDocker } = await execAsync('[ -f /.dockerenv ] && echo "true" || echo "false"').catch(() => ({ stdout: 'false' }));
    
    // Get docker-compose status if available
    let containerStatus = null;
    if (isDocker.trim() === 'true') {
      try {
        const { stdout } = await execAsync('docker-compose -f /opt/hail-mary/docker-compose.prod.yml ps --format json 2>/dev/null || docker-compose -f /opt/hail-mary/docker-compose.yml ps --format json 2>/dev/null || echo "[]"');
        containerStatus = stdout.trim();
      } catch (error) {
        console.log('Could not get container status:', error);
      }
    }

    return res.json({
      success: true,
      data: {
        isDocker: isDocker.trim() === 'true',
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
    const deployDir = process.env.DEPLOY_DIR || '/opt/hail-mary';
    const composeFile = `${deployDir}/docker-compose.prod.yml`;
    
    // Check if the NAS deploy script exists
    const scriptPath = `${deployDir}/scripts/nas-deploy.sh`;
    const { stdout: scriptExists } = await execAsync(`[ -f ${scriptPath} ] && echo "true" || echo "false"`).catch(() => ({ stdout: 'false' }));
    
    if (scriptExists.trim() !== 'true') {
      return res.status(404).json({
        success: false,
        error: 'NAS deployment scripts not found. This may not be a NAS deployment.',
      });
    }

    // Pull images to check for updates (this doesn't restart containers)
    const { stdout, stderr } = await execAsync(`cd ${deployDir} && docker-compose -f ${composeFile} pull 2>&1`);
    
    // Check if any images were updated
    const hasUpdates = stdout.includes('Downloaded newer image') || stdout.includes('Pulled');
    
    return res.json({
      success: true,
      data: {
        hasUpdates,
        message: hasUpdates ? 'Updates available' : 'No updates available',
        output: stdout + stderr,
      },
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
    const deployDir = process.env.DEPLOY_DIR || '/opt/hail-mary';
    const scriptPath = `${deployDir}/scripts/nas-deploy.sh`;
    
    // Check if the NAS deploy script exists
    const { stdout: scriptExists } = await execAsync(`[ -f ${scriptPath} ] && echo "true" || echo "false"`).catch(() => ({ stdout: 'false' }));
    
    if (scriptExists.trim() !== 'true') {
      return res.status(404).json({
        success: false,
        error: 'NAS deployment scripts not found. This may not be a NAS deployment.',
      });
    }

    // Run the NAS deploy script
    const { stdout, stderr } = await execAsync(`bash ${scriptPath} 2>&1`, {
      timeout: 300000, // 5 minute timeout
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
    const apiDir = process.env.API_DIR || '/app';
    
    // Run migrations using npm script
    const { stdout, stderr } = await execAsync(`cd ${apiDir} && npm run migrate 2>&1`, {
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
