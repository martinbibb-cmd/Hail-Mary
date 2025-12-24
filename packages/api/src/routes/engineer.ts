/**
 * Engineer Routes (v2 spine)
 *
 * Manual-only: one tap → one run → one TimelineEvent(type="engineer_output")
 *
 * POST /api/engineer/run
 * body: { visitId: string, mode?: string }
 */

import { Router, type Request, type Response } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/drizzle-client";
import { spineProperties, spineTimelineEvents, spineVisits } from "../db/drizzle-schema";
import { requireAuth } from "../middleware/auth.middleware";
import { kbSearch as kbSearchForAccount, type KbPassage } from "../services/kbSearch.service";
import { getOpenaiApiKey } from "../services/workerKeys.service";

const router = Router();

type EngineerRunBody = {
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
    const visitId = asNonEmptyString(body.visitId);
    if (!visitId) return res.status(400).json({ success: false, error: "visitId is required" });

    const mode = asNonEmptyString(body.mode) ?? "survey";
    const accountId = req.user?.accountId;
    if (!accountId) return res.status(401).json({ success: false, error: "User account not properly configured" });

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

    // 5) Call LLM (OpenAI JSON mode); fallback to safe output if no keys
    let openaiKey = process.env.OPENAI_API_KEY?.trim() || "";
    if (!openaiKey) {
      try {
        openaiKey = (await getOpenaiApiKey())?.trim() || "";
      } catch {
        openaiKey = "";
      }
    }

    let engineerOutput: EngineerOutputPayload;
    if (!openaiKey) {
      engineerOutput = buildEngineerFallbackOutput(context, mode);
    } else {
      const system = [
          "You are the Atlas Engineer. You produce auditable technical outputs for a site survey visit.",
          "",
          "You will be given:",
          "- Visit context (transcripts + notes)",
          "- Knowledge Base sources (technical docs) with source IDs (S1, S2, ...)",
          "",
          "Non-negotiable guardrails:",
          "- Do NOT invent clearances, distances, measurements, or compliance claims.",
          "- If a fact is not directly supported by at least one provided KB source, either OMIT it or mark it as:",
          '  \"Unverified – site check required: <fact>\"',
          "- Any fact that is NOT marked Unverified MUST include citations (one or more source IDs).",
          "- If a fact has ZERO citations, it MUST be marked verified=false and MUST start with \"Unverified\".",
          "- Use ONLY the provided source IDs in citations. Never invent doc IDs/titles/refs.",
          "",
          "Output must be STRICT JSON (no markdown) with keys:",
          '{ "summary": string, "facts": Array<{ "text": string, "citations": string[], "confidence"?: "high"|"medium"|"low", "verified"?: boolean }>, "questions": string[], "concerns": string[] }',
          "",
          "Facts guidance:",
          "- Each fact should be a single, checkable claim.",
          "- Prefer manufacturer instructions over generic guidance where possible.",
          "- If the model/installation details are missing, ask targeted questions rather than guessing.",
        ].join("\n");

      const kbBlock =
        kbSources.length > 0
          ? [
              "Knowledge Base sources (cite by source ID):",
              ...kbSources.map((s) => {
                const safe = normalizeWhitespace(String(s.text || ""));
                const clipped = safe.length > 1200 ? `${safe.slice(0, 1200)}…` : safe;
                return `- [${s.sourceId}] docId=${s.docId} title="${s.title}" ref=${s.ref} text="${clipped}"`;
              }),
            ].join("\n")
          : "Knowledge Base sources: NONE_FOUND";

      const user = [
        `Mode: ${mode}`,
        "",
        "Visit context:",
        `Property: ${JSON.stringify(context.property)}`,
        `Visit: ${JSON.stringify(context.visit)}`,
        context.transcripts.length > 0 ? `Transcripts: ${JSON.stringify(context.transcripts)}` : "Transcripts: []",
        context.notes.length > 0 ? `Notes: ${JSON.stringify(context.notes)}` : "Notes: []",
        "",
        `Derived technical queries: ${JSON.stringify(queries)}`,
        "",
        kbBlock,
      ].join("\n");

      const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ENGINEER_OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.1,
          max_tokens: 900,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!llmRes.ok) {
        const errorText = await llmRes.text();
        console.error("Engineer LLM error:", llmRes.status, errorText);
        engineerOutput = buildEngineerFallbackOutput(context, mode);
      } else {
        const llmJson = (await llmRes.json()) as any;
        const content =
          typeof llmJson?.choices?.[0]?.message?.content === "string" ? String(llmJson.choices[0].message.content).trim() : "";
        let parsed: unknown = null;
        try {
          parsed = content ? JSON.parse(content) : null;
        } catch {
          parsed = null;
        }

        const llmObj = isRecord(parsed) ? (parsed as Record<string, unknown>) : null;
        const summary = typeof llmObj?.summary === "string" ? llmObj.summary.trim() : "";
        const questions = coerceStringArray(llmObj?.questions, 12);
        const concerns = coerceStringArray(llmObj?.concerns, 12);
        const facts = normalizeEngineerFactsFromLlm(llmObj?.facts, kbSourcesById);

        engineerOutput = {
          summary: summary || `Engineer (${mode}): generated output`,
          facts,
          questions,
          concerns,
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
      }
    }

    // 6) Save TimelineEvent(type="engineer_output")
    const inserted = await db
      .insert(spineTimelineEvents)
      .values({
        visitId,
        type: "engineer_output",
        ts: new Date(),
        payload: engineerOutput,
      })
      .returning({ eventId: spineTimelineEvents.id });

    return res.status(201).json({ success: true, data: { eventId: inserted[0].eventId } });
  } catch (error) {
    const statusCode = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;
    if (statusCode >= 500) console.error("Error running engineer:", error);
    return res.status(statusCode).json({ success: false, error: (error as Error).message });
  }
});

export default router;

