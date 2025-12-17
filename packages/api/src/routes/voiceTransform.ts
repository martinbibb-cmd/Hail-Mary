/**
 * Voice Notes Transform Routes
 * 
 * Endpoints for transforming raw voice transcripts into structured formats.
 * Splits "auto notes" vs "natural notes" and outputs "basic engineer notes".
 */

import { Router, Request, Response } from 'express';
import type { ApiResponse } from '@hail-mary/shared';
import { rockyService } from '../services/rocky.service';

const router = Router();

/**
 * POST /api/voice/transform - Transform raw transcript into structured formats
 * 
 * Input: { rawTranscript, rawNotes, mode: "engineer-basic" | "split-auto-natural" }
 * Output: { autoNotes, naturalNotes, engineerBasics[] }
 */
router.post('/transform', async (req: Request, res: Response) => {
  try {
    const { rawTranscript, rawNotes, mode } = req.body;
    
    const textToProcess = rawTranscript || rawNotes;
    
    if (!textToProcess || !textToProcess.trim()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'rawTranscript or rawNotes is required',
      };
      return res.status(400).json(response);
    }
    
    const transformMode = mode || 'engineer-basic';
    
    // Process through Rocky to get structured output
    const rockyResult = await rockyService.processNaturalNotes({
      sessionId: 0, // Temporary session for API-only processing
      naturalNotes: textToProcess,
      language: 'en-GB',
    });
    
    if (!rockyResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to process transcript',
      };
      return res.status(500).json(response);
    }
    
    // Build response based on mode
    const result: any = {};
    
    if (transformMode === 'split-auto-natural' || transformMode === 'engineer-basic') {
      // Natural notes - the verbatim transcript
      result.naturalNotes = textToProcess;
      
      // Auto notes - Rocky's structured automatic notes
      result.autoNotes = rockyResult.automaticNotes;
      
      // Engineer basics - Rocky's fixed format output
      result.engineerBasics = rockyResult.engineerBasics.basics;
    }
    
    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Voice transform error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Transform failed',
    };
    res.status(500).json(response);
  }
});

export default router;
