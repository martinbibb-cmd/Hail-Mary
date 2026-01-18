/**
 * Transcription Routes
 *
 * Option A Ingestion (live segments):
 * - POST /api/leads/:leadId/transcripts/sessions
 * - POST /api/transcripts/sessions/:sessionId/segments   (idempotent upsert by sessionId+seq)
 * - GET  /api/transcripts/sessions/:sessionId/segments?afterSeq=N
 * - POST /api/transcripts/sessions/:sessionId/finalize
 *
 * Postcode-based paste/upload (PR13):
 * - POST /api/transcripts                         (paste/type transcript)
 * - POST /api/transcripts/upload                  (upload .txt/.md file)
 * - GET  /api/transcripts?postcode=...            (list transcripts)
 * - GET  /api/transcripts/:id                     (get transcript detail)
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../db/drizzle-client";
import { transcriptAggregates, transcriptSegments, transcriptSessions } from "../db/drizzle-schema";
import { and, asc, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware";
import type { ApiResponse, PaginatedResponse } from "@hail-mary/shared";

const router = Router();

// Use optional auth to allow unauthenticated access for PWA functionality
router.use(optionalAuth);

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
 * Creates a live transcript session (Option A flow) for a lead
 * IMPORTANT: Should include addressId to properly anchor transcript to property
 */
router.post("/leads/:leadId/transcripts/sessions", async (req: Request, res: Response) => {
  try {
    const leadId = parseId(req.params.leadId);
    if (!leadId) {
      const response: ApiResponse<null> = { success: false, error: "Invalid leadId" };
      return res.status(400).json(response);
    }

    const { source, deviceId, language, notes, startedAt, addressId } = req.body ?? {};

    const startedAtDate = startedAt ? new Date(startedAt) : new Date();
    const [inserted] = await db
      .insert(transcriptSessions)
      .values({
        leadId,
        addressId: addressId || null, // IMPORTANT: anchor to property if provided
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

// ============================================
// Postcode-based Paste/Upload Routes (PR13)
// ============================================

// Multer setup for transcript file uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "../../data/transcripts");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.txt', '.md', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      cb(new Error(`File type not allowed. Allowed: ${allowedExtensions.join(', ')}`));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /api/transcripts
 * Create a transcript from pasted/typed text
 * REQUIRES addressId to anchor the transcript to a property
 */
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { addressId, postcode, title, text, source, notes } = req.body;

    // addressId is now REQUIRED to properly anchor transcripts
    if (!addressId || typeof addressId !== 'string') {
      const response: ApiResponse<null> = {
        success: false,
        error: "addressId is required - select a property first"
      };
      return res.status(400).json(response);
    }

    if (!text || typeof text !== 'string') {
      const response: ApiResponse<null> = { success: false, error: "text is required" };
      return res.status(400).json(response);
    }

    // Auto-generate title if not provided
    const now = new Date();
    const autoTitle = title || `Transcript ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

    const [inserted] = await db
      .insert(transcriptSessions)
      .values({
        userId,
        addressId, // REQUIRED: anchor to property
        postcode: postcode?.trim().toUpperCase() || null, // Keep for backward compat, but optional
        title: autoTitle,
        rawText: text,
        source: source || 'manual',
        status: 'new',
        notes: notes || null,
        startedAt: now,
      })
      .returning();

    const response: ApiResponse<{ transcript: typeof inserted }> = {
      success: true,
      data: { transcript: inserted },
      message: "Transcript created successfully",
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error creating transcript:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/transcripts/upload
 * Upload a transcript file (.txt, .md, .json)
 * REQUIRES addressId to anchor the transcript to a property
 */
router.post("/upload", requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      const response: ApiResponse<null> = { success: false, error: "No file uploaded" };
      return res.status(400).json(response);
    }

    const { addressId, postcode, title, notes } = req.body;

    // addressId is now REQUIRED to properly anchor transcripts
    if (!addressId || typeof addressId !== 'string') {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      const response: ApiResponse<null> = {
        success: false,
        error: "addressId is required - select a property first"
      };
      return res.status(400).json(response);
    }

    // Read file contents
    const fileContents = fs.readFileSync(file.path, 'utf-8');

    // Auto-generate title from filename if not provided
    const now = new Date();
    const autoTitle = title || file.originalname;

    const [inserted] = await db
      .insert(transcriptSessions)
      .values({
        userId,
        addressId, // REQUIRED: anchor to property
        postcode: postcode?.trim().toUpperCase() || null, // Keep for backward compat, but optional
        title: autoTitle,
        rawText: fileContents,
        source: 'upload',
        status: 'new',
        notes: notes || null,
        startedAt: now,
      })
      .returning();

    // Clean up uploaded file after storing in DB
    fs.unlinkSync(file.path);

    const response: ApiResponse<{ transcript: typeof inserted }> = {
      success: true,
      data: { transcript: inserted },
      message: "Transcript uploaded successfully",
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error uploading transcript:", error);
    // Clean up file on error
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/transcripts?postcode=...&page=1&limit=50
 * List transcripts with optional postcode filter
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const postcode = req.query.postcode as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const conditions = [eq(transcriptSessions.userId, userId)];

    if (postcode) {
      conditions.push(eq(transcriptSessions.postcode, postcode.trim().toUpperCase()));
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transcriptSessions)
      .where(and(...conditions));

    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Get paginated results
    const rows = await db
      .select()
      .from(transcriptSessions)
      .where(and(...conditions))
      .orderBy(desc(transcriptSessions.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const response: PaginatedResponse<typeof rows[0]> = {
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error listing transcripts:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/transcripts/:id
 * Get transcript detail by ID
 */
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseId(req.params.id);

    if (!id) {
      const response: ApiResponse<null> = { success: false, error: "Invalid transcript ID" };
      return res.status(400).json(response);
    }

    const [transcript] = await db
      .select()
      .from(transcriptSessions)
      .where(
        and(
          eq(transcriptSessions.id, id),
          eq(transcriptSessions.userId, userId)
        )
      )
      .limit(1);

    if (!transcript) {
      const response: ApiResponse<null> = { success: false, error: "Transcript not found" };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ transcript: typeof transcript }> = {
      success: true,
      data: { transcript },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting transcript:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

export default router;

