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

const router = Router();

function asNonEmptyString(input: unknown): string | null {
  return typeof input === 'string' && input.trim() ? input.trim() : null;
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
 * body: { visitId: string, message: string }
 *
 * Sarah reads:
 * - property summary
 * - latest engineer_output for this visit (required)
 * - optional recent transcripts for this visit
 *
 * Returns: { reply: string }
 *
 * Guardrails:
 * - No DB writes (read-only)
 * - Must not claim measurements/compliance not in Engineer output
 * - Must not run Engineer
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const visitId = asNonEmptyString(req.body?.visitId);
    const message = asNonEmptyString(req.body?.message);
    if (!visitId) return res.status(400).json({ error: 'visitId is required' });
    if (!message) return res.status(400).json({ error: 'message is required' });

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

    // 2) Load latest engineer_output for this visit (required)
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

    if (!engineerRows[0]) {
      return res.status(409).json({
        error: 'No engineer_output exists for this visit yet. Run Engineer first.',
      });
    }

    // 3) Optional transcripts (recent)
    const transcriptRows = await db
      .select({
        ts: spineTimelineEvents.ts,
        payload: spineTimelineEvents.payload,
      })
      .from(spineTimelineEvents)
      .where(and(eq(spineTimelineEvents.visitId, visitId), inArray(spineTimelineEvents.type, ['transcript'])))
      .orderBy(desc(spineTimelineEvents.ts))
      .limit(12);

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

    const engineerContext = {
      engineerEventId: engineerRows[0].id,
      engineerEventAt: engineerRows[0].ts.toISOString(),
      engineerOutput: engineerRows[0].payload,
    };

    // 4) Call LLM (fallback to safe template response if no keys)
    const openaiKey = (process.env.OPENAI_API_KEY || (await getOpenaiApiKey()))?.trim();
    if (!openaiKey) {
      const reply =
        `Based on the latest Engineer run, here’s what I can say:\n\n` +
        `- I can explain the Engineer summary/facts and suggest next checks.\n` +
        `- I can’t add new measurements or compliance claims beyond what Engineer recorded.\n\n` +
        `Ask a specific question about a bullet in the Engineer output, and I’ll walk through it.`;
      return res.json({ reply });
    }

    const system = [
      'You are Sarah, a read-only assistant for a site survey visit.',
      'You must ONLY use the provided context. If something is not in context, say you do not know and suggest what to check next.',
      'You MUST NOT create or edit timeline events, and you MUST NOT re-run Engineer.',
      'You MUST NOT invent measurements, model numbers, compliance claims, or pass/fail statements. If asked, respond with uncertainty and list what evidence would be needed.',
      'Your job: explain the Engineer output in plain English, answer questions about this visit, and suggest next survey steps.',
      'Keep the answer concise and actionable. Use bullet points when helpful.',
    ].join('\n');

    const user = [
      'Context:',
      `Property summary: ${JSON.stringify(propertySummary)}`,
      `Latest engineer_output (facts): ${JSON.stringify(engineerContext)}`,
      transcripts.length > 0 ? `Recent transcripts (optional): ${JSON.stringify(transcripts)}` : 'Recent transcripts: none',
      '',
      `User question: ${message}`,
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
    const reply = typeof llmJson?.choices?.[0]?.message?.content === 'string' ? String(llmJson.choices[0].message.content).trim() : '';
    if (!reply) return res.status(503).json({ error: 'Sarah returned an empty response. Please try again.' });

    return res.json({ reply });
  } catch (error) {
    console.error('Sarah chat error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Sarah chat failed' });
  }
});

export default router;
