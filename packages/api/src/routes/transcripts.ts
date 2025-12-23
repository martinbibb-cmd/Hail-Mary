/**
 * Option A Transcription Ingestion Routes (live segments)
 *
 * Endpoints:
 * - POST /api/leads/:leadId/transcripts/sessions
 * - POST /api/transcripts/sessions/:sessionId/segments   (idempotent upsert by sessionId+seq)
 * - GET  /api/transcripts/sessions/:sessionId/segments?afterSeq=N
 * - POST /api/transcripts/sessions/:sessionId/finalize
 */

import { Router, Request, Response } from "express";
import { db } from "../db/drizzle-client";
import { transcriptAggregates, transcriptSegments, transcriptSessions } from "../db/drizzle-schema";
import { and, asc, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { requireAuth, blockGuest } from "../middleware/auth.middleware";
import type { ApiResponse } from "@hail-mary/shared";

const router = Router();

// Keep consistent with other lead endpoints
router.use(requireAuth);
router.use(blockGuest);

type IngestSegment = {
  seq: number;
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
};

function parseId(raw: unknown): number | null {
  const n = Number.parseInt(String(raw), 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

/**
 * POST /api/leads/:leadId/transcripts/sessions
 */
router.post("/leads/:leadId/transcripts/sessions", async (req: Request, res: Response) => {
  try {
    const leadId = parseId(req.params.leadId);
    if (!leadId) {
      const response: ApiResponse<null> = { success: false, error: "Invalid leadId" };
      return res.status(400).json(response);
    }

    const { source, deviceId, language, notes, startedAt } = req.body ?? {};

    const startedAtDate = startedAt ? new Date(startedAt) : new Date();
    const [inserted] = await db
      .insert(transcriptSessions)
      .values({
        leadId,
        status: "recording",
        language: language || "en-GB",
        notes: notes || null,
        source: source || null,
        deviceId: deviceId || null,
        startedAt: startedAtDate,
      })
      .returning();

    const response: ApiResponse<{ sessionId: number }> = {
      success: true,
      data: { sessionId: inserted.id },
      message: "Transcript session created",
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error creating transcript session (Option A):", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/transcripts/sessions/:sessionId/segments
 * Idempotent upsert by (sessionId, seq).
 */
router.post("/transcripts/sessions/:sessionId/segments", async (req: Request, res: Response) => {
  try {
    const sessionId = parseId(req.params.sessionId);
    if (!sessionId) {
      const response: ApiResponse<null> = { success: false, error: "Invalid sessionId" };
      return res.status(400).json(response);
    }

    const body = req.body ?? {};
    const segments: IngestSegment[] = Array.isArray(body.segments)
      ? body.segments
      : [body as IngestSegment];

    if (segments.length === 0) {
      const response: ApiResponse<null> = { success: false, error: "segments is required" };
      return res.status(400).json(response);
    }

    for (const seg of segments) {
      if (!Number.isInteger(seg.seq) || seg.seq < 0) {
        const response: ApiResponse<null> = { success: false, error: "Each segment.seq must be an integer >= 0" };
        return res.status(400).json(response);
      }
      if (!seg.text || typeof seg.text !== "string") {
        const response: ApiResponse<null> = { success: false, error: "Each segment.text must be a non-empty string" };
        return res.status(400).json(response);
      }
      if (!Number.isFinite(seg.startMs) || !Number.isFinite(seg.endMs)) {
        const response: ApiResponse<null> = { success: false, error: "Each segment must include startMs and endMs (numbers)" };
        return res.status(400).json(response);
      }
    }

    const rows = segments.map((seg) => ({
      sessionId,
      seq: seg.seq,
      text: seg.text,
      startMs: Math.round(seg.startMs),
      endMs: Math.round(seg.endMs),
      startSeconds: String(Math.round(seg.startMs) / 1000),
      endSeconds: String(Math.round(seg.endMs) / 1000),
      confidence: seg.confidence !== undefined && seg.confidence !== null ? String(seg.confidence) : null,
      chunkId: null,
      updatedAt: new Date(),
    }));

    await db
      .insert(transcriptSegments)
      .values(rows)
      .onConflictDoUpdate({
        target: [transcriptSegments.sessionId, transcriptSegments.seq],
        set: {
          text: sql`excluded.text`,
          startMs: sql`excluded.start_ms`,
          endMs: sql`excluded.end_ms`,
          startSeconds: sql`excluded.start_seconds`,
          endSeconds: sql`excluded.end_seconds`,
          confidence: sql`excluded.confidence`,
          updatedAt: new Date(),
        },
      });

    const response: ApiResponse<{ upserted: number }> = {
      success: true,
      data: { upserted: rows.length },
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error upserting transcript segments (Option A):", error);
    const response: ApiResponse<null> = { success: false, error: (error as Error).message };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/transcripts/sessions/:sessionId/segments?afterSeq=N
 */
router.get("/transcripts/sessions/:sessionId/segments", async (req: Request, res: Response) => {
  try {
    const sessionId = parseId(req.params.sessionId);
    if (!sessionId) {
      const response: ApiResponse<null> = { success: false, error: "Invalid sessionId" };
      return res.status(400).json(response);
    }

    const afterSeqRaw = req.query.afterSeq as string | undefined;
    const afterSeq = afterSeqRaw ? Number.parseInt(afterSeqRaw, 10) : -1;

    const rows = await db
      .select()
      .from(transcriptSegments)
      .where(
        and(
          eq(transcriptSegments.sessionId, sessionId),
          isNotNull(transcriptSegments.seq),
          gt(transcriptSegments.seq, Number.isNaN(afterSeq) ? -1 : afterSeq),
        ),
      )
      .orderBy(asc(transcriptSegments.seq))
      .limit(500);

    const segments = rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      seq: r.seq!,
      text: r.text,
      startMs: r.startMs ?? undefined,
      endMs: r.endMs ?? undefined,
      confidence: r.confidence ? Number(r.confidence) : undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    const nextAfterSeq = segments.length > 0 ? segments[segments.length - 1].seq : (Number.isNaN(afterSeq) ? -1 : afterSeq);

    const response: ApiResponse<{ segments: typeof segments; nextAfterSeq: number }> = {
      success: true,
      data: { segments, nextAfterSeq },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error polling transcript segments (Option A):", error);
    const response: ApiResponse<null> = { success: false, error: (error as Error).message };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/transcripts/sessions/:sessionId/finalize
 */
router.post("/transcripts/sessions/:sessionId/finalize", async (req: Request, res: Response) => {
  try {
    const sessionId = parseId(req.params.sessionId);
    if (!sessionId) {
      const response: ApiResponse<null> = { success: false, error: "Invalid sessionId" };
      return res.status(400).json(response);
    }

    // Fetch all Option A segments in order
    const segRows = await db
      .select()
      .from(transcriptSegments)
      .where(and(eq(transcriptSegments.sessionId, sessionId), isNotNull(transcriptSegments.seq)))
      .orderBy(asc(transcriptSegments.seq));

    const lastSeq = segRows.length > 0 ? (segRows[segRows.length - 1].seq ?? 0) : 0;
    const fullText = segRows.map((s) => s.text).join(" ").trim();

    const lastEndMs = segRows.length > 0 ? (segRows[segRows.length - 1].endMs ?? null) : null;
    const durationSeconds = lastEndMs !== null ? Math.round(lastEndMs / 1000) : null;

    // Update session
    const [updatedSession] = await db
      .update(transcriptSessions)
      .set({
        status: "completed",
        endedAt: new Date(),
        durationSeconds,
        updatedAt: new Date(),
      })
      .where(eq(transcriptSessions.id, sessionId))
      .returning();

    // Upsert aggregate
    await db
      .insert(transcriptAggregates)
      .values({
        sessionId,
        lastSeq,
        fullText,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: transcriptAggregates.sessionId,
        set: {
          lastSeq,
          fullText,
          updatedAt: new Date(),
        },
      });

    // Return the latest aggregate for convenience
    const [aggregate] = await db
      .select()
      .from(transcriptAggregates)
      .where(eq(transcriptAggregates.sessionId, sessionId))
      .orderBy(desc(transcriptAggregates.updatedAt))
      .limit(1);

    const response: ApiResponse<{ session: typeof updatedSession; aggregate: typeof aggregate | null }> = {
      success: true,
      data: { session: updatedSession, aggregate: aggregate ?? null },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error finalizing transcript session (Option A):", error);
    const response: ApiResponse<null> = { success: false, error: (error as Error).message };
    return res.status(500).json(response);
  }
});

export default router;

