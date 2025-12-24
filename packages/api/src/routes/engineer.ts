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

const router = Router();

type EngineerRunBody = {
  visitId?: unknown;
  mode?: unknown;
};

type EngineerOutputPayload = {
  summary: string;
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

function stubEngineer(_context: EngineerContext, mode: string): EngineerOutputPayload {
  // Intentionally boring/stable stub to prove wiring.
  const transcriptCount = _context.transcripts.length;
  const notesCount = _context.notes.length;

  const facts: string[] = [];
  if (transcriptCount > 0) facts.push(`Captured ${transcriptCount} transcript event${transcriptCount === 1 ? "" : "s"}.`);
  if (notesCount > 0) facts.push(`Captured ${notesCount} note event${notesCount === 1 ? "" : "s"}.`);
  if (facts.length === 0) facts.push("No transcript or note events yet for this visit.");

  const questions: string[] = [];
  if (transcriptCount === 0) questions.push("No transcripts found — was the companion recording started?");
  questions.push("What is the planned scope of work for this visit?");

  const concerns: string[] = [];
  if (!_context.property.postcode) concerns.push("Missing property postcode.");

  return {
    summary: `Stub Engineer (${mode}). Property: ${_context.property.address} ${_context.property.postcode}`.trim(),
    facts,
    questions,
    concerns,
  };
}

// POST /api/engineer/run
router.post("/run", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as EngineerRunBody;
    const visitId = asNonEmptyString(body.visitId);
    if (!visitId) return res.status(400).json({ success: false, error: "visitId is required" });

    const mode = asNonEmptyString(body.mode) ?? "survey";

    const result = await db.transaction(async (tx) => {
      // 1) Validate visit exists + load property basics
      const visitRows = await tx
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

      if (!visitRows[0]) throw Object.assign(new Error("Visit not found"), { statusCode: 404 });

      // 2) Load timeline events for this visit (transcripts + notes)
      const events = await tx
        .select({
          type: spineTimelineEvents.type,
          ts: spineTimelineEvents.ts,
          payload: spineTimelineEvents.payload,
        })
        .from(spineTimelineEvents)
        .where(
          and(
            eq(spineTimelineEvents.visitId, visitId),
            inArray(spineTimelineEvents.type, ["transcript", "note"])
          )
        )
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

      // 4) Call LLM (stub initially)
      const engineerOutput = stubEngineer(context, mode);

      // 5) Save TimelineEvent(type="engineer_output")
      const inserted = await tx
        .insert(spineTimelineEvents)
        .values({
          visitId,
          type: "engineer_output",
          ts: new Date(),
          payload: engineerOutput,
        })
        .returning({ eventId: spineTimelineEvents.id });

      return { eventId: inserted[0].eventId };
    });

    return res.status(201).json({ success: true, data: { eventId: result.eventId } });
  } catch (error) {
    const statusCode = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;
    if (statusCode >= 500) console.error("Error running engineer:", error);
    return res.status(statusCode).json({ success: false, error: (error as Error).message });
  }
});

export default router;

