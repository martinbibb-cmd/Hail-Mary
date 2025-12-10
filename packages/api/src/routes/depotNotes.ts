/**
 * Depot Notes Routes
 * 
 * Handles AI-powered structuring of transcripts into depot notes
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import { transcriptSessions, transcriptSegments } from '../db/drizzle-schema';
import { eq } from 'drizzle-orm';
import type {
  ApiResponse,
  StructuredTranscriptResult,
  AIProviderConfig,
} from '@hail-mary/shared';
import { aiProviderService } from '../services/aiProvider.service';
import { depotTranscriptionService } from '../services/depotTranscription.service';

const router = Router();

/**
 * POST /sessions/:sessionId/structure - Structure a completed transcript into depot notes
 */
router.post('/sessions/:sessionId/structure', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid session ID',
      };
      return res.status(400).json(response);
    }

    // Get session
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

    const session = sessions[0];

    // Check session is completed
    if (session.status !== 'completed') {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Transcript session must be completed before structuring',
      };
      return res.status(400).json(response);
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

    // Combine all segments into full transcript
    const fullTranscript = segments.map(s => s.text).join(' ');

    // Get AI provider configuration from environment
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!openaiApiKey && !anthropicApiKey) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No AI provider API keys configured',
      };
      return res.status(500).json(response);
    }

    // Configure primary and fallback providers
    const primaryProvider: AIProviderConfig = openaiApiKey
      ? {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: openaiApiKey,
          temperature: 0.3,
          maxTokens: 2000,
        }
      : {
          provider: 'anthropic',
          model: 'claude-3-sonnet-20240229',
          apiKey: anthropicApiKey!,
          temperature: 0.3,
          maxTokens: 2000,
        };

    const fallbackProvider: AIProviderConfig | undefined =
      openaiApiKey && anthropicApiKey
        ? {
            provider: 'anthropic',
            model: 'claude-3-sonnet-20240229',
            apiKey: anthropicApiKey,
            temperature: 0.3,
            maxTokens: 2000,
          }
        : undefined;

    // TODO: Fetch reference materials from product database
    // const referenceMaterials = await fetchReferenceMaterials();
    const referenceMaterials = undefined;

    // Process transcript
    const result = await aiProviderService.processTranscriptToStructuredNotes(
      fullTranscript,
      primaryProvider,
      fallbackProvider,
      referenceMaterials
    );

    const response: ApiResponse<StructuredTranscriptResult> = {
      success: true,
      data: result,
      message: 'Transcript structured into depot notes',
    };
    res.json(response);
  } catch (error) {
    console.error('Error structuring transcript:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * GET /schema - Get depot section schema
 */
router.get('/schema', (_req: Request, res: Response) => {
  const schema = depotTranscriptionService.getDepotSchema();
  const response: ApiResponse<typeof schema> = {
    success: true,
    data: schema,
  };
  res.json(response);
});

/**
 * GET /checklist-config - Get checklist configuration
 */
router.get('/checklist-config', (_req: Request, res: Response) => {
  const config = depotTranscriptionService.getChecklistConfig();
  const response: ApiResponse<typeof config> = {
    success: true,
    data: config,
  };
  res.json(response);
});

export default router;
