/**
 * Visit Session Routes - CRUD operations for visit sessions
 */

import { Router, Request, Response } from "express";
import { db } from "../db/drizzle-client";
import { visitSessions, visitObservations } from "../db/drizzle-schema";
import { eq, desc, count } from "drizzle-orm";
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
    const customerId = req.query.customerId
      ? parseInt(req.query.customerId as string)
      : undefined;

    // Build base query for both count and data
    let dataQuery = db.select().from(visitSessions);
    let countQuery = db.select({ count: count() }).from(visitSessions);

    if (customerId) {
      dataQuery = dataQuery.where(eq(visitSessions.customerId, customerId)) as typeof dataQuery;
      countQuery = countQuery.where(eq(visitSessions.customerId, customerId)) as typeof countQuery;
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
      customerId: row.customerId,
      startedAt: row.startedAt,
      endedAt: row.endedAt ?? undefined,
      status: row.status as VisitSession["status"],
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
      customerId: row.customerId,
      startedAt: row.startedAt,
      endedAt: row.endedAt ?? undefined,
      status: row.status as VisitSession["status"],
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
router.post("/", async (req: Request, res: Response) => {
  try {
    const dto: CreateVisitSessionDto = req.body;

    const [inserted] = await db
      .insert(visitSessions)
      .values({
        accountId: dto.accountId,
        customerId: dto.customerId,
        status: "in_progress",
      })
      .returning();

    const session: VisitSession = {
      id: inserted.id,
      accountId: inserted.accountId,
      customerId: inserted.customerId,
      startedAt: inserted.startedAt,
      endedAt: inserted.endedAt ?? undefined,
      status: inserted.status as VisitSession["status"],
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
    }> = {};

    if (dto.status) {
      updateData.status = dto.status;
    }
    if (dto.endedAt) {
      updateData.endedAt = dto.endedAt;
    }

    const [updated] = await db
      .update(visitSessions)
      .set(updateData)
      .where(eq(visitSessions.id, id))
      .returning();

    const session: VisitSession = {
      id: updated.id,
      accountId: updated.accountId,
      customerId: updated.customerId,
      startedAt: updated.startedAt,
      endedAt: updated.endedAt ?? undefined,
      status: updated.status as VisitSession["status"],
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
      customerId: row.customerId,
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

export default router;
