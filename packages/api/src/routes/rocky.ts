/**
 * Rocky Logic Engine Routes
 *
 * Standalone API endpoints for Rocky deterministic processing.
 * These endpoints allow direct access to Rocky's fact extraction capabilities.
 * Also includes Rocky Health Checker for system diagnostics.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import { transcriptSessions, transcriptSegments } from '../db/drizzle-schema';
import { eq } from 'drizzle-orm';
import type {
  ApiResponse,
  RockyProcessRequest,
  RockyProcessResult,
} from '@hail-mary/shared';
import { rockyService } from '../services/rocky.service';
import { runHealthCheck } from '../utils/rocky-health';

const router = Router();

function pickText(body: any): { text: string; usedKey: string | null } {
  const candidates: Array<[string, unknown]> = [
    ['transcript', body?.transcript],
    ['text', body?.text],
    ['notes', body?.notes],
    ['naturalNotes', body?.naturalNotes],
  ];
  for (const [key, value] of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return { text: value, usedKey: key };
    }
  }
  return { text: '', usedKey: null };
}

/**
 * POST /api/rocky/run - Run Rocky processing on natural notes
 * 
 * Input: { leadId?, visitId?, transcript?, structured?, preferences? }
 * Output: RockyProcessResult with facts, bullets, json, warnings
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { leadId, visitId, sessionId } = req.body;
    
    let textToProcess = '';
    let processingSessionId = sessionId;
    
    // If transcript/text/notes/naturalNotes provided directly, use it
    const picked = pickText(req.body);
    if (picked.usedKey) {
      textToProcess = picked.text;
    } else if (sessionId) {
      // Fetch from database if sessionId provided
      const sessions = await db
        .select()
        .from(transcriptSessions)
        .where(eq(transcriptSessions.id, sessionId));
      
      if (sessions.length === 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Transcript session not found',
        };
        return res.status(404).json(response);
      }
      
      // Get all segments for the session
      const segments = await db
        .select()
        .from(transcriptSegments)
        .where(eq(transcriptSegments.sessionId, sessionId))
        .orderBy(transcriptSegments.startSeconds);
      
      if (segments.length === 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'No transcript segments found for this session',
        };
        return res.status(404).json(response);
      }
      
      textToProcess = segments.map(s => s.text).join(' ');
    } else {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Missing transcript text. Provide one of: transcript, text, notes, naturalNotes, or sessionId',
      };
      return res.status(400).json(response);
    }
    
    if (!textToProcess.trim()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No text content to process',
      };
      return res.status(400).json(response);
    }
    
    // Use sessionId or create a temporary one (-1 for direct API calls without session)
    const effectiveSessionId = processingSessionId || -1;
    
    // Process through Rocky
    const rockyRequest: RockyProcessRequest = {
      sessionId: effectiveSessionId,
      naturalNotes: textToProcess,
      language: req.body.language || 'en-GB',
    };
    
    const rockyResult = await rockyService.processNaturalNotes(rockyRequest);

    // Minimal observability + stable debug/meta
    const receivedKeys = req.body && typeof req.body === 'object' ? Object.keys(req.body) : [];
    const facts = rockyResult?.rockyFacts?.facts ?? {};
    const matchedRules: string[] = [];
    const unmatchedRules: string[] = [];
    const ruleChecks: Array<[string, boolean]> = [
      ['measurements.pipeSize', Boolean((facts as any)?.measurements?.pipeSize)],
      ['measurements.radiatorCount', typeof (facts as any)?.measurements?.radiatorCount === 'number'],
      ['measurements.cylinderCapacity', typeof (facts as any)?.measurements?.cylinderCapacity === 'number'],
      ['measurements.mainFuseRating', typeof (facts as any)?.measurements?.mainFuseRating === 'number'],
      ['materials.any', Array.isArray((facts as any)?.materials) && (facts as any).materials.length > 0],
      ['hazards.any', Array.isArray((facts as any)?.hazards) && (facts as any).hazards.length > 0],
      ['property.any', (facts as any)?.property && typeof (facts as any).property === 'object' && Object.keys((facts as any).property).length > 0],
      ['customer.any', (facts as any)?.customer && typeof (facts as any).customer === 'object' && Object.keys((facts as any).customer).length > 0],
      ['existingSystem.any', (facts as any)?.existingSystem && typeof (facts as any).existingSystem === 'object' && Object.keys((facts as any).existingSystem).length > 0],
    ];
    for (const [rule, ok] of ruleChecks) {
      (ok ? matchedRules : unmatchedRules).push(rule);
    }
    (rockyResult as any).meta = {
      chars: textToProcess.length,
      ruleMatches: matchedRules.length,
      receivedKeys,
      usedTextKey: picked.usedKey,
    };
    (rockyResult as any).debug = {
      matchedRules,
      unmatchedRules,
      notes: [
        picked.usedKey ? `Using request body field: ${picked.usedKey}` : 'Using transcript text from sessionId lookup',
      ],
    };
    
    const response: ApiResponse<RockyProcessResult> = {
      success: rockyResult.success,
      data: rockyResult,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Rocky processing error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Rocky processing failed',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/rocky/health - Rocky Health Checker
 *
 * Runs comprehensive system health check:
 * - Database connectivity and schema validation
 * - Migration status
 * - Container health (if running in Docker)
 * - Service endpoints (API, Assistant, PWA)
 *
 * Returns actionable diagnostics with exact commands to fix issues.
 * Never hallucinates - only reports what can be verified.
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const result = await runHealthCheck();

    // Set appropriate HTTP status code based on health
    const statusCode =
      result.status === 'unhealthy' ? 503 :
      result.status === 'degraded' ? 200 :
      200;

    res.status(statusCode).json(result);
  } catch (error) {
    console.error('Rocky health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
      diagnostics: [{
        severity: 'critical',
        component: 'health-check',
        issue: 'Health check failed to run',
        fix: 'Check server logs for details',
      }],
    });
  }
});

export default router;
