/**
 * Admin Routes for Hail-Mary
 *
 * Handles administrative endpoints (requires admin role):
 * - GET /api/admin/users - List all users
 * - POST /api/admin/users/:userId/reset-password - Reset a user's password
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { listAllUsers, adminResetUserPassword, AuthError } from '../services/auth.service';

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

    if (!userId || isNaN(userId)) {
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

export default router;
