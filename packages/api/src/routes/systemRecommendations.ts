/**
 * System Recommendation Routes - API for saving/retrieving system recommendations per lead
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import { leadSystemRecommendations, leads } from '../db/drizzle-schema';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, blockGuest } from '../middleware/auth.middleware';
import {
  SystemRecInput,
  SystemRecOutput,
  computeSystemRecommendation,
  RULESET_VERSION,
} from '@hail-mary/shared';
import type { ApiResponse } from '@hail-mary/shared';

const router = Router();

// Apply authentication middleware to all system recommendation routes
router.use(requireAuth);
router.use(blockGuest);

/**
 * POST /api/v1/leads/:leadId/system-recommendation
 * Save a new system recommendation for a lead
 * 
 * Note: Currently uses basic lead existence check. Future enhancement should add
 * accountId-based access control when multi-tenancy is fully implemented.
 */
router.post('/:leadId/system-recommendation', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.leadId);
    
    // Validate leadId
    if (isNaN(leadId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid lead ID',
      };
      res.status(400).json(response);
      return;
    }

    // Verify lead exists (basic access control - if lead doesn't exist or user doesn't have access, fail)
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Lead not found',
      };
      res.status(404).json(response);
      return;
    }

    // Validate input
    const input = req.body as SystemRecInput;
    
    // Basic validation
    if (!input.propertyType || !input.bedrooms || input.bedrooms < 1) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid input: propertyType and bedrooms (>0) are required',
      };
      res.status(400).json(response);
      return;
    }

    if (typeof input.bathrooms !== 'number' || input.bathrooms < 1) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid input: bathrooms must be a number >= 1',
      };
      res.status(400).json(response);
      return;
    }

    if (!input.currentSystem) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid input: currentSystem is required',
      };
      res.status(400).json(response);
      return;
    }

    if (typeof input.hasGasConnection !== 'boolean') {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid input: hasGasConnection must be a boolean',
      };
      res.status(400).json(response);
      return;
    }

    // Compute system recommendation
    const output = computeSystemRecommendation(input);

    // Save to database
    const [saved] = await db
      .insert(leadSystemRecommendations)
      .values({
        leadId,
        rulesetVersion: RULESET_VERSION,
        inputJson: input as unknown as typeof leadSystemRecommendations.$inferInsert.inputJson,
        outputJson: output as unknown as typeof leadSystemRecommendations.$inferInsert.outputJson,
        createdByUserId: req.user?.id || null,
      })
      .returning();

    const response: ApiResponse<{
      id: number;
      rulesetVersion: string;
      output: SystemRecOutput;
      createdAt: Date;
    }> = {
      success: true,
      data: {
        id: saved.id,
        rulesetVersion: saved.rulesetVersion,
        output: output,
        createdAt: saved.createdAt,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error saving system recommendation:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/leads/:leadId/system-recommendation/latest
 * Get the most recent system recommendation for a lead
 * 
 * Note: Currently uses basic lead access pattern. Future enhancement should add
 * accountId-based access control when multi-tenancy is fully implemented.
 */
router.get('/:leadId/system-recommendation/latest', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.leadId);
    
    if (isNaN(leadId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid lead ID',
      };
      res.status(400).json(response);
      return;
    }

    // Get most recent recommendation
    const [recommendation] = await db
      .select()
      .from(leadSystemRecommendations)
      .where(eq(leadSystemRecommendations.leadId, leadId))
      .orderBy(desc(leadSystemRecommendations.createdAt))
      .limit(1);

    if (!recommendation) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No recommendations found for this lead',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<{
      id: number;
      rulesetVersion: string;
      output: SystemRecOutput;
      createdAt: Date;
    }> = {
      success: true,
      data: {
        id: recommendation.id,
        rulesetVersion: recommendation.rulesetVersion,
        output: recommendation.outputJson as SystemRecOutput,
        createdAt: recommendation.createdAt,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching latest recommendation:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/leads/:leadId/system-recommendation
 * Get list of system recommendations for a lead (history)
 * 
 * Note: Currently uses basic lead access pattern. Future enhancement should add
 * accountId-based access control when multi-tenancy is fully implemented.
 */
router.get('/:leadId/system-recommendation', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.leadId);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    if (isNaN(leadId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid lead ID',
      };
      res.status(400).json(response);
      return;
    }

    // Get recommendations history
    const recommendations = await db
      .select()
      .from(leadSystemRecommendations)
      .where(eq(leadSystemRecommendations.leadId, leadId))
      .orderBy(desc(leadSystemRecommendations.createdAt))
      .limit(limit);

    // Return summary list
    const summaryList = recommendations.map((rec) => {
      const output = rec.outputJson as SystemRecOutput;
      return {
        id: rec.id,
        rulesetVersion: rec.rulesetVersion,
        createdAt: rec.createdAt,
        primaryTitle: output.primaryRecommendation.title,
        confidence: output.primaryRecommendation.confidence,
      };
    });

    const response: ApiResponse<typeof summaryList> = {
      success: true,
      data: summaryList,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching recommendation history:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/leads/:leadId/system-recommendation/:id
 * Get a specific system recommendation by ID
 */
router.get('/:leadId/system-recommendation/:id', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.leadId);
    const id = parseInt(req.params.id);
    
    if (isNaN(leadId) || isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid lead ID or recommendation ID',
      };
      res.status(400).json(response);
      return;
    }

    // Get specific recommendation
    const [recommendation] = await db
      .select()
      .from(leadSystemRecommendations)
      .where(eq(leadSystemRecommendations.id, id))
      .limit(1);

    if (!recommendation) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Recommendation not found',
      };
      res.status(404).json(response);
      return;
    }

    // Verify it belongs to the specified lead
    if (recommendation.leadId !== leadId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Recommendation does not belong to this lead',
      };
      res.status(403).json(response);
      return;
    }

    const response: ApiResponse<{
      id: number;
      rulesetVersion: string;
      input: SystemRecInput;
      output: SystemRecOutput;
      createdAt: Date;
    }> = {
      success: true,
      data: {
        id: recommendation.id,
        rulesetVersion: recommendation.rulesetVersion,
        input: recommendation.inputJson as SystemRecInput,
        output: recommendation.outputJson as SystemRecOutput,
        createdAt: recommendation.createdAt,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching recommendation:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
