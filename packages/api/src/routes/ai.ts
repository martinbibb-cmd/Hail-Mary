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
const ROCKY_WORKER_URL = process.env.ROCKY_WORKER_URL || '';

/**
 * GET /api/ai/health
 * Check if Rocky Worker is available
 */
router.get('/health', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  
  if (!ROCKY_WORKER_URL) {
    console.warn('⚠️  AI Gateway: ROCKY_WORKER_URL not configured');
    return res.status(503).json({
      success: false,
      error: 'AI Worker URL not configured',
      status: 'unavailable',
    });
  }

  try {
    const workerHealthUrl = `${ROCKY_WORKER_URL}/health`;
    console.log(`🔍 AI Gateway: Checking Worker health at ${workerHealthUrl}`);
    
    const response = await fetch(workerHealthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`✅ AI Gateway: Worker health check completed in ${duration}ms - status: ${response.status}`);

    return res.status(response.status).json({
      success: response.ok,
      status: response.ok ? 'available' : 'degraded',
      worker: data,
      responseTime: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Worker health check failed';
    
    console.error(`❌ AI Gateway: Worker health check failed after ${duration}ms:`, errorMessage);

    return res.status(503).json({
      success: false,
      error: errorMessage,
      status: 'unavailable',
      responseTime: duration,
    });
  }
});

/**
 * POST /api/ai/rocky
 * Proxy requests to Rocky (fact extraction)
 */
router.post('/rocky', requireAuth, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  if (!ROCKY_WORKER_URL) {
    console.warn('⚠️  AI Gateway: ROCKY_WORKER_URL not configured');
    return res.status(503).json({
      success: false,
      error: 'AI Worker URL not configured',
    });
  }

  try {
    const workerUrl = `${ROCKY_WORKER_URL}/rocky`;
    console.log(`🪨 AI Gateway: Forwarding Rocky request to ${workerUrl}`);
    
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`✅ AI Gateway: Rocky request completed in ${duration}ms - status: ${response.status}`);

    return res.status(response.status).json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Rocky request failed';
    
    console.error(`❌ AI Gateway: Rocky request failed after ${duration}ms:`, errorMessage);

    return res.status(503).json({
      success: false,
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
  
  if (!ROCKY_WORKER_URL) {
    console.warn('⚠️  AI Gateway: ROCKY_WORKER_URL not configured');
    return res.status(503).json({
      success: false,
      error: 'AI Worker URL not configured',
    });
  }

  try {
    const workerUrl = `${ROCKY_WORKER_URL}/sarah`;
    console.log(`🧠 AI Gateway: Forwarding Sarah request to ${workerUrl}`);
    
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`✅ AI Gateway: Sarah request completed in ${duration}ms - status: ${response.status}`);

    return res.status(response.status).json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Sarah request failed';
    
    console.error(`❌ AI Gateway: Sarah request failed after ${duration}ms:`, errorMessage);

    return res.status(503).json({
      success: false,
      error: errorMessage,
    });
  }
});

export default router;
