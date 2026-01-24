/**
 * Engineer Routes (v2 spine)
 *
 * Manual-only: one tap → one run → one TimelineEvent(type="engineer_output")
 *
 * POST /api/engineer/run
 * body: { visitId: string, mode?: string }
 */

import { Router, type Request, type Response } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/drizzle-client";
import { spineProperties, spineTimelineEvents, spineVisits } from "../db/drizzle-schema";
import { requireAuth } from "../middleware/auth.middleware";
import { kbSearch as kbSearchForAccount, type KbPassage } from "../services/kbSearch.service";
import { workerClient } from "../services/workerClient.service";

const router = Router();

type EngineerRunBody = {
  addressId?: unknown;
  visitId?: unknown;
  mode?: unknown;
};

type EngineerFactCitation = {
  docId: string;
  title: string;
  ref: string;
};

type EngineerFactConfidence = "high" | "medium" | "low";

type EngineerFact = {
  text: string;
  citations: EngineerFactCitation[];
  confidence?: EngineerFactConfidence;
  verified?: boolean;
};

type EngineerOutputPayload = {
  summary: string;
  facts: EngineerFact[];
  questions: string[];
  concerns: string[];
};

type EngineerDiffPayload = {
  addedFacts: string[];
  removedFacts: string[];
  resolvedQuestions: string[];
  newConcerns: string[];
  summary: string;
};

type EngineerOutputForDiff = {
  facts: string[];
  questions: string[];
  concerns: string[];
};

type EngineerContext = {
  property: { address: string; postcode: string };
  visit: { startedAt: string };
  transcripts: Array<{ text: string; occurredAt: string }>;
  notes: string[];
};

function asNonEmptyString(input: unknown): string | null {
  return typeof input === "string" && input.trim() ? input.trim() : null;
}

function safeTextFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const candidates = [p.text, p.note, p.content, p.summary];
  for (const v of candidates) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function uniqStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = normalizeWhitespace(String(raw || ""));
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function deriveTechnicalQueries(context: EngineerContext, mode: string): string[] {
  const text = normalizeWhitespace(
    [
      context.property.address,
      context.property.postcode,
      ...context.notes,
      ...context.transcripts.map((t) => t.text),
    ].join("\n")
  );

  const queries: string[] = [];

  const boilerBrandRe =
    /\b(worcester|bosch|greenstar|vaillant|ecotec|ideal|logic|vokera|baxi|potterton|viessmann|alpha|ferroli|intergas|ariston)\b/gi;
  const foundBrands = uniqStrings(Array.from(text.matchAll(boilerBrandRe)).map((m) => m[0]));
  const modelLikeRe = /\b([A-Za-z][A-Za-z0-9-]{1,})\s?(\d{2,4}(?:\/\d{2,4})?)\b/g;
  const foundModelLike = uniqStrings(Array.from(text.matchAll(modelLikeRe)).map((m) => `${m[1]} ${m[2]}`));

  const hasFlue = /\bflue|terminal|concentric|twin\s*pipe|plume|condensate\b/i.test(text);
  const hasClearance = /\bclearance|distance|separation|\bmm\b|\bcm\b|\bm\b/i.test(text);
  const hasReg =
    /\bBS\s*5440\b|\bBS\s*6798\b|\bPart\s*J\b|building regulations|GSIUR|IGEM|gas safe\b/i.test(text);

  if (hasFlue) {
    queries.push("flue terminal siting clearances");
    if (hasClearance) queries.push("flue terminal minimum clearances to openings windows doors");
    if (hasReg) queries.push("BS 5440 flue terminal clearances");
  }

  if (/\bcondensate\b/i.test(text)) {
    queries.push("condensate disposal requirements");
    if (hasReg) queries.push("BS 6798 condensate discharge guidance");
  }

  if (foundBrands.length > 0) {
    for (const b of foundBrands.slice(0, 2)) {
      queries.push(`${b} boiler installation manual flue clearances`);
    }
  }

  if (foundModelLike.length > 0) {
    for (const m of foundModelLike.slice(0, 2)) {
      queries.push(`${m} installation manual flue clearances`);
    }
  }

  if (hasReg && !hasFlue) queries.push("gas boiler installation regulations clearances");
  if (mode && mode !== "survey") queries.push(`${mode} heating survey checklist requirements`);

  if (queries.length === 0) queries.push("boiler flue clearances installation requirements");

  return uniqStrings(queries).slice(0, 6);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === "object" && !Array.isArray(input);
}

