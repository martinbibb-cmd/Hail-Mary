/**
 * AI Gateway Routes
 * 
 * Server-side proxy for Rocky & Sarah Cloudflare Worker.
 * This ensures:
 * - No browser CORS issues
 * - Cloudflare logs show all requests
 * - Centralized error handling and logging
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Get Worker URL from environment or use fallback
const WORKER_URL = process.env.WORKER_URL || process.env.ROCKY_WORKER_URL || '';

/**
 * GET /api/ai/health
 * Check if Rocky Worker is available
 */
router.get('/health', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  
  if (!WORKER_URL) {
    console.warn('⚠️  AI Gateway: WORKER_URL not configured');
    return res.status(500).json({
      error: 'WORKER_URL not set',
    });
  }

  try {
    const workerHealthUrl = `${WORKER_URL}/health`;
    console.log(`🔍 AI Gateway: GET /health -> ${workerHealthUrl}`);
    
    const response = await fetch(workerHealthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`✅ AI Gateway: GET /health completed - status: ${response.status}, duration: ${duration}ms`);

    return res.status(response.status).json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Worker health check failed';
    
    console.error(`❌ AI Gateway: GET /health failed - duration: ${duration}ms, error: ${errorMessage}`);

    return res.status(503).json({
      error: errorMessage,
    });
  }
});

/**
 * POST /api/ai/rocky
 * Proxy requests to Rocky (fact extraction)
 */
router.post('/rocky', requireAuth, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  if (!WORKER_URL) {
    console.warn('⚠️  AI Gateway: WORKER_URL not configured');
    return res.status(500).json({
      error: 'WORKER_URL not set',
    });
  }

  try {
    const workerUrl = `${WORKER_URL}/rocky/analyse`;
    console.log(`🪨 AI Gateway: POST /rocky -> ${workerUrl}`);
    
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`✅ AI Gateway: POST /rocky completed - status: ${response.status}, duration: ${duration}ms`);

    return res.status(response.status).json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Rocky request failed';
    
    console.error(`❌ AI Gateway: POST /rocky failed - duration: ${duration}ms, error: ${errorMessage}`);

    return res.status(503).json({
      error: errorMessage,
    });
  }
});

/**
 * POST /api/ai/sarah
 * Proxy requests to Sarah (explanation generation)
 */
router.post('/sarah', requireAuth, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  if (!WORKER_URL) {
    console.warn('⚠️  AI Gateway: WORKER_URL not configured');
    return res.status(500).json({
      error: 'WORKER_URL not set',
    });
  }

  try {
    const workerUrl = `${WORKER_URL}/sarah/explain`;
    console.log(`🧠 AI Gateway: POST /sarah -> ${workerUrl}`);
    
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`✅ AI Gateway: POST /sarah completed - status: ${response.status}, duration: ${duration}ms`);

    return res.status(response.status).json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Sarah request failed';
    
    console.error(`❌ AI Gateway: POST /sarah failed - duration: ${duration}ms, error: ${errorMessage}`);

    return res.status(503).json({
      error: errorMessage,
    });
  }
});

export default router;
