/**
 * Bug Reports API Routes
 *
 * Endpoints for submitting and managing bug reports and feature requests
 */

import { Router, Request, Response } from "express";
import { db } from "../db/drizzle-client";
import { bugReports } from "../db/drizzle-schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import type { ApiResponse } from "@hail-mary/shared";

const router = Router();

/**
 * POST /api/bug-reports
 * Submit a new bug report or feature request
 * Requires authentication
 */
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      title,
      description,
      bugType = "bug",
      priority = "medium",
      url,
      userAgent,
      screenResolution,
      contextData,
      errorMessage,
      stackTrace,
      screenshotUrl,
      attachments,
      tags,
    } = req.body;

    // Validation
    if (!title || !description) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Title and description are required",
      };
      return res.status(400).json(response);
    }

    // Insert the bug report
    const [newReport] = await db
      .insert(bugReports)
      .values({
        userId,
        title,
        description,
        bugType,
        priority,
        url,
        userAgent,
        screenResolution,
        contextData,
        errorMessage,
        stackTrace,
        screenshotUrl,
        attachments,
        tags,
        status: "new",
      })
      .returning();

    const response: ApiResponse<{ bugReport: typeof newReport }> = {
      success: true,
      data: { bugReport: newReport },
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error creating bug report:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/bug-reports
 * Get all bug reports (optionally filtered by status or type)
 * Requires authentication
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, bugType, limit = "50" } = req.query;

    let query = db.select().from(bugReports).orderBy(desc(bugReports.createdAt));

    // Apply filters if provided
    if (status) {
      query = query.where(eq(bugReports.status, status as string)) as any;
    }
    if (bugType) {
      query = query.where(eq(bugReports.bugType, bugType as string)) as any;
    }

    const reports = await query.limit(Number(limit));

    const response: ApiResponse<{ bugReports: typeof reports }> = {
      success: true,
      data: { bugReports: reports },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error fetching bug reports:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/bug-reports/:id
 * Get a specific bug report by ID
 * Requires authentication
 */
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [report] = await db
      .select()
      .from(bugReports)
      .where(eq(bugReports.id, id))
      .limit(1);

    if (!report) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Bug report not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ bugReport: typeof report }> = {
      success: true,
      data: { bugReport: report },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error fetching bug report:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * PATCH /api/bug-reports/:id
 * Update a bug report (status, priority, assignment, etc.)
 * Requires authentication
 */
router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const updates = req.body;

    // Check if report exists
    const [existingReport] = await db
      .select()
      .from(bugReports)
      .where(eq(bugReports.id, id))
      .limit(1);

    if (!existingReport) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Bug report not found",
      };
      return res.status(404).json(response);
    }

    // If status is being changed to resolved, set resolvedAt and resolvedByUserId
    if (updates.status === "resolved" && existingReport.status !== "resolved") {
      updates.resolvedAt = new Date();
      updates.resolvedByUserId = userId;
    }

    // Update the report
    const [updatedReport] = await db
      .update(bugReports)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(bugReports.id, id))
      .returning();

    const response: ApiResponse<{ bugReport: typeof updatedReport }> = {
      success: true,
      data: { bugReport: updatedReport },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error updating bug report:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * DELETE /api/bug-reports/:id
 * Delete a bug report (admin only or report owner)
 * Requires authentication
 */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if report exists
    const [existingReport] = await db
      .select()
      .from(bugReports)
      .where(eq(bugReports.id, id))
      .limit(1);

    if (!existingReport) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Bug report not found",
      };
      return res.status(404).json(response);
    }

    // Only allow deletion if user is admin or report owner
    if (userRole !== "admin" && existingReport.userId !== userId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Unauthorized to delete this report",
      };
      return res.status(403).json(response);
    }

    await db.delete(bugReports).where(eq(bugReports.id, id));

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "Bug report deleted successfully" },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error deleting bug report:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

export default router;
