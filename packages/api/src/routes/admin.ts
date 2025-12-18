/**
 * Admin Routes for Hail-Mary
 *
 * Handles administrative endpoints (requires admin role):
 * - GET /api/admin/users - List all users
 * - POST /api/admin/users/:userId/reset-password - Reset a user's password
 * - GET /api/admin/system/status - Get system status (DB, migrations, config)
 * - POST /api/admin/system/migrate - Run database migrations
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { listAllUsers, adminResetUserPassword, adminGenerateResetToken, AuthError } from '../services/auth.service';
import adminSystemRouter from './admin.system';

const router = Router();

// All admin routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

// Mount system management routes
router.use('/system', adminSystemRouter);

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

export default router;