function coerceStringArray(input: unknown, maxItems: number): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function coerceFactTextArray(input: unknown, maxItems: number): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v === "string") {
      const s = normalizeWhitespace(v);
      if (s) out.push(s);
    } else if (isRecord(v) && typeof v.text === "string") {
      const s = normalizeWhitespace(v.text);
      if (s) out.push(s);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

function toEngineerOutputForDiff(payload: unknown): EngineerOutputForDiff | null {
  if (!isRecord(payload)) return null;
  const facts = coerceFactTextArray(payload.facts, 50);
  const questions = coerceStringArray(payload.questions, 50).map((q) => normalizeWhitespace(q));
  const concerns = coerceStringArray(payload.concerns, 50).map((c) => normalizeWhitespace(c));

  return {
    facts: uniqStrings(facts),
    questions: uniqStrings(questions),
    concerns: uniqStrings(concerns),
  };
}

function computeEngineerDiff(prev: EngineerOutputForDiff, next: EngineerOutputForDiff): EngineerDiffPayload {
  const key = (s: string) => normalizeWhitespace(s).toLowerCase();
  const prevFacts = prev.facts.map(normalizeWhitespace).filter(Boolean);
  const nextFacts = next.facts.map(normalizeWhitespace).filter(Boolean);
  const prevQuestions = prev.questions.map(normalizeWhitespace).filter(Boolean);
  const nextQuestions = next.questions.map(normalizeWhitespace).filter(Boolean);
  const prevConcerns = prev.concerns.map(normalizeWhitespace).filter(Boolean);
  const nextConcerns = next.concerns.map(normalizeWhitespace).filter(Boolean);

  const prevFactSet = new Set(prevFacts.map(key));
  const nextFactSet = new Set(nextFacts.map(key));
  const prevQSet = new Set(prevQuestions.map(key));
  const nextQSet = new Set(nextQuestions.map(key));
  const prevConcernSet = new Set(prevConcerns.map(key));
  const nextConcernSet = new Set(nextConcerns.map(key));

  const addedFacts = nextFacts.filter((f) => !prevFactSet.has(key(f)));
  const removedFacts = prevFacts.filter((f) => !nextFactSet.has(key(f)));
  const resolvedQuestions = prevQuestions.filter((q) => !nextQSet.has(key(q)));
  const newConcerns = nextConcerns.filter((c) => !prevConcernSet.has(key(c)));

  const parts: string[] = [];
  if (addedFacts.length) parts.push(`+${addedFacts.length} fact${addedFacts.length === 1 ? "" : "s"}`);
  if (removedFacts.length) parts.push(`-${removedFacts.length} fact${removedFacts.length === 1 ? "" : "s"}`);
  if (resolvedQuestions.length)
    parts.push(`${resolvedQuestions.length} question${resolvedQuestions.length === 1 ? "" : "s"} resolved`);
  if (newConcerns.length) parts.push(`+${newConcerns.length} concern${newConcerns.length === 1 ? "" : "s"}`);

  const summary = parts.length > 0 ? `Engineer update: ${parts.join(", ")}.` : "Engineer update: No changes detected vs previous run.";

  return {
    addedFacts,
    removedFacts,
    resolvedQuestions,
    newConcerns,
    summary,
  };
}

function coerceConfidence(input: unknown): EngineerFactConfidence | undefined {
  if (input === "high" || input === "medium" || input === "low") return input;
  return undefined;
}

function isUnverifiedFact(text: string): boolean {
  return /^unverified\b/i.test(text.trim());
}

function normalizeEngineerFactsFromLlm(
  llmFacts: unknown,
  kbSourcesById: Map<string, { title: string; docId: string; ref: string }>
): EngineerFact[] {
  if (!Array.isArray(llmFacts)) return [];

  const out: EngineerFact[] = [];
  for (const raw of llmFacts) {
    if (!isRecord(raw)) continue;
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!text) continue;

    const citedIds = coerceStringArray(raw.citations, 6).filter((id) => /^S\d+$/.test(id));
    const citations: EngineerFactCitation[] = citedIds
      .map((id) => kbSourcesById.get(id))
      .filter(Boolean)
      .map((s) => ({ docId: s!.docId, title: s!.title, ref: s!.ref }));

    const normalizedText =
      citations.length > 0 || isUnverifiedFact(text) ? text : `Unverified – site check required: ${text}`;

    // Optional hints from the LLM; we still enforce our own guardrails.
    const confidence = coerceConfidence(raw.confidence);
    const verifiedHint = typeof raw.verified === "boolean" ? raw.verified : undefined;
    const verified =
      citations.length === 0 || isUnverifiedFact(normalizedText) ? false : verifiedHint ?? true;

    out.push({ text: normalizedText, citations, confidence, verified });
    if (out.length >= 12) break;
  }
  return out;
}

