/**
 * Session Routes - Active lead/customer persistence
 * 
 * Provides endpoints for persisting the active customer/lead.
 * Uses in-memory storage per user (can be extended to database or session storage later).
 * This allows the active customer to follow the user across devices.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import type { ApiResponse } from '@hail-mary/shared';

const router = Router();

// Apply authentication middleware
router.use(requireAuth);

// In-memory storage for active lead by user ID
// ⚠️ WARNING: This is ephemeral storage that will not persist across server restarts
// ⚠️ WARNING: Does not scale in multi-instance/cluster deployments
// TODO: Before production deployment, replace with Redis or database-backed storage
// Implementation options:
//   1. Redis: Fast, distributed, TTL support
//   2. Database: Persistent, existing infrastructure
//   3. Memcached: Alternative to Redis
const activeLeadStore = new Map<number, string>();

/**
 * POST /api/session/active-lead
 * Store the active lead ID for the current user
 */
router.post('/active-lead', async (req: Request, res: Response) => {
  try {
    const { leadId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'User not authenticated',
      };
      return res.status(401).json(response);
    }

    if (!leadId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'leadId is required',
      };
      return res.status(400).json(response);
    }

    // Store in memory
    activeLeadStore.set(userId, String(leadId));

    const response: ApiResponse<{ leadId: string }> = {
      success: true,
      data: { leadId: String(leadId) },
      message: 'Active lead saved',
    };
    res.json(response);
  } catch (error) {
    console.error('Error saving active lead:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/session/active-lead
 * Retrieve the active lead ID for the current user
 */
router.get('/active-lead', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'User not authenticated',
      };
      return res.status(401).json(response);
    }

    const leadId = activeLeadStore.get(userId) || null;

    const response: ApiResponse<{ leadId: string | null }> = {
      success: true,
      data: { leadId },
    };
    res.json(response);
  } catch (error) {
    console.error('Error retrieving active lead:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/session/active-lead
 * Clear the active lead for the current user
 */
router.delete('/active-lead', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'User not authenticated',
      };
      return res.status(401).json(response);
    }

    activeLeadStore.delete(userId);

    const response: ApiResponse<null> = {
      success: true,
      message: 'Active lead cleared',
    };
    res.json(response);
  } catch (error) {
    console.error('Error clearing active lead:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
