/**
 * GC Boiler Catalog API Routes
 * 
 * Endpoints for GC-based boiler lookup, resolution, and enrichment.
 * 
 * Endpoints:
 * - GET    /api/gc/:gcNumber - retrieve catalog record by GC number
 * - POST   /api/gc/resolve - resolve survey fields with confidence
 * - POST   /api/gc/enrichment/request - create enrichment queue entry
 * - GET    /api/gc/enrichment/queue - get enrichment queue (admin)
 * - POST   /api/gc/enrichment/approve - approve/merge enrichment (admin)
 * - POST   /api/gc/enrichment/reject - reject enrichment (admin)
 * - GET    /api/gc/enrichment/stats - get enrichment statistics (admin)
 */

import { Router, Request, Response } from 'express';
import { requireAuth, blockGuest } from '../middleware/auth.middleware';
import {
  lookupBoilerByGc,
  getSourcesForGc,
  calculateQualityScore,
} from '../services/gc.service';
import { resolveGcFields } from '../services/gc-resolver.service';
import {
  requestEnrichment,
  getEnrichmentById,
  getPendingEnrichments,
  approveEnrichment,
  rejectEnrichment,
  getEnrichmentStats,
} from '../services/gc-enrichment.service';
import type {
  GetGcCatalogResponse,
  ResolveGcRequest,
  ResolveGcResponse,
  EnrichmentRequest,
  EnrichmentRequestResponse,
  ApproveEnrichmentRequest,
  ApproveEnrichmentResponse,
  RejectEnrichmentRequest,
  RejectEnrichmentResponse,
  ApiResponse,
} from '@hail-mary/shared';

const router = Router();

// All routes require authentication
router.use(requireAuth);
router.use(blockGuest);

// ============================================
// GET /api/gc/:gcNumber
// ============================================

/**
 * Retrieve a boiler catalog record by GC number
 */
