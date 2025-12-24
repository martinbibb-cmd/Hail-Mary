/**
 * Customer Summary Export (v2 spine)
 *
 * POST /api/customer/summary
 * body: { visitId: string, tone?: "calm" | string }
 *
 * Rules:
 * - Read latest TimelineEvent(type="engineer_output") for this visit.
 * - Optional: include property address for context.
 * - Generate customer-friendly markdown summary derived ONLY from that Engineer output.
 * - No KB calls. No new technical claims. No surprises.
 */

import { Router, type Request, type Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/drizzle-client';
import { spineProperties, spineTimelineEvents, spineVisits } from '../db/drizzle-schema';
import { requireAuth } from '../middleware/auth.middleware';
import { workerClient } from '../services/workerClient.service';

const router = Router();

type CustomerSummaryBody = {
  visitId?: unknown;
  tone?: unknown;
};

type EngineerFactCitation = { docId: string; title: string; ref: string };
type EngineerFactConfidence = 'high' | 'medium' | 'low';
type EngineerFact = {
  text: string;
  citations: EngineerFactCitation[];
  confidence?: EngineerFactConfidence;
  verified?: boolean;
};

type EngineerOutputContext = {
  summary: string;
  facts: EngineerFact[];
  questions: string[];
  concerns: string[];
};

function asNonEmptyString(input: unknown): string | null {
  return typeof input === 'string' && input.trim() ? input.trim() : null;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}

function toStringArray(input: unknown, maxItems: number): string[] {
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
}

function toEngineerOutputContext(payload: unknown): EngineerOutputContext {
  if (!isRecord(payload)) return { summary: '', facts: [], questions: [], concerns: [] };

  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';

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

function formatPropertyAddress(addr: { addressLine1: string; town?: string | null; postcode: string }): string {
  const parts = [addr.addressLine1, addr.town, addr.postcode].filter((x) => typeof x === 'string' && x.trim());
  return parts.join(', ');
}

function markdownTemplate(args: {
  title: string;
  engineer: EngineerOutputContext;
  propertyAddress?: string | null;
}): { title: string; summaryMarkdown: string } {
  const engineer = args.engineer;
  const factTexts = engineer.facts.map((f) => f.text).filter(Boolean).slice(0, 10);
  const questions = engineer.questions.slice(0, 10);
  const concerns = engineer.concerns.slice(0, 10);

  const introLine = args.propertyAddress ? `**Property:** ${args.propertyAddress}` : null;
  const body = [
    introLine,
    '',
    '## What we found',
    engineer.summary ? engineer.summary : '_No summary was provided in the latest Engineer output._',
    '',
    factTexts.length > 0 ? `### Key points\n${factTexts.map((t) => `- ${t}`).join('\n')}` : '### Key points\n- _None listed in the Engineer output._',
    '',
    '## What we recommend',
    concerns.length > 0
      ? [
          'These are the items flagged as concerns in the Engineer output (no added assumptions):',
          ...concerns.map((t) => `- ${t}`),
        ].join('\n')
      : '- _No concerns were listed in the Engineer output._',
    '',
    '## Next steps',
    questions.length > 0 ? questions.map((t) => `- ${t}`).join('\n') : '- _No next steps were listed in the Engineer output._',
    '',
  ]
    .filter((x) => x !== null)
    .join('\n')
    .trim();

  return { title: args.title, summaryMarkdown: body };
}

router.post('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as CustomerSummaryBody;
    const visitId = asNonEmptyString(body.visitId);
    if (!visitId) return res.status(400).json({ success: false, error: 'visitId is required' });

    const accountId = req.user?.accountId;
    if (!accountId) return res.status(401).json({ success: false, error: 'User account not properly configured' });

    const tone = asNonEmptyString(body.tone) ?? 'calm';

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

    if (!visitRows[0]) return res.status(404).json({ success: false, error: 'Visit not found' });

    const propertyAddress = formatPropertyAddress({
      addressLine1: visitRows[0].addressLine1,
      town: visitRows[0].town,
      postcode: visitRows[0].postcode,
    });

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

    if (!engineerRows[0]) {
      return res.status(409).json({
        success: false,
        code: 'run_engineer_first',
        error: 'Run Engineer first',
      });
    }

    const engineer = toEngineerOutputContext(engineerRows[0].payload);
    const baseTitle = 'Home heating survey summary';
    const title = propertyAddress ? `${baseTitle} — ${propertyAddress}` : baseTitle;

    // 3) Call worker for customer summary generation
    try {
      const workerResponse = await workerClient.callCustomerSummary({
        tone,
        propertyAddress,
        engineer,
      });

      if (workerResponse.success) {
        return res.json({
          success: true,
          data: {
            title: workerResponse.title || title,
            summaryMarkdown: workerResponse.summaryMarkdown,
          },
        });
      } else {
        console.warn('Worker customer summary failed, falling back to template:', workerResponse);
        const out = markdownTemplate({ title, engineer, propertyAddress });
        return res.json({ success: true, data: out, warning: 'worker_failed_fallback_template' });
      }
    } catch (error) {
      console.error('Worker customer summary call error:', error);
      const out = markdownTemplate({ title, engineer, propertyAddress });
      return res.json({ success: true, data: out, warning: 'worker_error_fallback_template' });
    }
  } catch (error) {
    console.error('Customer summary error:', error);
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Customer summary failed' });
  }
});

export default router;

