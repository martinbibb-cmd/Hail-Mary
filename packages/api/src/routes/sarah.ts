/**
 * Sarah Explanation Layer Routes
 * 
 * Standalone API endpoints for Sarah explanation generation.
 * Sarah consumes Rocky's facts and generates human-readable explanations.
 */

import { Router, Request, Response } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type {
  ApiResponse,
  SarahExplainRequest,
  SarahProcessResult,
  SarahAudience,
  SarahTone,
  RockyFacts,
} from '@hail-mary/shared';
import { sarahService } from '../services/sarah.service';
import { db } from '../db/drizzle-client';
import { spineProperties, spineTimelineEvents, spineVisits } from '../db/drizzle-schema';
import { workerClient } from '../services/workerClient.service';
import { requireAuth } from '../middleware/auth.middleware';
import { kbSearch as kbSearchForAccount } from '../services/kbSearch.service';

const router = Router();

type EngineerFactCitation = { docId: string; title: string; ref: string };
type EngineerFactConfidence = 'high' | 'medium' | 'low';
type EngineerFact = {
  text: string;
  citations: EngineerFactCitation[];
  confidence?: EngineerFactConfidence;
  verified?: boolean;
};

function asNonEmptyString(input: unknown): string | null {
  return typeof input === 'string' && input.trim() ? input.trim() : null;
}

function asBoolean(input: unknown): boolean | null {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    const v = input.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return null;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}

function toEngineerExplainContext(payload: unknown): {
  summary: string;
  facts: EngineerFact[];
  questions: string[];
  concerns: string[];
} {
  if (!isRecord(payload)) return { summary: '', facts: [], questions: [], concerns: [] };

  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';

  const toStringArray = (input: unknown, maxItems: number): string[] => {
    if (!Array.isArray(input)) return [];
    const out: string[] = [];
    for (const v of input) {
      if (typeof v !== 'string') continue;
      const s = v.trim();
      if (!s) continue;
      out.push(s);
      if (out.length >= maxItems) break;
    }
    return out;
  };

  const factsRaw = Array.isArray(payload.facts) ? payload.facts : [];
  const facts: EngineerFact[] = [];
  for (const f of factsRaw) {
    if (!isRecord(f)) continue;
    const text = typeof f.text === 'string' ? f.text.trim() : '';
    if (!text) continue;

    const citationsRaw = Array.isArray(f.citations) ? f.citations : [];
    const citations: EngineerFactCitation[] = citationsRaw
      .filter(isRecord)
      .map((c) => ({
        docId: typeof c.docId === 'string' ? c.docId.trim() : String(c.docId ?? '').trim(),
        title: typeof c.title === 'string' ? c.title.trim() : String(c.title ?? '').trim(),
        ref: typeof c.ref === 'string' ? c.ref.trim() : String(c.ref ?? '').trim(),
      }))
      .filter((c) => c.docId && c.title && c.ref)
      .slice(0, 6);

    const confidence =
      f.confidence === 'high' || f.confidence === 'medium' || f.confidence === 'low' ? f.confidence : undefined;
    const verified = typeof f.verified === 'boolean' ? f.verified : undefined;

    facts.push({ text, citations, confidence, verified });
    if (facts.length >= 12) break;
  }

  const questions = toStringArray(payload.questions, 12);
  const concerns = toStringArray(payload.concerns, 12);

  return { summary, facts, questions, concerns };
}

function safeTextFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const candidates = [p.text, p.note, p.content, p.summary];
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

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

/**
 * v2 Spine: Sarah Chat (read-only intelligence)
 *
 * POST /api/sarah/chat
 * body: { visitId: string, message: string, mode?: "engineer_explain" | "visit_kb", useKnowledgeBase?: boolean }
 *
 * Sarah reads:
 * - property summary
 * - latest engineer_output for this visit (required in engineer_explain mode)
 * - optional Knowledge Base passages (only in visit_kb mode)
 *
 * Returns: { reply: string, citations: Array<{ docId: string; title: string; ref: string }> }
 *
 * Guardrails:
 * - No DB writes (read-only)
 * - Must not claim measurements/compliance not in Engineer output
 * - Must not run Engineer
 */
