/**
 * Voice Notes Routes - Rocky & Sarah Architecture
 * 
 * Implements the refactored voice notes system:
 * - Natural Notes: Verbatim transcript storage (editable)
 * - Rocky: Deterministic fact extraction and derivation
 * - Sarah: Audience-specific explanations from Rocky's facts
 * 
 * Architectural Rule: Rocky decides. Sarah explains.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import { voiceNotes, sarahExplanations, transcriptSessions, transcriptSegments } from '../db/drizzle-schema';
import { eq } from 'drizzle-orm';
import type {
  ApiResponse,
  RockyProcessRequest,
  SarahExplainRequest,
  SarahAudience,
  SarahTone,
} from '@hail-mary/shared';
import { rockyService } from '../services/rocky.service';
import { sarahService } from '../services/sarah.service';

const router = Router();

/**
 * POST /voice-notes/process - Process transcript through Rocky
 * 
 * Takes a transcript session and generates:
 * - Natural Notes (stored verbatim)
 * - RockyFacts (deterministic extraction)
 * - Automatic Notes (Rocky-generated)
 * - Engineer Basics (Rocky-generated, fixed format)
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'sessionId is required',
      };
      return res.status(400).json(response);
    }
    
    // Get transcript session
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
    
    // Combine all segments into full transcript (Natural Notes)
    const naturalNotesRaw = segments.map(s => s.text).join(' ');
    
    // Process through Rocky
    const rockyRequest: RockyProcessRequest = {
      sessionId,
      naturalNotes: naturalNotesRaw,
      language: session.language,
    };
    
    const rockyResult = await rockyService.processNaturalNotes(rockyRequest);
    
    if (!rockyResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Rocky processing failed',
      };
      return res.status(500).json(response);
    }
    
    // Store in database
    const [inserted] = await db
      .insert(voiceNotes)
      .values({
        sessionId,
        naturalNotesRaw,
        naturalNotesEdited: null,
        naturalNotesHash: rockyResult.rockyFacts.naturalNotesHash,
        rockyFactsVersion: rockyResult.rockyFacts.version,
        rockyFacts: rockyResult.rockyFacts as any,
        automaticNotes: rockyResult.automaticNotes as any,
        engineerBasics: rockyResult.engineerBasics as any,
        rockyProcessedAt: rockyResult.rockyFacts.processedAt,
        rockyProcessingTimeMs: rockyResult.processingTimeMs,
      })
      .returning();
    
    const response: ApiResponse<any> = {
      success: true,
      data: {
        ...rockyResult,
        voiceNoteId: inserted.id,
      },
      message: 'Voice notes processed through Rocky',
    };
    res.json(response);
  } catch (error) {
    console.error('Error processing voice notes:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * POST /voice-notes/:id/explain - Generate Sarah explanation
 * 
 * Generates audience-specific explanation from RockyFacts
 */
router.post('/:id/explain', async (req: Request, res: Response) => {
  try {
    const voiceNoteId = parseInt(req.params.id);
    const { audience, tone = 'professional' } = req.body;
    
    if (isNaN(voiceNoteId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid voice note ID',
      };
      return res.status(400).json(response);
    }
    
    if (!audience) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'audience is required (customer, engineer, surveyor, manager, admin)',
      };
      return res.status(400).json(response);
    }
    
    // Get voice note
    const notes = await db
      .select()
      .from(voiceNotes)
      .where(eq(voiceNotes.id, voiceNoteId));
    
    if (notes.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Voice note not found',
      };
      return res.status(404).json(response);
    }
    
    const note = notes[0];
    
    // Generate explanation through Sarah
    const sarahRequest: SarahExplainRequest = {
      rockyFacts: note.rockyFacts as any,
      audience: audience as SarahAudience,
      tone: tone as SarahTone,
    };
    
    const sarahResult = await sarahService.explainRockyFacts(sarahRequest);
    
    if (!sarahResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Sarah explanation failed',
      };
      return res.status(500).json(response);
    }
    
    // Store explanation in database
    const [inserted] = await db
      .insert(sarahExplanations)
      .values({
        voiceNoteId,
        audience,
        tone,
        explanation: sarahResult.explanation as any,
        rockyFactsVersion: note.rockyFactsVersion,
        generatedAt: sarahResult.explanation.generatedAt,
        processingTimeMs: sarahResult.processingTimeMs,
      })
      .returning();
    
    const response: ApiResponse<any> = {
      success: true,
      data: {
        ...sarahResult,
        explanationId: inserted.id,
      },
      message: 'Explanation generated by Sarah',
    };
    res.json(response);
  } catch (error) {
    console.error('Error generating explanation:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * GET /voice-notes/:id - Get voice note with all data
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const voiceNoteId = parseInt(req.params.id);
    
    if (isNaN(voiceNoteId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid voice note ID',
      };
      return res.status(400).json(response);
    }
    
    // Get voice note
    const notes = await db
      .select()
      .from(voiceNotes)
      .where(eq(voiceNotes.id, voiceNoteId));
    
    if (notes.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Voice note not found',
      };
      return res.status(404).json(response);
    }
    
    const note = notes[0];
    
    // Get all explanations for this voice note
    const explanations = await db
      .select()
      .from(sarahExplanations)
      .where(eq(sarahExplanations.voiceNoteId, voiceNoteId));
    
    const response: ApiResponse<typeof note & { explanations: typeof explanations }> = {
      success: true,
      data: {
        ...note,
        explanations,
      },
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching voice note:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * PATCH /voice-notes/:id/edit - Edit Natural Notes
 * 
 * Allows editing of the verbatim transcript.
 * Triggers re-processing through Rocky.
 */
router.patch('/:id/edit', async (req: Request, res: Response) => {
  try {
    const voiceNoteId = parseInt(req.params.id);
    const { editedNotes } = req.body;
    
    if (isNaN(voiceNoteId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid voice note ID',
      };
      return res.status(400).json(response);
    }
    
    if (!editedNotes) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'editedNotes is required',
      };
      return res.status(400).json(response);
    }
    
    // Get voice note
    const notes = await db
      .select()
      .from(voiceNotes)
      .where(eq(voiceNotes.id, voiceNoteId));
    
    if (notes.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Voice note not found',
      };
      return res.status(404).json(response);
    }
    
    const note = notes[0];
    
    // Re-process through Rocky with edited notes
    const rockyRequest: RockyProcessRequest = {
      sessionId: note.sessionId,
      naturalNotes: editedNotes,
    };
    
    const rockyResult = await rockyService.processNaturalNotes(rockyRequest);
    
    if (!rockyResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Rocky re-processing failed',
      };
      return res.status(500).json(response);
    }
    
    // Update database
    const [updated] = await db
      .update(voiceNotes)
      .set({
        naturalNotesEdited: editedNotes,
        naturalNotesHash: rockyResult.rockyFacts.naturalNotesHash,
        rockyFacts: rockyResult.rockyFacts as any,
        automaticNotes: rockyResult.automaticNotes as any,
        engineerBasics: rockyResult.engineerBasics as any,
        rockyProcessedAt: rockyResult.rockyFacts.processedAt,
        rockyProcessingTimeMs: rockyResult.processingTimeMs,
        updatedAt: new Date(),
      })
      .where(eq(voiceNotes.id, voiceNoteId))
      .returning();
    
    const response: ApiResponse<any> = {
      success: true,
      data: {
        ...rockyResult,
        voiceNoteId: updated.id,
      },
      message: 'Natural notes edited and re-processed through Rocky',
    };
    res.json(response);
  } catch (error) {
    console.error('Error editing voice notes:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
