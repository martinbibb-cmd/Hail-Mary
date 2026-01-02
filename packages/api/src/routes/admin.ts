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
import { listAllUsers, adminResetUserPassword, adminGenerateResetToken, updateUserRole, AuthError } from '../services/auth.service';
import adminSystemRouter from './admin.system';
import adminBugReportsRouter from './admin.bugReports';
import { db } from '../db/drizzle-client';
import { leads } from '../db/drizzle-schema';
import { eq } from 'drizzle-orm';

const router = Router();

// All admin routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

// Mount system management routes
router.use('/system', adminSystemRouter);

// Mount bug reports management routes
router.use('/bug-reports', adminBugReportsRouter);

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
 * PATCH /api/admin/users/:userId/role
 * Update a user's role (promote to admin or demote to user)
 * Body: { role: 'admin' | 'user' }
 */
router.patch('/users/:userId/role', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { role } = req.body;

    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid user ID is required',
      });
    }

    if (!role || (role !== 'user' && role !== 'admin')) {
      return res.status(400).json({
        success: false,
        error: 'Role must be either "user" or "admin"',
      });
    }

    const adminUser = req.user;
    if (!adminUser) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Prevent admins from demoting themselves
    if (userId === adminUser.id && role === 'user') {
      return res.status(400).json({
        success: false,
        error: 'You cannot demote yourself. Ask another admin to change your role.',
      });
    }

    const updatedUser = await updateUserRole(userId, role, adminUser.id);

    return res.json({
      success: true,
      message: `User role updated to ${role}`,
      data: updatedUser,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    console.error('Error updating user role:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update user role',
    });
  }
});

/**
 * POST /api/admin/leads/:leadId/assign
 * Assign a lead to a specific user
 * Body: { userId: number }
 */
router.post('/leads/:leadId/assign', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const { userId } = req.body;

    if (isNaN(leadId) || leadId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid lead ID is required',
      });
    }

    if (!userId || isNaN(parseInt(userId, 10)) || parseInt(userId, 10) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid user ID is required',
      });
    }

    const targetUserId = parseInt(userId, 10);

    // Update lead assignment
    const result = await db
      .update(leads)
      .set({ assignedUserId: targetUserId, updatedAt: new Date() })
      .where(eq(leads.id, leadId))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    return res.json({
      success: true,
      message: 'Lead assigned successfully',
      data: {
        leadId,
        assignedUserId: targetUserId,
      },
    });
  } catch (error) {
    console.error('Error assigning lead:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to assign lead',
    });
  }
});

/**
 * POST /api/admin/leads/:leadId/unassign
 * Remove user assignment from a lead
 */
router.post('/leads/:leadId/unassign', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);

    if (isNaN(leadId) || leadId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid lead ID is required',
      });
    }

    // Remove assignment by setting to null
    const result = await db
      .update(leads)
      .set({ assignedUserId: null, updatedAt: new Date() })
      .where(eq(leads.id, leadId))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    return res.json({
      success: true,
      message: 'Lead unassigned successfully',
      data: {
        leadId,
        assignedUserId: null,
      },
    });
  } catch (error) {
    console.error('Error unassigning lead:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to unassign lead',
    });
  }
});

export default router;
