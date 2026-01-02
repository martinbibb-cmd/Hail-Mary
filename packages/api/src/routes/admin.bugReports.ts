/**
 * Admin Bug Reports Routes
 *
 * Admin-only endpoints for bug report management:
 * - Analytics and statistics
 * - Bulk operations
 * - Notes/comments
 * - Activity logs
 */

import { Router, Request, Response } from "express";
import { db } from "../db/drizzle-client";
import {
  bugReports,
  bugNotes,
  bugActivity,
  bugFilterPresets,
  users,
} from "../db/drizzle-schema";
import { eq, desc, and, gte, lte, sql, count, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware";
import type { ApiResponse } from "@hail-mary/shared";

const router = Router();

// All routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/bug-reports/stats
 * Get dashboard statistics
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { days = "7" } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(days));

    // Get counts by status
    const statusCounts = await db
      .select({
        status: bugReports.status,
        count: count(),
      })
      .from(bugReports)
      .groupBy(bugReports.status);

    // Get counts by priority
    const priorityCounts = await db
      .select({
        priority: bugReports.priority,
        count: count(),
      })
      .from(bugReports)
      .groupBy(bugReports.priority);

    // Get counts by type
    const typeCounts = await db
      .select({
        bugType: bugReports.bugType,
        count: count(),
      })
      .from(bugReports)
      .groupBy(bugReports.bugType);

    // Get daily submission trend
    const dailyTrend = await db
      .select({
        date: sql<string>`DATE(${bugReports.createdAt})`,
        count: count(),
      })
      .from(bugReports)
      .where(gte(bugReports.createdAt, daysAgo))
      .groupBy(sql`DATE(${bugReports.createdAt})`)
      .orderBy(sql`DATE(${bugReports.createdAt})`);

    // Get bugs needing attention (new + investigating)
    const needsAttention = await db
      .select()
      .from(bugReports)
      .where(
        sql`${bugReports.status} IN ('new', 'investigating')`
      )
      .orderBy(desc(bugReports.priority), desc(bugReports.createdAt))
      .limit(10);

    // Get overdue bugs (open > 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const overdueBugs = await db
      .select()
      .from(bugReports)
      .where(
        and(
          sql`${bugReports.status} NOT IN ('resolved', 'closed', 'wont_fix')`,
          lte(bugReports.createdAt, sevenDaysAgo)
        )
      )
      .limit(10);

    const response: ApiResponse<{
      statusCounts: typeof statusCounts;
      priorityCounts: typeof priorityCounts;
      typeCounts: typeof typeCounts;
      dailyTrend: typeof dailyTrend;
      needsAttention: typeof needsAttention;
      overdueBugs: typeof overdueBugs;
    }> = {
      success: true,
      data: {
        statusCounts,
        priorityCounts,
        typeCounts,
        dailyTrend,
        needsAttention,
        overdueBugs,
      },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error fetching bug stats:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/admin/bug-reports/analytics
 * Get detailed analytics data
 */
router.get("/analytics", async (req: Request, res: Response) => {
  try {
    // Browser/device breakdown
    const browserBreakdown = await db
      .select({
        userAgent: bugReports.userAgent,
        count: count(),
      })
      .from(bugReports)
      .where(sql`${bugReports.userAgent} IS NOT NULL`)
      .groupBy(bugReports.userAgent)
      .orderBy(desc(count()))
      .limit(10);

    // Top error messages
    const topErrors = await db
      .select({
        errorMessage: bugReports.errorMessage,
        count: count(),
      })
      .from(bugReports)
      .where(sql`${bugReports.errorMessage} IS NOT NULL`)
      .groupBy(bugReports.errorMessage)
      .orderBy(desc(count()))
      .limit(10);

    // Most active reporters
    const topReporters = await db
      .select({
        userId: bugReports.userId,
        count: count(),
      })
      .from(bugReports)
      .where(sql`${bugReports.userId} IS NOT NULL`)
      .groupBy(bugReports.userId)
      .orderBy(desc(count()))
      .limit(10);

    // Average resolution time (for resolved bugs)
    const resolutionTimes = await db
      .select({
        avgResolutionDays: sql<number>`AVG(EXTRACT(EPOCH FROM (${bugReports.resolvedAt} - ${bugReports.createdAt})) / 86400)`,
        priority: bugReports.priority,
      })
      .from(bugReports)
      .where(sql`${bugReports.resolvedAt} IS NOT NULL`)
      .groupBy(bugReports.priority);

    // Bugs by URL (top pages with issues)
    const bugsByUrl = await db
      .select({
        url: bugReports.url,
        count: count(),
      })
      .from(bugReports)
      .where(sql`${bugReports.url} IS NOT NULL`)
      .groupBy(bugReports.url)
      .orderBy(desc(count()))
      .limit(10);

    const response: ApiResponse<{
      browserBreakdown: typeof browserBreakdown;
      topErrors: typeof topErrors;
      topReporters: typeof topReporters;
      resolutionTimes: typeof resolutionTimes;
      bugsByUrl: typeof bugsByUrl;
    }> = {
      success: true,
      data: {
        browserBreakdown,
        topErrors,
        topReporters,
        resolutionTimes,
        bugsByUrl,
      },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * PATCH /api/admin/bug-reports/bulk-update
 * Update multiple bug reports at once
 */
router.patch("/bulk-update", async (req: Request, res: Response) => {
  try {
    const { bugReportIds, updates } = req.body;
    const userId = req.user!.id;

    if (!Array.isArray(bugReportIds) || bugReportIds.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "bugReportIds must be a non-empty array",
      };
      return res.status(400).json(response);
    }

    if (!updates || typeof updates !== "object") {
      const response: ApiResponse<null> = {
        success: false,
        error: "updates object is required",
      };
      return res.status(400).json(response);
    }

    // Get existing reports for activity logging
    const existingReports = await db
      .select()
      .from(bugReports)
      .where(inArray(bugReports.id, bugReportIds));

    // Update reports
    const updateData: any = {
      ...updates,
      updatedAt: new Date(),
    };

    if (updates.status === "resolved") {
      updateData.resolvedAt = new Date();
      updateData.resolvedByUserId = userId;
    }

    const updatedReports = await db
      .update(bugReports)
      .set(updateData)
      .where(inArray(bugReports.id, bugReportIds))
      .returning();

    // Log activity for each changed field
    const activityLogs = [];
    for (const report of existingReports) {
      for (const [field, newValue] of Object.entries(updates)) {
        const oldValue = (report as any)[field];
        if (oldValue !== newValue) {
          activityLogs.push({
            bugReportId: report.id,
            userId,
            actionType: `${field}_change`,
            fieldName: field,
            oldValue: String(oldValue || ""),
            newValue: String(newValue || ""),
          });
        }
      }
    }

    if (activityLogs.length > 0) {
      await db.insert(bugActivity).values(activityLogs);
    }

    const response: ApiResponse<{
      updatedCount: number;
      bugReports: typeof updatedReports;
    }> = {
      success: true,
      data: {
        updatedCount: updatedReports.length,
        bugReports: updatedReports,
      },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error bulk updating bug reports:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/admin/bug-reports/:id/notes
 * Get all notes for a bug report
 */
router.get("/:id/notes", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const notes = await db
      .select({
        id: bugNotes.id,
        bugReportId: bugNotes.bugReportId,
        userId: bugNotes.userId,
        note: bugNotes.note,
        createdAt: bugNotes.createdAt,
        updatedAt: bugNotes.updatedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(bugNotes)
      .leftJoin(users, eq(bugNotes.userId, users.id))
      .where(eq(bugNotes.bugReportId, id))
      .orderBy(desc(bugNotes.createdAt));

    const response: ApiResponse<{ notes: typeof notes }> = {
      success: true,
      data: { notes },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error fetching bug notes:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/admin/bug-reports/:id/notes
 * Add a note to a bug report
 */
router.post("/:id/notes", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user!.id;

    if (!note || typeof note !== "string") {
      const response: ApiResponse<null> = {
        success: false,
        error: "note text is required",
      };
      return res.status(400).json(response);
    }

    // Check if bug report exists
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

    // Create note
    const [newNote] = await db
      .insert(bugNotes)
      .values({
        bugReportId: id,
        userId,
        note,
      })
      .returning();

    // Log activity
    await db.insert(bugActivity).values({
      bugReportId: id,
      userId,
      actionType: "note_added",
      fieldName: "notes",
      newValue: note.substring(0, 255), // Truncate for activity log
    });

    const response: ApiResponse<{ note: typeof newNote }> = {
      success: true,
      data: { note: newNote },
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error("Error creating bug note:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * DELETE /api/admin/bug-reports/:id/notes/:noteId
 * Delete a note from a bug report
 */
router.delete("/:id/notes/:noteId", async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;

    await db.delete(bugNotes).where(eq(bugNotes.id, noteId));

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "Note deleted successfully" },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error deleting bug note:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/admin/bug-reports/:id/activity
 * Get activity log for a bug report
 */
router.get("/:id/activity", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const activity = await db
      .select({
        id: bugActivity.id,
        bugReportId: bugActivity.bugReportId,
        userId: bugActivity.userId,
        actionType: bugActivity.actionType,
        fieldName: bugActivity.fieldName,
        oldValue: bugActivity.oldValue,
        newValue: bugActivity.newValue,
        metadata: bugActivity.metadata,
        createdAt: bugActivity.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(bugActivity)
      .leftJoin(users, eq(bugActivity.userId, users.id))
      .where(eq(bugActivity.bugReportId, id))
      .orderBy(desc(bugActivity.createdAt));

    const response: ApiResponse<{ activity: typeof activity }> = {
      success: true,
      data: { activity },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error fetching bug activity:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/admin/bug-reports/filter-presets
 * Get saved filter presets for current user
 */
router.get("/filter-presets", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const presets = await db
      .select()
      .from(bugFilterPresets)
      .where(eq(bugFilterPresets.userId, userId))
      .orderBy(bugFilterPresets.name);

    const response: ApiResponse<{ presets: typeof presets }> = {
      success: true,
      data: { presets },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error fetching filter presets:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/admin/bug-reports/filter-presets
 * Save a new filter preset
 */
router.post("/filter-presets", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, filterConfig, isDefault = false } = req.body;

    if (!name || !filterConfig) {
      const response: ApiResponse<null> = {
        success: false,
        error: "name and filterConfig are required",
      };
      return res.status(400).json(response);
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await db
        .update(bugFilterPresets)
        .set({ isDefault: false })
        .where(eq(bugFilterPresets.userId, userId));
    }

    const [preset] = await db
      .insert(bugFilterPresets)
      .values({
        userId,
        name,
        filterConfig,
        isDefault,
      })
      .returning();

    const response: ApiResponse<{ preset: typeof preset }> = {
      success: true,
      data: { preset },
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error("Error creating filter preset:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * DELETE /api/admin/bug-reports/filter-presets/:presetId
 * Delete a filter preset
 */
router.delete("/filter-presets/:presetId", async (req: Request, res: Response) => {
  try {
    const { presetId } = req.params;
    const userId = req.user!.id;

    // Only allow deleting own presets
    await db
      .delete(bugFilterPresets)
      .where(
        and(
          eq(bugFilterPresets.id, presetId),
          eq(bugFilterPresets.userId, userId)
        )
      );

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "Preset deleted successfully" },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error deleting filter preset:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

export default router;
