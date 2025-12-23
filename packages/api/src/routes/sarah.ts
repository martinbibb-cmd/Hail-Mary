/**
 * Sarah Explanation Layer Routes
 * 
 * Standalone API endpoints for Sarah explanation generation.
 * Sarah consumes Rocky's facts and generates human-readable explanations.
 */

import { Router, Request, Response } from 'express';
import type {
  ApiResponse,
  SarahExplainRequest,
  SarahProcessResult,
  SarahAudience,
  SarahTone,
  RockyFacts,
} from '@hail-mary/shared';
import { sarahService } from '../services/sarah.service';

const router = Router();

function coerceToRockyFacts(input: any): { rockyFacts: RockyFacts | null; warnings: string[] } {
  const warnings: string[] = [];
  if (!input || typeof input !== 'object') {
    return { rockyFacts: null, warnings };
  }

  // Common wrapper shapes we see from the UI:
  // - ApiResponse<RockyProcessResult>: { success, data: { rockyFacts: ... } }
  // - RockyProcessResult: { rockyFacts: ... }
  // - RockyFacts: { version, facts, completeness, missingData, ... }
  let candidate: any = input;
  if (candidate.data && typeof candidate.data === 'object') candidate = candidate.data;
  if (candidate.rockyFacts && typeof candidate.rockyFacts === 'object') candidate = candidate.rockyFacts;

  // Legacy/misaligned "smoke test" shape (customerInfo/propertyDetails/etc)
  if (!candidate.facts && (candidate.customerInfo || candidate.propertyDetails || candidate.existingSystem || candidate.measurements)) {
    warnings.push('Input looks like a legacy RockyFacts shape; normalized into `facts.*` buckets.');
    const name = candidate.customerInfo?.name as string | undefined;
    const [firstName, ...rest] = (name || '').trim().split(/\s+/).filter(Boolean);
    const lastName = rest.length > 0 ? rest.join(' ') : undefined;

    candidate = {
      version: candidate.version ?? '1.0.0',
      sessionId: candidate.sessionId ?? -1,
      processedAt: candidate.processedAt ?? new Date(),
      naturalNotesHash: candidate.naturalNotesHash ?? 'unknown',
      facts: {
        customer: firstName || lastName ? { firstName, lastName } : {},
        property: candidate.propertyDetails ?? {},
        existingSystem: candidate.existingSystem ?? {},
        measurements: candidate.measurements ?? {},
        materials: candidate.materials ?? [],
        hazards: candidate.hazards ?? [],
        requiredActions: candidate.requiredActions ?? undefined,
      },
      completeness: candidate.completeness ?? {
        customerInfo: 0,
        propertyDetails: 0,
        existingSystem: 0,
        measurements: 0,
        overall: candidate.completeness?.overall ?? 0,
      },
      missingData: candidate.missingData ?? [],
    };
  }

  // Must have at least version + facts to be useful. Completeness/missingData are optional (service will default).
  if (!candidate || typeof candidate !== 'object') return { rockyFacts: null, warnings };
  if (!candidate.facts || typeof candidate.facts !== 'object') return { rockyFacts: null, warnings };

  return { rockyFacts: candidate as RockyFacts, warnings };
}

/**
 * POST /api/sarah/explain - Generate explanation from RockyFacts
 * 
 * Input: { rockyOutput, customerContext?, tone? }
 * Output: SarahProcessResult with narrative, nextQuestions
 */
router.post('/explain', async (req: Request, res: Response) => {
  try {
    const { rockyOutput, rockyFacts, customerContext, tone, audience, message, conversationHistory } = req.body;
    
    // If this is a chat message (no rocky facts), handle as chat
    if (message && !rockyFacts && !rockyOutput) {
      const effectiveAudience: SarahAudience = audience || 'customer';
      const effectiveTone: SarahTone = tone || 'friendly';
      
      const chatResult = await sarahService.handleChatMessage(
        message,
        conversationHistory,
        effectiveAudience,
        effectiveTone
      );
      
      const response: ApiResponse<SarahProcessResult> = {
        success: chatResult.success,
        data: chatResult,
      };
      
      return res.json(response);
    }
    
    // Accept either rockyOutput or rockyFacts
    const raw = rockyFacts ?? req.body?.facts ?? rockyOutput ?? req.body?.rockyResult ?? req.body;
    const coerced = coerceToRockyFacts(raw);
    const facts = coerced.rockyFacts;

    if (!facts) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Missing rockyFacts. Paste Rocky output: `result.rockyFacts` (not the full API response).',
      };
      return res.status(400).json(response);
    }
    
    // Default audience and tone
    const effectiveAudience: SarahAudience = audience || 'customer';
    const effectiveTone: SarahTone = tone || 'professional';
    
    // Build Sarah request
    const sarahRequest: SarahExplainRequest = {
      rockyFacts: facts,
      audience: effectiveAudience,
      tone: effectiveTone,
    };
    
    // Process through Sarah
    const sarahResult = await sarahService.explainRockyFacts(sarahRequest);
    if (coerced.warnings.length > 0) {
      sarahResult.warnings = [...new Set([...(sarahResult.warnings || []), ...coerced.warnings])];
    }
    
    const response: ApiResponse<SarahProcessResult> = {
      success: sarahResult.success,
      data: sarahResult,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Sarah explanation error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Sarah explanation failed',
    };
    res.status(500).json(response);
  }
});

export default router;