function buildEngineerFallbackOutput(context: EngineerContext, mode: string): EngineerOutputPayload {
  const transcriptCount = context.transcripts.length;
  const notesCount = context.notes.length;

  const facts: EngineerFact[] = [];
  if (transcriptCount > 0) {
    facts.push({
      text: `Unverified – site check required: Captured ${transcriptCount} transcript event${transcriptCount === 1 ? "" : "s"}.`,
      citations: [],
      confidence: "low",
      verified: false,
    });
  }
  if (notesCount > 0) {
    facts.push({
      text: `Unverified – site check required: Captured ${notesCount} note event${notesCount === 1 ? "" : "s"}.`,
      citations: [],
      confidence: "low",
      verified: false,
    });
  }
  if (facts.length === 0) {
    facts.push({
      text: "Unverified – site check required: No transcript or note events yet for this visit.",
      citations: [],
      confidence: "low",
      verified: false,
    });
  }

  const questions: string[] = [];
  if (transcriptCount === 0) questions.push("No transcripts found — was the companion recording started?");
  questions.push("What is the exact boiler make/model and flue type/route?");
  questions.push("What measurements (mm) were taken for any relevant clearances?");

  const concerns: string[] = [];
  if (!context.property.postcode) concerns.push("Missing property postcode.");

  return {
    summary: `Engineer (${mode}): No AI key configured — produced unverified placeholders only. Property: ${context.property.address} ${context.property.postcode}`.trim(),
    facts,
    questions,
    concerns,
  };
}

