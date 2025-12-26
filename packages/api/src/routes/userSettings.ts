/**
 * User Settings API Routes
 *
 * Endpoints for persisting user preferences and settings
 */

import { Router, Request, Response } from "express";
import { db } from "../db/drizzle-client";
import { userSettings } from "../db/drizzle-schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import type { ApiResponse } from "@hail-mary/shared";

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/user-settings
 * Get current user's settings
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (!settings) {
      // Return default settings if none exist
      const response: ApiResponse<{ settings: any }> = {
        success: true,
        data: {
          settings: {
            dockModules: [],
            preferences: {},
          },
        },
      };
      return res.json(response);
    }

    const response: ApiResponse<{ settings: typeof settings }> = {
      success: true,
      data: { settings },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting user settings:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * PUT /api/user-settings
 * Create or update user settings
 */
router.put("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { dockModules, preferences } = req.body;

    // Check if settings already exist
    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    let updated;

    if (existing) {
      // Update existing settings
      const updates: any = {
        updatedAt: new Date(),
      };

      if (dockModules !== undefined) updates.dockModules = dockModules;
      if (preferences !== undefined) updates.preferences = preferences;

      [updated] = await db
        .update(userSettings)
        .set(updates)
        .where(eq(userSettings.userId, userId))
        .returning();
    } else {
      // Create new settings
      [updated] = await db
        .insert(userSettings)
        .values({
          userId,
          dockModules: dockModules || [],
          preferences: preferences || {},
        })
        .returning();
    }

    const response: ApiResponse<{ settings: typeof updated }> = {
      success: true,
      data: { settings: updated },
      message: "Settings saved successfully",
    };
    return res.json(response);
  } catch (error) {
    console.error("Error saving user settings:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * PATCH /api/user-settings
 * Partially update user settings
 */
router.patch("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { dockModules, preferences } = req.body;

    // Check if settings exist
    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (!existing) {
      // Create new settings if they don't exist
      const [created] = await db
        .insert(userSettings)
        .values({
          userId,
          dockModules: dockModules || [],
          preferences: preferences || {},
        })
        .returning();

      const response: ApiResponse<{ settings: typeof created }> = {
        success: true,
        data: { settings: created },
        message: "Settings created successfully",
      };
      return res.status(201).json(response);
    }

    // Build partial update
    const updates: any = {
      updatedAt: new Date(),
    };

    if (dockModules !== undefined) updates.dockModules = dockModules;

    if (preferences !== undefined) {
      // Merge preferences with existing ones
      updates.preferences = {
        ...(typeof existing.preferences === 'object' && existing.preferences !== null ? existing.preferences : {}),
        ...preferences,
      };
    }

    const [updated] = await db
      .update(userSettings)
      .set(updates)
      .where(eq(userSettings.userId, userId))
      .returning();

    const response: ApiResponse<{ settings: typeof updated }> = {
      success: true,
      data: { settings: updated },
      message: "Settings updated successfully",
    };
    return res.json(response);
  } catch (error) {
    console.error("Error updating user settings:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * DELETE /api/user-settings
 * Delete user settings (reset to defaults)
 */
router.delete("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    await db
      .delete(userSettings)
      .where(eq(userSettings.userId, userId));

    const response: ApiResponse<{ success: boolean }> = {
      success: true,
      data: { success: true },
      message: "Settings reset to defaults",
    };
    return res.json(response);
  } catch (error) {
    console.error("Error deleting user settings:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

export default router;
