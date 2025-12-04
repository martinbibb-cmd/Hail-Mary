/**
 * Survey Helper Routes
 * 
 * API endpoints for the Survey Helper engine that guides engineers through
 * site surveys with context-aware questions and tracks spec completeness.
 * 
 * Endpoints:
 * - POST /api/survey-helper/drafts - Create a new SystemSpecDraft
 * - GET /api/survey-helper/drafts/:sessionId - Get a draft by session ID
 * - POST /api/survey-helper/next-question - Get the next recommended question
 * - POST /api/survey-helper/answer - Record an answer to a slot
 * - GET /api/survey-helper/completeness/:sessionId - Get completeness summary
 * - PATCH /api/survey-helper/drafts/:sessionId/topic - Update current topic
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import { systemSpecDrafts, transcriptSegments } from '../db/drizzle-schema';
import { eq, desc } from 'drizzle-orm';
import type {
  ApiResponse,
  SystemSpecDraft,
  ModuleName,
  TopicTag,
  NextQuestionRequest,
  NextQuestionResponse,
  AnswerRequest,
  AnswerResponse,
  CompletenessResponse,
  CreateSystemSpecDraftDto,
  SurveySlot,
} from '@hail-mary/shared';
import { getSlotById } from '@hail-mary/shared';
import {
  getNextQuestion,
  calculateOverallCompleteness,
  createEmptySpecDraft,
  setValueAtPath,
  getValueAtPath,
} from '../services/surveyHelper.service';

const router = Router();

// Helper to get recent transcript text for a session
async function getRecentTranscriptText(sessionId: number, limit = 10): Promise<string> {
  const segments = await db
    .select()
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, sessionId))
    .orderBy(desc(transcriptSegments.createdAt))
    .limit(limit);

  return segments.map(s => s.text).join(' ');
}

// POST /drafts - Create a new SystemSpecDraft for a session
router.post('/drafts', async (req: Request, res: Response) => {
  try {
    const dto: CreateSystemSpecDraftDto = req.body;

    if (!dto.sessionId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'sessionId is required',
      };
      return res.status(400).json(response);
    }

    if (!dto.activeModules || !Array.isArray(dto.activeModules) || dto.activeModules.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'activeModules array is required and must not be empty',
      };
      return res.status(400).json(response);
    }

    // Check if draft already exists for this session
    const existing = await db
      .select()
      .from(systemSpecDrafts)
      .where(eq(systemSpecDrafts.sessionId, dto.sessionId));

    if (existing.length > 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'A draft already exists for this session',
      };
      return res.status(409).json(response);
    }

    // Create empty spec draft
    const emptySpec = createEmptySpecDraft(dto.sessionId, dto.activeModules as ModuleName[]);

    const [inserted] = await db
      .insert(systemSpecDrafts)
      .values({
        sessionId: dto.sessionId,
        activeModules: dto.activeModules,
        specData: emptySpec,
        askedSlotIds: [],
        currentTopic: null,
      })
      .returning();

    const response: ApiResponse<{ draftId: number; specDraft: SystemSpecDraft }> = {
      success: true,
      data: {
        draftId: inserted.id,
        specDraft: {
          ...emptySpec,
          id: inserted.id,
        },
      },
      message: 'SystemSpecDraft created',
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating SystemSpecDraft:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /drafts/:sessionId - Get a draft by session ID
router.get('/drafts/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid session ID',
      };
      return res.status(400).json(response);
    }

    const drafts = await db
      .select()
      .from(systemSpecDrafts)
      .where(eq(systemSpecDrafts.sessionId, sessionId));

    if (drafts.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Draft not found for this session',
      };
      return res.status(404).json(response);
    }

    const draft = drafts[0];
    const specDraft: SystemSpecDraft = {
      ...(draft.specData as SystemSpecDraft),
      id: draft.id,
      sessionId: draft.sessionId,
      activeModules: draft.activeModules as ModuleName[],
    };

    const response: ApiResponse<{
      draft: SystemSpecDraft;
      askedSlotIds: string[];
      currentTopic: string | null;
    }> = {
      success: true,
      data: {
        draft: specDraft,
        askedSlotIds: draft.askedSlotIds as string[],
        currentTopic: draft.currentTopic,
      },
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting SystemSpecDraft:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /next-question - Get the next recommended question
router.post('/next-question', async (req: Request, res: Response) => {
  try {
    const request: NextQuestionRequest = req.body;

    if (!request.sessionId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'sessionId is required',
      };
      return res.status(400).json(response);
    }

    // Get the draft
    const drafts = await db
      .select()
      .from(systemSpecDrafts)
      .where(eq(systemSpecDrafts.sessionId, request.sessionId));

    if (drafts.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No draft found for this session. Create one first.',
      };
      return res.status(404).json(response);
    }

    const draft = drafts[0];
    const specDraft = draft.specData as SystemSpecDraft;
    const activeModules = draft.activeModules as ModuleName[];
    const askedSlotIds = draft.askedSlotIds as string[];
    const currentTopic = (request.currentTopic || draft.currentTopic) as TopicTag | null;

    // Get recent transcript text for context
    const recentTranscriptText = await getRecentTranscriptText(request.sessionId);

    // Get next question
    const nextSlot = getNextQuestion(
      specDraft,
      activeModules,
      currentTopic,
      askedSlotIds,
      recentTranscriptText
    );

    // Calculate completeness
    const completeness = calculateOverallCompleteness(specDraft, activeModules);

    // Update current topic if provided
    if (request.currentTopic && request.currentTopic !== draft.currentTopic) {
      await db
        .update(systemSpecDrafts)
        .set({
          currentTopic: request.currentTopic,
          updatedAt: new Date(),
        })
        .where(eq(systemSpecDrafts.id, draft.id));
    }

    const responseData: NextQuestionResponse = {
      slot: nextSlot,
      completeness: completeness.modules,
      message: nextSlot 
        ? undefined 
        : 'All relevant questions have been answered for the current context.',
    };

    const response: ApiResponse<NextQuestionResponse> = {
      success: true,
      data: responseData,
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting next question:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /answer - Record an answer to a slot
router.post('/answer', async (req: Request, res: Response) => {
  try {
    const request: AnswerRequest = req.body;

    if (!request.sessionId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'sessionId is required',
      };
      return res.status(400).json(response);
    }

    if (!request.slotId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'slotId is required',
      };
      return res.status(400).json(response);
    }

    // Get the slot definition
    const slot = getSlotById(request.slotId);
    if (!slot) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Unknown slot ID: ${request.slotId}`,
      };
      return res.status(400).json(response);
    }

    // Get the draft
    const drafts = await db
      .select()
      .from(systemSpecDrafts)
      .where(eq(systemSpecDrafts.sessionId, request.sessionId));

    if (drafts.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No draft found for this session',
      };
      return res.status(404).json(response);
    }

    const draft = drafts[0];
    const specDraft = { ...(draft.specData as Record<string, unknown>) };
    const askedSlotIds = [...(draft.askedSlotIds as string[])];

    // Set the value at the slot's path
    setValueAtPath(specDraft, slot.path, request.value);

    // Add slot to asked list if not already there
    if (!askedSlotIds.includes(request.slotId)) {
      askedSlotIds.push(request.slotId);
    }

    // Update the draft
    await db
      .update(systemSpecDrafts)
      .set({
        specData: specDraft,
        askedSlotIds,
        updatedAt: new Date(),
      })
      .where(eq(systemSpecDrafts.id, draft.id));

    const responseData: AnswerResponse = {
      success: true,
      updatedPath: slot.path,
      message: `Updated ${slot.path} with value`,
    };

    const response: ApiResponse<AnswerResponse> = {
      success: true,
      data: responseData,
    };
    res.json(response);
  } catch (error) {
    console.error('Error recording answer:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /skip - Skip a slot (mark as asked without setting value)
router.post('/skip', async (req: Request, res: Response) => {
  try {
    const { sessionId, slotId } = req.body;

    if (!sessionId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'sessionId is required',
      };
      return res.status(400).json(response);
    }

    if (!slotId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'slotId is required',
      };
      return res.status(400).json(response);
    }

    // Get the slot definition
    const slot = getSlotById(slotId);
    if (!slot) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Unknown slot ID: ${slotId}`,
      };
      return res.status(400).json(response);
    }

    if (!slot.allowSkip) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'This question cannot be skipped',
      };
      return res.status(400).json(response);
    }

    // Get the draft
    const drafts = await db
      .select()
      .from(systemSpecDrafts)
      .where(eq(systemSpecDrafts.sessionId, sessionId));

    if (drafts.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No draft found for this session',
      };
      return res.status(404).json(response);
    }

    const draft = drafts[0];
    const askedSlotIds = [...(draft.askedSlotIds as string[])];

    // Add slot to asked list if not already there
    if (!askedSlotIds.includes(slotId)) {
      askedSlotIds.push(slotId);
    }

    // Update the draft
    await db
      .update(systemSpecDrafts)
      .set({
        askedSlotIds,
        updatedAt: new Date(),
      })
      .where(eq(systemSpecDrafts.id, draft.id));

    const response: ApiResponse<{ skipped: boolean }> = {
      success: true,
      data: { skipped: true },
      message: `Skipped question: ${slot.question}`,
    };
    res.json(response);
  } catch (error) {
    console.error('Error skipping question:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /completeness/:sessionId - Get completeness summary
router.get('/completeness/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid session ID',
      };
      return res.status(400).json(response);
    }

    // Get the draft
    const drafts = await db
      .select()
      .from(systemSpecDrafts)
      .where(eq(systemSpecDrafts.sessionId, sessionId));

    if (drafts.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No draft found for this session',
      };
      return res.status(404).json(response);
    }

    const draft = drafts[0];
    const specDraft = draft.specData as SystemSpecDraft;
    const activeModules = draft.activeModules as ModuleName[];

    const completeness = calculateOverallCompleteness(specDraft, activeModules);

    const response: ApiResponse<CompletenessResponse> = {
      success: true,
      data: completeness,
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting completeness:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// PATCH /drafts/:sessionId/topic - Update current topic
router.patch('/drafts/:sessionId/topic', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid session ID',
      };
      return res.status(400).json(response);
    }

    const { topic } = req.body;
    if (!topic) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'topic is required',
      };
      return res.status(400).json(response);
    }

    // Get the draft
    const drafts = await db
      .select()
      .from(systemSpecDrafts)
      .where(eq(systemSpecDrafts.sessionId, sessionId));

    if (drafts.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No draft found for this session',
      };
      return res.status(404).json(response);
    }

    // Update the topic
    await db
      .update(systemSpecDrafts)
      .set({
        currentTopic: topic,
        updatedAt: new Date(),
      })
      .where(eq(systemSpecDrafts.id, drafts[0].id));

    const response: ApiResponse<{ topic: string }> = {
      success: true,
      data: { topic },
      message: `Current topic updated to: ${topic}`,
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating topic:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /slots - Get all available slots (for reference/debugging)
router.get('/slots', async (_req: Request, res: Response) => {
  try {
    const { allSurveySlots } = await import('@hail-mary/shared');
    
    const response: ApiResponse<{ slots: SurveySlot[]; count: number }> = {
      success: true,
      data: {
        slots: allSurveySlots,
        count: allSurveySlots.length,
      },
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting slots:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