router.get('/:gcNumber', async (req: Request, res: Response) => {
  try {
    const { gcNumber } = req.params;

    if (!gcNumber) {
      const response: GetGcCatalogResponse = {
        success: false,
        error: 'GC number is required',
      };
      return res.status(400).json(response);
    }

    const catalog = await lookupBoilerByGc(gcNumber);

    if (!catalog) {
      const response: GetGcCatalogResponse = {
        success: false,
        error: 'GC number not found in catalog',
      };
      return res.status(404).json(response);
    }

    // Get sources
    const sources = await getSourcesForGc(catalog.id);

    // Calculate quality score
    const qualityScore = calculateQualityScore(catalog, sources);

    const response: GetGcCatalogResponse = {
      success: true,
      data: {
        catalog,
        sources,
        qualityScore,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching GC catalog:', error);
    const response: GetGcCatalogResponse = {
      success: false,
      error: 'Failed to fetch GC catalog',
    };
    res.status(500).json(response);
  }
});

// ============================================
// POST /api/gc/resolve
// ============================================

/**
 * Resolve survey fields from GC catalog with confidence scoring
 */
router.post('/resolve', async (req: Request, res: Response) => {
  try {
    const request: ResolveGcRequest = req.body;

    const result = await resolveGcFields(request);

    res.json(result);
  } catch (error) {
    console.error('Error resolving GC fields:', error);
    const response: ResolveGcResponse = {
      success: false,
      error: 'Failed to resolve GC fields',
    };
    res.status(500).json(response);
  }
});

// ============================================
// POST /api/gc/enrichment/request
// ============================================

/**
 * Create or update an enrichment request for a missing GC number
 */
router.post('/enrichment/request', async (req: Request, res: Response) => {
  try {
    const { gcNumber, context }: EnrichmentRequest = req.body;

    if (!gcNumber) {
      const response: EnrichmentRequestResponse = {
        success: false,
        error: 'GC number is required',
      };
      return res.status(400).json(response);
    }

    const userId = req.user!.id;
    const leadId = req.body.leadId; // optional

    const entry = await requestEnrichment(gcNumber, userId, leadId, context);

    const response: EnrichmentRequestResponse = {
      success: true,
      data: {
        queueId: entry.id,
        status: entry.status,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error creating enrichment request:', error);
    const response: EnrichmentRequestResponse = {
      success: false,
      error: 'Failed to create enrichment request',
    };
    res.status(500).json(response);
  }
});

// ============================================
// GET /api/gc/enrichment/queue
// ============================================

/**
 * Get enrichment queue entries (admin only)
 */
router.get('/enrichment/queue', async (req: Request, res: Response) => {
  try {
    // Admin check
    if (req.user!.role !== 'admin') {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Admin access required',
      };
      return res.status(403).json(response);
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const entries = await getPendingEnrichments(limit);

    const response: ApiResponse<typeof entries> = {
      success: true,
      data: entries,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching enrichment queue:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch enrichment queue',
    };
    res.status(500).json(response);
  }
});

// ============================================
// POST /api/gc/enrichment/approve
// ============================================

/**
 * Approve an enrichment request and create catalog entry (admin only)
 */
router.post('/enrichment/approve', async (req: Request, res: Response) => {
  try {
    // Admin check
    if (req.user!.role !== 'admin') {
      const response: ApproveEnrichmentResponse = {
        success: false,
        error: 'Admin access required',
      };
      return res.status(403).json(response);
    }

    const { queueId, chosenCandidate, catalogPatch }: ApproveEnrichmentRequest = req.body;

    if (!queueId) {
      const response: ApproveEnrichmentResponse = {
        success: false,
        error: 'Queue ID is required',
      };
      return res.status(400).json(response);
    }

    if (!chosenCandidate) {
      const response: ApproveEnrichmentResponse = {
        success: false,
        error: 'Chosen candidate is required',
      };
      return res.status(400).json(response);
    }

    const userId = req.user!.id;
    const catalogId = await approveEnrichment(
      queueId,
      userId,
      chosenCandidate,
      catalogPatch?.notes
    );

    // Get the entry to return GC number
    const entry = await getEnrichmentById(queueId);

    const response: ApproveEnrichmentResponse = {
      success: true,
      data: {
        catalogId,
        gcNumber: entry?.gcNumber || '',
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error approving enrichment:', error);
    const response: ApproveEnrichmentResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve enrichment',
    };
    res.status(500).json(response);
  }
});

// ============================================
// POST /api/gc/enrichment/reject
// ============================================

/**
 * Reject an enrichment request (admin only)
 */
router.post('/enrichment/reject', async (req: Request, res: Response) => {
  try {
    // Admin check
    if (req.user!.role !== 'admin') {
      const response: RejectEnrichmentResponse = {
        success: false,
        error: 'Admin access required',
      };
      return res.status(403).json(response);
    }

    const { queueId, reason }: RejectEnrichmentRequest = req.body;

    if (!queueId) {
      const response: RejectEnrichmentResponse = {
        success: false,
        error: 'Queue ID is required',
      };
      return res.status(400).json(response);
    }

    if (!reason) {
      const response: RejectEnrichmentResponse = {
        success: false,
        error: 'Rejection reason is required',
      };
      return res.status(400).json(response);
    }

    const userId = req.user!.id;
    await rejectEnrichment(queueId, userId, reason);

    const response: RejectEnrichmentResponse = {
      success: true,
    };

    res.json(response);
  } catch (error) {
    console.error('Error rejecting enrichment:', error);
    const response: RejectEnrichmentResponse = {
      success: false,
      error: 'Failed to reject enrichment',
    };
    res.status(500).json(response);
  }
});

// ============================================
// GET /api/gc/enrichment/stats
// ============================================

/**
 * Get enrichment statistics (admin only)
 */
router.get('/enrichment/stats', async (req: Request, res: Response) => {
  try {
    // Admin check
    if (req.user!.role !== 'admin') {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Admin access required',
      };
      return res.status(403).json(response);
    }

    const stats = await getEnrichmentStats();

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching enrichment stats:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch enrichment stats',
    };
    res.status(500).json(response);
  }
});

export default router;
