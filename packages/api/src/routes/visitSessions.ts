/**
 * Visit Session Routes - CRUD operations for visit sessions
 */

import { Router, Request, Response } from "express";
import { db } from "../db/drizzle-client";
import { visitSessions, visitObservations, transcriptSessions, transcriptSegments } from "../db/drizzle-schema";
import { eq, desc, count } from "drizzle-orm";
import { requireLeadId } from "../middleware/leadId.middleware";
import type {
  ApiResponse,
  VisitSession,
  VisitObservation,
  CreateVisitSessionDto,
  UpdateVisitSessionDto,
  PaginatedResponse,
} from "@hail-mary/shared";

const router = Router();

// GET /visit-sessions - List all visit sessions
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const leadId = req.query.leadId
      ? parseInt(req.query.leadId as string)
      : undefined;

    // Build base query for both count and data
    let dataQuery = db.select().from(visitSessions);
    let countQuery = db.select({ count: count() }).from(visitSessions);

    if (leadId) {
      dataQuery = dataQuery.where(eq(visitSessions.leadId, leadId)) as typeof dataQuery;
      countQuery = countQuery.where(eq(visitSessions.leadId, leadId)) as typeof countQuery;
    }

    // Execute both queries
    const [rows, countResult] = await Promise.all([
      dataQuery
        .orderBy(desc(visitSessions.startedAt))
        .limit(limit)
        .offset(offset),
      countQuery
    ]);

    const total = countResult[0]?.count ?? 0;

    const sessions: VisitSession[] = rows.map((row) => ({
      id: row.id,
      accountId: row.accountId,
      leadId: row.leadId,
      startedAt: row.startedAt,
      endedAt: row.endedAt ?? undefined,
      status: row.status as VisitSession["status"],
      summary: row.summary ?? undefined,
    }));

    const response: PaginatedResponse<VisitSession> = {
      success: true,
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error listing visit sessions:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /visit-sessions/:id - Get single visit session
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const rows = await db
      .select()
      .from(visitSessions)
      .where(eq(visitSessions.id, id));

    if (rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Visit session not found",
      };
      return res.status(404).json(response);
    }

    const row = rows[0];
    const session: VisitSession = {
      id: row.id,
      accountId: row.accountId,
      leadId: row.leadId,
      startedAt: row.startedAt,
      endedAt: row.endedAt ?? undefined,
      status: row.status as VisitSession["status"],
      summary: row.summary ?? undefined,
    };

    const response: ApiResponse<VisitSession> = {
      success: true,
      data: session,
    };
    res.json(response);
  } catch (error) {
    console.error("Error getting visit session:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /visit-sessions - Create visit session (Start a visit)
// Requires leadId to ensure visits are always linked to a customer
router.post("/", requireLeadId, async (req: Request, res: Response) => {
  try {
    const dto: CreateVisitSessionDto = req.body;

    // leadId is required and validated by middleware
    const [inserted] = await db
      .insert(visitSessions)
      .values({
        accountId: dto.accountId,
        leadId: dto.leadId!,
        status: "in_progress",
      })
      .returning();

    const session: VisitSession = {
      id: inserted.id,
      accountId: inserted.accountId,
      leadId: inserted.leadId,
      startedAt: inserted.startedAt,
      endedAt: inserted.endedAt ?? undefined,
      status: inserted.status as VisitSession["status"],
      summary: inserted.summary ?? undefined,
    };

    const response: ApiResponse<VisitSession> = {
      success: true,
      data: session,
      message: "Visit session created successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating visit session:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// PUT /visit-sessions/:id - Update visit session
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const dto: UpdateVisitSessionDto = req.body;

    // Check if session exists
    const existing = await db
      .select()
      .from(visitSessions)
      .where(eq(visitSessions.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Visit session not found",
      };
      return res.status(404).json(response);
    }

    const updateData: Partial<{
      status: string;
      endedAt: Date;
      summary: string;
    }> = {};

    if (dto.status) {
      updateData.status = dto.status;
    }
    if (dto.endedAt) {
      updateData.endedAt = dto.endedAt;
    }
    if (dto.summary !== undefined) {
      updateData.summary = dto.summary;
    }

    const [updated] = await db
      .update(visitSessions)
      .set(updateData)
      .where(eq(visitSessions.id, id))
      .returning();

    const session: VisitSession = {
      id: updated.id,
      accountId: updated.accountId,
      leadId: updated.leadId,
      startedAt: updated.startedAt,
      endedAt: updated.endedAt ?? undefined,
      status: updated.status as VisitSession["status"],
      summary: updated.summary ?? undefined,
    };

    const response: ApiResponse<VisitSession> = {
      success: true,
      data: session,
      message: "Visit session updated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating visit session:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /visit-sessions/:id/observations - Get observations for a visit
router.get("/:id/observations", async (req: Request, res: Response) => {
  try {
    const visitSessionId = parseInt(req.params.id);

    const rows = await db
      .select()
      .from(visitObservations)
      .where(eq(visitObservations.visitSessionId, visitSessionId))
      .orderBy(desc(visitObservations.createdAt));

    const observations: VisitObservation[] = rows.map((row) => ({
      id: row.id,
      visitSessionId: row.visitSessionId,
      leadId: row.leadId,
      text: row.text,
      createdAt: row.createdAt,
    }));

    const response: ApiResponse<VisitObservation[]> = {
      success: true,
      data: observations,
    };
    res.json(response);
  } catch (error) {
    console.error("Error getting visit observations:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /visit-sessions/:id/generate-summary - Generate AI summary for a visit
router.post("/:id/generate-summary", async (req: Request, res: Response) => {
  try {
    const visitSessionId = parseInt(req.params.id);
    
    // Check if visit session exists
    const sessionRows = await db
      .select()
      .from(visitSessions)
      .where(eq(visitSessions.id, visitSessionId));
    
    if (sessionRows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Visit session not found",
      };
      return res.status(404).json(response);
    }
    
    const visitSession = sessionRows[0];
    
    // Get all observations for this visit
    const observations = await db
      .select()
      .from(visitObservations)
      .where(eq(visitObservations.visitSessionId, visitSessionId))
      .orderBy(visitObservations.createdAt);
    
    // Get transcript segments if available
    const transcriptRows = await db
      .select()
      .from(transcriptSessions)
      .where(eq(transcriptSessions.leadId, visitSession.leadId))
      .orderBy(desc(transcriptSessions.createdAt))
      .limit(1);
    
    let transcriptText = '';
    if (transcriptRows.length > 0) {
      const segments = await db
        .select()
        .from(transcriptSegments)
        .where(eq(transcriptSegments.sessionId, transcriptRows[0].id))
        .orderBy(transcriptSegments.startSeconds);
      
      transcriptText = segments.map(s => s.text).join(' ');
    }
    
    // Generate summary from observations and transcript
    let summary = '';
    
    if (transcriptText) {
      // If we have transcript, create a more detailed summary
      summary = generateDetailedSummary(transcriptText, observations);
    } else if (observations.length > 0) {
      // If we only have observations, create a summary from those
      summary = generateObservationsSummary(observations);
    } else {
      // No data available
      summary = 'No visit data available to generate summary.';
    }
    
    // Update the visit session with the generated summary
    const [updated] = await db
      .update(visitSessions)
      .set({ summary })
      .where(eq(visitSessions.id, visitSessionId))
      .returning();
    
    const session: VisitSession = {
      id: updated.id,
      accountId: updated.accountId,
      leadId: updated.leadId,
      startedAt: updated.startedAt,
      endedAt: updated.endedAt ?? undefined,
      status: updated.status as VisitSession["status"],
      summary: updated.summary ?? undefined,
    };
    
    const response: ApiResponse<VisitSession> = {
      success: true,
      data: session,
      message: "Summary generated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error generating visit summary:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * Generate a detailed summary from transcript and observations
 */
function generateDetailedSummary(transcript: string, observations: Array<{ text: string }>): string {
  const lines: string[] = [];
  
  // Extract key information from transcript
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) {
    return 'No transcript data available.';
  }
  
  const words = trimmedTranscript.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) {
    return 'No transcript data available.';
  }
  
  // Check for common keywords
  const hasBoilerMention = words.some(w => w.includes('boiler'));
  const hasCylinderMention = words.some(w => w.includes('cylinder'));
  const hasRadiatorMention = words.some(w => w.includes('radiator'));
  const hasPipeworkMention = words.some(w => w.includes('pipe') || w.includes('pipework'));
  
  lines.push('Visit Summary');
  lines.push('');
  
  // Add findings if keywords found
  const findings: string[] = [];
  if (hasBoilerMention) {
    findings.push('- Discussed boiler system');
  }
  if (hasCylinderMention) {
    findings.push('- Reviewed hot water cylinder');
  }
  if (hasRadiatorMention) {
    findings.push('- Inspected radiators');
  }
  if (hasPipeworkMention) {
    findings.push('- Assessed pipework');
  }
  
  if (findings.length > 0) {
    lines.push(...findings);
  } else {
    // Fallback if no keywords found - show first part of transcript
    const preview = trimmedTranscript.substring(0, 150);
    lines.push(`Survey covered: ${preview}${trimmedTranscript.length > 150 ? '...' : ''}`);
  }
  
  if (observations.length > 0) {
    lines.push('');
    lines.push('Key Observations:');
    observations.slice(0, 5).forEach(obs => {
      lines.push(`- ${obs.text}`);
    });
  }
  
  // Add a note about the transcript length
  const wordCount = words.length;
  lines.push('');
  lines.push(`Based on ${wordCount} words of transcript data`);
  
  return lines.join('\n');
}

/**
 * Generate a summary from observations only
 */
function generateObservationsSummary(observations: Array<{ text: string }>): string {
  const lines: string[] = [];
  
  lines.push('Visit Summary');
  lines.push('');
  lines.push('Observations:');
  
  observations.slice(0, 10).forEach(obs => {
    lines.push(`- ${obs.text}`);
  });
  
  return lines.join('\n');
}

export default router;