router.post('/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const addressId = asNonEmptyString(req.body?.addressId);
    let visitId = asNonEmptyString(req.body?.visitId);
    const message = asNonEmptyString(req.body?.message);

    // GOLDEN PATH: addressId is required, visitId is optional
    if (!addressId) return res.status(400).json({ error: 'addressId is required' });
    if (!message) return res.status(400).json({ error: 'message is required' });

    const modeRaw = asNonEmptyString(req.body?.mode);
    const mode = (modeRaw === 'visit_kb' || modeRaw === 'engineer_explain' ? modeRaw : null) ?? 'engineer_explain';
    const useKnowledgeBase = asBoolean(req.body?.useKnowledgeBase) ?? true; // only used for explicit visit_kb mode

    const accountId = req.user?.accountId;
    if (!accountId) return res.status(401).json({ error: 'User account not properly configured' });
    const accountIdStrict = accountId;

    // GOLDEN PATH: If no visitId provided, create a system visit silently
    if (!visitId) {
      const visitCreated = await db
        .insert(spineVisits)
        .values({
          propertyId: addressId,
          startedAt: new Date(),
        })
        .returning({ id: spineVisits.id });
      visitId = visitCreated[0]?.id;
      if (!visitId) throw new Error('Failed to create system visit');
    }

    // 1) Load property summary + visit basics
    const visitRows = await db
      .select({
        visitId: spineVisits.id,
        startedAt: spineVisits.startedAt,
        addressLine1: spineProperties.addressLine1,
        town: spineProperties.town,
        postcode: spineProperties.postcode,
      })
      .from(spineVisits)
      .innerJoin(spineProperties, eq(spineVisits.propertyId, spineProperties.id))
      .where(eq(spineVisits.id, visitId))
      .limit(1);

    if (!visitRows[0]) return res.status(404).json({ error: 'Visit not found' });

    // 2) Load latest engineer_output for this visit
    const engineerRows = await db
      .select({
        id: spineTimelineEvents.id,
        ts: spineTimelineEvents.ts,
        payload: spineTimelineEvents.payload,
      })
      .from(spineTimelineEvents)
      .where(and(eq(spineTimelineEvents.visitId, visitId), eq(spineTimelineEvents.type, 'engineer_output')))
      .orderBy(desc(spineTimelineEvents.ts))
      .limit(1);

    const propertySummary = {
      addressLine1: visitRows[0].addressLine1,
      town: visitRows[0].town,
      postcode: visitRows[0].postcode,
      visitStartedAt: visitRows[0].startedAt.toISOString(),
    };

    const engineerExplain = engineerRows[0]
      ? {
          engineerEventId: engineerRows[0].id,
          engineerEventAt: engineerRows[0].ts.toISOString(),
          engineer: toEngineerExplainContext(engineerRows[0].payload),
        }
      : null;

    // Required for the new default behavior: Sarah explains Engineer output only.
    if (mode === 'engineer_explain' && !engineerExplain) {
      return res.json({ reply: 'Run Engineer first so I have something to explain.', citations: [] });
    }

    // 3) KB retrieval (legacy / explicit mode only)
    const topK = 5;
    let kbError: string | null = null;
    let kbPassages: Array<{ title: string; docId: string; ref: string; text: string }> = [];
    if (mode === 'visit_kb' && useKnowledgeBase) {
      try {
        kbPassages = await kbSearchForAccount(accountIdStrict, message, topK);
      } catch (e) {
        kbError = e instanceof Error ? e.message : 'Knowledge Base unavailable';
        kbPassages = [];
      }
    }

    // If KB is enabled and we *successfully* found 0 sources, enforce the required UX:
    // Sarah must say "I can’t find a source in KB for that" and ask for missing detail.
    if (mode === 'visit_kb' && useKnowledgeBase && !kbError && kbPassages.length === 0) {
      const reply =
        `I can’t find a source in KB for that.\n\n` +
        `What’s the exact model (e.g. “Worcester Greenstar 4000 25/30/35”) and the flue type/route (horizontal/vertical, and where it terminates)?`;
      return res.json({ reply, citations: [] });
    }

    const kbSources = kbPassages.map((p, idx) => ({
      sourceId: `S${idx + 1}`,
      docId: p.docId,
      title: p.title,
      ref: p.ref,
      text: p.text,
    }));

    // 4) Call worker for Sarah chat
    try {
      const workerResponse = await workerClient.callSarahChat({
        visitContext: {
          property: propertySummary,
          visit: { startedAt: visitRows[0].startedAt.toISOString() },
          engineer: engineerExplain,
          kbSources,
        },
        message,
        mode,
        useKnowledgeBase,
      });

      if (workerResponse.success) {
        return res.json({ reply: workerResponse.reply, citations: workerResponse.citations });
      } else {
        console.error('Worker Sarah chat failed:', workerResponse);
        return res.status(503).json({ error: 'Sarah is temporarily unavailable. Please try again.' });
      }
    } catch (error) {
      console.error('Worker Sarah chat call error:', error);
      return res.status(503).json({ error: 'Sarah is temporarily unavailable. Please try again.' });
    }
  } catch (error) {
    console.error('Sarah chat error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Sarah chat failed' });
  }
});

export default router;
