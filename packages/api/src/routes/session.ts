/**
 * Session Routes - Active lead/customer persistence
 * 
 * Provides endpoints for persisting the active customer/lead in the user session.
 * This allows the active customer to follow the user across devices.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import type { ApiResponse } from '@hail-mary/shared';

const router = Router();

// Apply authentication middleware
router.use(requireAuth);

/**
 * POST /api/session/active-lead
 * Store the active lead ID in the session
 */
router.post('/active-lead', async (req: Request, res: Response) => {
  try {
    const { leadId } = req.body;

    if (!leadId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'leadId is required',
      };
      return res.status(400).json(response);
    }

    // Store in session
    if (req.session) {
      req.session.activeLeadId = String(leadId);
    }

    const response: ApiResponse<{ leadId: string }> = {
      success: true,
      data: { leadId: String(leadId) },
      message: 'Active lead saved to session',
    };
    res.json(response);
  } catch (error) {
    console.error('Error saving active lead to session:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/session/active-lead
 * Retrieve the active lead ID from the session
 */
router.get('/active-lead', async (req: Request, res: Response) => {
  try {
    const leadId = req.session?.activeLeadId || null;

    const response: ApiResponse<{ leadId: string | null }> = {
      success: true,
      data: { leadId },
    };
    res.json(response);
  } catch (error) {
    console.error('Error retrieving active lead from session:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/session/active-lead
 * Clear the active lead from the session
 */
router.delete('/active-lead', async (req: Request, res: Response) => {
  try {
    if (req.session) {
      req.session.activeLeadId = undefined;
    }

    const response: ApiResponse<null> = {
      success: true,
      message: 'Active lead cleared from session',
    };
    res.json(response);
  } catch (error) {
    console.error('Error clearing active lead from session:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