// POST /api/engineer/run
router.post("/run", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as EngineerRunBody;
    const addressId = asNonEmptyString(body.addressId);
    let visitId = asNonEmptyString(body.visitId);

    // GOLDEN PATH: addressId is required, visitId is optional
    if (!addressId) return res.status(400).json({ success: false, error: "addressId is required" });

    const mode = asNonEmptyString(body.mode) ?? "survey";
    const accountId = req.user?.accountId;
    if (!accountId) return res.status(401).json({ success: false, error: "User account not properly configured" });

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
      if (!visitId) throw new Error("Failed to create system visit");
    }

    // 0) Load previous Engineer output for this visit (if any) for diffing.
    const prevEngineerRows = await db
      .select({ payload: spineTimelineEvents.payload })
      .from(spineTimelineEvents)
      .where(and(eq(spineTimelineEvents.visitId, visitId), eq(spineTimelineEvents.type, "engineer_output")))
      .orderBy(desc(spineTimelineEvents.ts))
      .limit(1);
    const prevForDiff = prevEngineerRows[0] ? toEngineerOutputForDiff(prevEngineerRows[0].payload) : null;

    // 1) Validate visit exists + load property basics
    const visitRows = await db
      .select({
        visitId: spineVisits.id,
        startedAt: spineVisits.startedAt,
        addressLine1: spineProperties.addressLine1,
        postcode: spineProperties.postcode,
      })
      .from(spineVisits)
      .innerJoin(spineProperties, eq(spineVisits.propertyId, spineProperties.id))
      .where(eq(spineVisits.id, visitId))
      .limit(1);

    if (!visitRows[0]) return res.status(404).json({ success: false, error: "Visit not found" });

    // 2) Load timeline events for this visit (transcripts + notes)
    const events = await db
      .select({
        type: spineTimelineEvents.type,
        ts: spineTimelineEvents.ts,
        payload: spineTimelineEvents.payload,
      })
      .from(spineTimelineEvents)
      .where(and(eq(spineTimelineEvents.visitId, visitId), inArray(spineTimelineEvents.type, ["transcript", "note"])))
      .orderBy(asc(spineTimelineEvents.ts));

    // 3) Build single context payload
    const transcripts = events
      .filter((e) => e.type === "transcript")
      .map((e) => ({
        text: safeTextFromPayload(e.payload) ?? "",
        occurredAt: e.ts.toISOString(),
      }))
      .filter((t) => t.text.trim().length > 0);

    const notes = events
      .filter((e) => e.type === "note")
      .map((e) => safeTextFromPayload(e.payload) ?? "")
      .filter((t) => t.trim().length > 0);

    const context: EngineerContext = {
      property: {
        address: visitRows[0].addressLine1,
        postcode: visitRows[0].postcode,
      },
      visit: {
        startedAt: visitRows[0].startedAt.toISOString(),
      },
      transcripts,
      notes,
    };

    // 4) Derive technical queries + retrieve KB passages (outside any DB transaction)
    const queries = deriveTechnicalQueries(context, mode);
    const topK = 5;
    const kbResults = await Promise.all(
      queries.map(async (q) => {
        try {
          const hits = await kbSearchForAccount(accountId, q, topK);
          return { query: q, hits };
        } catch (e) {
          return { query: q, hits: [] as KbPassage[], error: e instanceof Error ? e.message : "Knowledge Base unavailable" };
        }
      })
    );

    const deduped: KbPassage[] = [];
    const seen = new Set<string>();
    for (const r of kbResults) {
      for (const h of r.hits || []) {
        const key = `${h.docId}|${h.ref}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(h);
      }
    }

    const maxSources = 12;
    const kbPassages = deduped.slice(0, maxSources);
    const kbSources = kbPassages.map((p, idx) => ({
      sourceId: `S${idx + 1}`,
      docId: p.docId,
      title: p.title,
      ref: p.ref,
      text: p.text,
    }));
    const kbSourcesById = new Map<string, { title: string; docId: string; ref: string }>(
      kbSources.map((s) => [s.sourceId, { title: s.title, docId: s.docId, ref: s.ref }])
    );

    // 5) Call worker for Engineer analysis
    let engineerOutput: EngineerOutputPayload;
    try {
      const workerResponse = await workerClient.callEngineer({
        mode,
        context,
        queries,
        kbSources,
      });

      if (workerResponse.success) {
        const facts = normalizeEngineerFactsFromLlm(workerResponse.facts, kbSourcesById);

        engineerOutput = {
          summary: workerResponse.summary || `Engineer (${mode}): generated output`,
          facts,
          questions: workerResponse.questions || [],
          concerns: workerResponse.concerns || [],
        };

        // Extra enforcement: if KB is empty, facts must be unverified + uncited.
        if (kbSources.length === 0) {
          engineerOutput.facts = engineerOutput.facts.map((f) => ({
            text: isUnverifiedFact(f.text) ? f.text : `Unverified – site check required: ${f.text}`,
            citations: [],
            confidence: f.confidence ?? "low",
            verified: false,
          }));
        }
      } else {
        console.error("Worker engineer analysis failed:", workerResponse);
        engineerOutput = buildEngineerFallbackOutput(context, mode);
      }
    } catch (error) {
      console.error("Worker engineer call error:", error);
      engineerOutput = buildEngineerFallbackOutput(context, mode);
    }

    // 6) Compute + save TimelineEvent(type="engineer_diff") (if previous exists), then save new output.
    const now = new Date();
    let diffEventId: string | null = null;

    if (prevForDiff) {
      const nextForDiff: EngineerOutputForDiff = {
        facts: engineerOutput.facts.map((f) => normalizeWhitespace(f.text)).filter(Boolean),
        questions: engineerOutput.questions.map((q) => normalizeWhitespace(q)).filter(Boolean),
        concerns: engineerOutput.concerns.map((c) => normalizeWhitespace(c)).filter(Boolean),
      };

      const diffPayload = computeEngineerDiff(prevForDiff, nextForDiff);
      const diffTs = new Date(now.getTime() + 1); // ensure diff appears above output in feed ordering

      const diffInserted = await db
        .insert(spineTimelineEvents)
        .values({
          visitId,
          type: "engineer_diff",
          ts: diffTs,
          payload: diffPayload,
        })
        .returning({ eventId: spineTimelineEvents.id });
      diffEventId = diffInserted[0]?.eventId ?? null;
    }

    const inserted = await db
      .insert(spineTimelineEvents)
      .values({
        visitId,
        type: "engineer_output",
        ts: now,
        payload: engineerOutput,
      })
      .returning({ eventId: spineTimelineEvents.id });

    return res.status(201).json({ success: true, data: { eventId: inserted[0].eventId, diffEventId } });
  } catch (error) {
    const statusCode = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;
    if (statusCode >= 500) console.error("Error running engineer:", error);
    return res.status(statusCode).json({ success: false, error: (error as Error).message });
  }
});

export default router;

