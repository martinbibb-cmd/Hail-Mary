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
import { getOpenaiApiKey } from '../services/workerKeys.service';
import { requireAuth } from '../middleware/auth.middleware';
import { kbSearch as kbSearchForAccount } from '../services/kbSearch.service';

const router = Router();

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
 * body: { visitId: string, message: string, useKnowledgeBase?: boolean }
 *
 * Sarah reads:
 * - property summary
 * - latest engineer_output for this visit (if any)
 * - optional recent transcripts for this visit
 * - optional Knowledge Base passages (if enabled)
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
    const visitId = asNonEmptyString(req.body?.visitId);
    const message = asNonEmptyString(req.body?.message);
    if (!visitId) return res.status(400).json({ error: 'visitId is required' });
    if (!message) return res.status(400).json({ error: 'message is required' });
    const useKnowledgeBase = asBoolean(req.body?.useKnowledgeBase) ?? true;

    const accountId = req.user?.accountId;
    if (!accountId) return res.status(401).json({ error: 'User account not properly configured' });
    const accountIdStrict = accountId;

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

    // 2) Load latest engineer_output for this visit (optional)
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

    // 3) Optional transcripts (recent)
    const transcriptRows = await db
      .select({
        ts: spineTimelineEvents.ts,
        payload: spineTimelineEvents.payload,
      })
      .from(spineTimelineEvents)
      .where(and(eq(spineTimelineEvents.visitId, visitId), inArray(spineTimelineEvents.type, ['transcript'])))
      .orderBy(desc(spineTimelineEvents.ts))
      .limit(3);

    const transcripts = transcriptRows
      .map((t) => ({
        occurredAt: t.ts.toISOString(),
        text: safeTextFromPayload(t.payload) ?? '',
      }))
      .filter((t) => t.text.trim().length > 0)
      .reverse(); // chronological

    const propertySummary = {
      addressLine1: visitRows[0].addressLine1,
      town: visitRows[0].town,
      postcode: visitRows[0].postcode,
      visitStartedAt: visitRows[0].startedAt.toISOString(),
    };

    const engineerContext = engineerRows[0]
      ? {
          engineerEventId: engineerRows[0].id,
          engineerEventAt: engineerRows[0].ts.toISOString(),
          engineerOutput: engineerRows[0].payload,
        }
      : null;

    // 4) KB retrieval
    const topK = 5;
    let kbError: string | null = null;
    let kbPassages: Array<{ title: string; docId: string; ref: string; text: string }> = [];
    if (useKnowledgeBase) {
      try {
        kbPassages = await kbSearchForAccount(accountIdStrict, message, topK);
      } catch (e) {
        kbError = e instanceof Error ? e.message : 'Knowledge Base unavailable';
        kbPassages = [];
      }
    }

    // If KB is enabled and we *successfully* found 0 sources, enforce the required UX:
    // Sarah must say "I can’t find a source in KB for that" and ask for missing detail.
    if (useKnowledgeBase && !kbError && kbPassages.length === 0) {
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

    // 5) Call LLM (fallback to safe template response if no keys)
    const openaiKey = (process.env.OPENAI_API_KEY || (await getOpenaiApiKey()))?.trim();
    if (!openaiKey) {
      const reply =
        `I can help answer questions using:\n` +
        `- This visit (property, Engineer output if available, transcripts)\n` +
        (useKnowledgeBase ? `- Knowledge Base (if documents exist)\n` : `- (Knowledge Base is OFF)\n`) +
        `\n` +
        `I can’t add new measurements or compliance claims beyond what was recorded in the timeline.\n\n` +
        `Ask a specific question and I’ll walk through it.`;
      return res.json({ reply, citations: [] });
    }

    const system = [
      'You are Sarah, a read-only assistant for a site survey visit.',
      '',
      'You will be given TWO separated contexts:',
      'A) Visit facts (property summary, latest engineer_output if any, and recent transcripts).',
      'B) Knowledge Base sources (technical docs).',
      '',
      'Behaviour rules:',
      '- Treat Visit facts and KB facts separately; never mix them up.',
      '- You must NOT invent site-specific measurements, model numbers, site conditions, or compliance claims not present in Visit facts.',
      '- You must NOT silently "upgrade" Engineer facts. If Engineer output is missing/unclear, say what is missing.',
      '- You must NOT write timeline events or run Engineer (read-only).',
      '',
      'Knowledge Base + citations rules:',
      '- Any technical claim taken from KB MUST be cited.',
      '- Use ONLY the provided KB source IDs (e.g. "S1"). Never invent document IDs/titles/refs.',
      '- If something is not supported by the provided KB sources, you MUST say so.',
      '',
      'Output format:',
      '- Return STRICT JSON (no markdown) with keys: {"reply": string, "citations": string[]}.',
      '- "citations" is a list of KB source IDs actually used (may be empty).',
      '',
      'Clarifications:',
      '- If the question needs missing details (e.g. boiler model, flue type, measured clearance), ask exactly ONE clarifying question.',
    ].join('\n');

    const kbBlock = useKnowledgeBase
      ? kbSources.length > 0
        ? [
            'Knowledge Base sources (use these for citations):',
            ...kbSources.map((s) => {
              const safe = String(s.text || '').replace(/\s+/g, ' ').trim();
              const clipped = safe.length > 1200 ? `${safe.slice(0, 1200)}…` : safe;
              return `- [${s.sourceId}] docId=${s.docId} title="${s.title}" ref=${s.ref} text="${clipped}"`;
            }),
          ].join('\n')
        : kbError
          ? `Knowledge Base sources: UNAVAILABLE (${kbError})`
          : 'Knowledge Base sources: NONE_FOUND'
      : 'Knowledge Base: DISABLED_BY_USER';

    const user = [
      'Visit context:',
      `Property summary: ${JSON.stringify(propertySummary)}`,
      `Latest engineer_output (if any): ${JSON.stringify(engineerContext)}`,
      transcripts.length > 0 ? `Recent transcripts (optional): ${JSON.stringify(transcripts)}` : 'Recent transcripts: none',
      '',
      kbBlock,
      '',
      `User question: ${message}`,
      '',
      'Response style:',
      '- If Knowledge Base is DISABLED_BY_USER, do not reference manuals/regulations and do not cite KB sources.',
      '- If answering from KB, phrase it explicitly (e.g. "From the <title>...").',
      '- If answering from the visit, phrase it explicitly (e.g. "From this visit...").',
    ].join('\n');

    const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.SARAH_OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!llmRes.ok) {
      const errorText = await llmRes.text();
      console.error('Sarah chat LLM error:', llmRes.status, errorText);
      return res.status(503).json({ error: 'Sarah is temporarily unavailable. Please try again.' });
    }

    const llmJson = (await llmRes.json()) as any;
    const content = typeof llmJson?.choices?.[0]?.message?.content === 'string' ? String(llmJson.choices[0].message.content).trim() : '';
    if (!content) return res.status(503).json({ error: 'Sarah returned an empty response. Please try again.' });

    // Parse strict JSON response; if parsing fails, fall back to raw content with no citations.
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }

    const reply = typeof parsed?.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : content;
    const citedIdsRaw = Array.isArray(parsed?.citations) ? parsed.citations : [];
    const citedIds = citedIdsRaw.filter((x: unknown) => typeof x === 'string' && /^S\d+$/.test(x));
    const citations = citedIds
      .map((id: string) => kbSources.find((s) => s.sourceId === id))
      .filter(Boolean)
      .map((s: any) => ({ title: s.title, docId: s.docId, ref: s.ref }));

    return res.json({ reply, citations });
  } catch (error) {
    console.error('Sarah chat error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Sarah chat failed' });
  }
});

export default router;
