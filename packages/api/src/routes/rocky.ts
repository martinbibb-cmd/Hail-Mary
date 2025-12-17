/**
 * Rocky Logic Engine Routes
 * 
 * Standalone API endpoints for Rocky deterministic processing.
 * These endpoints allow direct access to Rocky's fact extraction capabilities.
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

const router = Router();

/**
 * POST /api/rocky/run - Run Rocky processing on natural notes
 * 
 * Input: { leadId?, visitId?, transcript?, structured?, preferences? }
 * Output: RockyProcessResult with facts, bullets, json, warnings
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { leadId, visitId, sessionId, transcript, naturalNotes } = req.body;
    
    let textToProcess = '';
    let processingSessionId = sessionId;
    
    // If transcript/naturalNotes provided directly, use it
    if (transcript) {
      textToProcess = transcript;
    } else if (naturalNotes) {
      textToProcess = naturalNotes;
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
        error: 'Either sessionId, transcript, or naturalNotes must be provided',
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
    
    // Use sessionId or create a temporary one (0 for direct API calls)
    const effectiveSessionId = processingSessionId || 0;
    
    // Process through Rocky
    const rockyRequest: RockyProcessRequest = {
      sessionId: effectiveSessionId,
      naturalNotes: textToProcess,
      language: req.body.language || 'en-GB',
    };
    
    const rockyResult = await rockyService.processNaturalNotes(rockyRequest);
    
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

export default router;
