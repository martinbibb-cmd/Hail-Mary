/**
 * Trajectory Engine API Routes
 *
 * Carbon/cost projection system for staged retrofit journeys
 *
 * Endpoints:
 * Assumptions:
 * - GET    /api/trajectory/assumptions/latest?region=UK-GB
 * - GET    /api/trajectory/assumptions?region=UK-GB&from=2026-01-01&to=2026-12-01
 * - POST   /api/trajectory/assumptions (admin only)
 * - PATCH  /api/trajectory/assumptions/:id (admin only)
 *
 * Property Models:
 * - GET    /api/trajectory/property-models?lead_id=123
 * - POST   /api/trajectory/property-models
 * - GET    /api/trajectory/property-models/:id
 * - PATCH  /api/trajectory/property-models/:id
 * - DELETE /api/trajectory/property-models/:id
 *
 * Occupancy Profiles:
 * - GET    /api/trajectory/occupancy-profiles?lead_id=123
 * - POST   /api/trajectory/occupancy-profiles
 * - GET    /api/trajectory/occupancy-profiles/:id
 * - PATCH  /api/trajectory/occupancy-profiles/:id
 * - DELETE /api/trajectory/occupancy-profiles/:id
 *
 * DHW Profiles:
 * - GET    /api/trajectory/dhw-profiles?lead_id=123
 * - POST   /api/trajectory/dhw-profiles
 * - GET    /api/trajectory/dhw-profiles/:id
 * - PATCH  /api/trajectory/dhw-profiles/:id
 * - DELETE /api/trajectory/dhw-profiles/:id
 *
 * Scenarios:
 * - GET    /api/trajectory/scenarios?lead_id=123
 * - POST   /api/trajectory/scenarios
 * - GET    /api/trajectory/scenarios/:id
 * - PATCH  /api/trajectory/scenarios/:id
 * - DELETE /api/trajectory/scenarios/:id
 *
 * Journeys:
 * - GET    /api/trajectory/journeys?lead_id=123
 * - POST   /api/trajectory/journeys
 * - GET    /api/trajectory/journeys/:id
 * - PATCH  /api/trajectory/journeys/:id
 * - DELETE /api/trajectory/journeys/:id
 */

import { Router, Request, Response } from "express";
import { db } from "../db/drizzle-client";
import {
  assumptionsSnapshots,
  propertyModels,
  occupancyProfiles,
  dhwProfiles,
  scenarios,
  journeys,
  leads,
} from "../db/drizzle-schema";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import type { ApiResponse } from "@hail-mary/shared";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Helper: Check if user is admin
function requireAdmin(req: Request, res: Response, next: Function) {
  if (req.user!.role !== 'admin') {
    const response: ApiResponse<null> = {
      success: false,
      error: "Admin access required",
    };
    return res.status(403).json(response);
  }
  next();
}

// Helper: Check if user can access lead
async function canAccessLead(leadId: number, userId: number, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) return false;

  return lead.assignedUserId === userId;
}

// ============================================
// Assumptions Snapshots
// ============================================

/**
 * GET /api/trajectory/assumptions/latest?region=UK-GB
 * Get latest assumptions snapshot for a region
 */
router.get("/assumptions/latest", async (req: Request, res: Response) => {
  try {
    const regionCode = (req.query.region as string) || "UK-GB";

    const [snapshot] = await db
      .select()
      .from(assumptionsSnapshots)
      .where(eq(assumptionsSnapshots.regionCode, regionCode))
      .orderBy(desc(assumptionsSnapshots.periodStart))
      .limit(1);

    if (!snapshot) {
      const response: ApiResponse<null> = {
        success: false,
        error: `No assumptions snapshots found for region ${regionCode}`,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ snapshot: typeof snapshot }> = {
      success: true,
      data: { snapshot },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting latest assumptions:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/trajectory/assumptions?region=UK-GB&from=2026-01-01&to=2026-12-01
 * Get assumptions snapshots for a region within a date range
 */
router.get("/assumptions", async (req: Request, res: Response) => {
  try {
    const regionCode = (req.query.region as string) || "UK-GB";
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const filters = [eq(assumptionsSnapshots.regionCode, regionCode)];

    if (from) {
      filters.push(gte(assumptionsSnapshots.periodStart, new Date(from)));
    }
    if (to) {
      filters.push(lte(assumptionsSnapshots.periodStart, new Date(to)));
    }

    const snapshots = await db
      .select()
      .from(assumptionsSnapshots)
      .where(and(...filters))
      .orderBy(assumptionsSnapshots.periodStart);

    const response: ApiResponse<{ snapshots: typeof snapshots }> = {
      success: true,
      data: { snapshots },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting assumptions:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/trajectory/assumptions
 * Create new assumptions snapshot (admin only)
 */
router.post("/assumptions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      regionCode,
      periodStart,
      periodEnd,
      electricityUnitPPerKwh,
      electricityOffpeakPPerKwh,
      gasUnitPPerKwh,
      elecStandingChargePPerDay,
      gasStandingChargePPerDay,
      gridIntensityGco2ePerKwh,
      gasIntensityGco2ePerKwh,
      policyFlags,
      sourceMeta,
    } = req.body;

    if (!regionCode || !periodStart || !periodEnd || !electricityUnitPPerKwh || !gasUnitPPerKwh || !gridIntensityGco2ePerKwh || !gasIntensityGco2ePerKwh) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Missing required fields",
      };
      return res.status(400).json(response);
    }

    const [inserted] = await db
      .insert(assumptionsSnapshots)
      .values({
        regionCode,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        electricityUnitPPerKwh,
        electricityOffpeakPPerKwh: electricityOffpeakPPerKwh || null,
        gasUnitPPerKwh,
        elecStandingChargePPerDay: elecStandingChargePPerDay || null,
        gasStandingChargePPerDay: gasStandingChargePPerDay || null,
        gridIntensityGco2ePerKwh,
        gasIntensityGco2ePerKwh,
        policyFlags: policyFlags || {},
        sourceMeta: sourceMeta || {},
      })
      .returning();

    const response: ApiResponse<{ snapshot: typeof inserted }> = {
      success: true,
      data: { snapshot: inserted },
      message: "Assumptions snapshot created successfully",
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error creating assumptions snapshot:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * PATCH /api/trajectory/assumptions/:id
 * Update assumptions snapshot (admin only)
 */
router.patch("/assumptions/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const snapshotId = req.params.id;
    const updates: any = { updatedAt: new Date() };

    // Allow updating all fields except id
    const allowedFields = [
      "regionCode",
      "periodStart",
      "periodEnd",
      "electricityUnitPPerKwh",
      "electricityOffpeakPPerKwh",
      "gasUnitPPerKwh",
      "elecStandingChargePPerDay",
      "gasStandingChargePPerDay",
      "gridIntensityGco2ePerKwh",
      "gasIntensityGco2ePerKwh",
      "policyFlags",
      "sourceMeta",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === "periodStart" || field === "periodEnd") {
          updates[field] = new Date(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    const [updated] = await db
      .update(assumptionsSnapshots)
      .set(updates)
      .where(eq(assumptionsSnapshots.id, snapshotId))
      .returning();

    if (!updated) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Assumptions snapshot not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ snapshot: typeof updated }> = {
      success: true,
      data: { snapshot: updated },
      message: "Assumptions snapshot updated successfully",
    };
    return res.json(response);
  } catch (error) {
    console.error("Error updating assumptions snapshot:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

// ============================================
// Property Models
// ============================================

/**
 * GET /api/trajectory/property-models?lead_id=123
 * List property models
 */
router.get("/property-models", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const leadId = req.query.lead_id ? parseInt(req.query.lead_id as string) : undefined;

    const filters = [];

    if (leadId) {
      // Check permission
      if (!isAdmin && !(await canAccessLead(leadId, userId, isAdmin))) {
        const response: ApiResponse<null> = {
          success: false,
          error: "Access denied",
        };
        return res.status(403).json(response);
      }
      filters.push(eq(propertyModels.leadId, leadId));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const models = await db
      .select()
      .from(propertyModels)
      .where(whereClause)
      .orderBy(desc(propertyModels.createdAt));

    const response: ApiResponse<{ models: typeof models }> = {
      success: true,
      data: { models },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting property models:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/trajectory/property-models
 * Create property model
 */
router.post("/property-models", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const {
      leadId,
      propertyId,
      modelVersion,
      floorAreaM2,
      ageBand,
      construction,
      infiltrationAch,
      zones,
      defaultSetpoints,
      notes,
    } = req.body;

    // Check permission if leadId provided
    if (leadId && !isAdmin && !(await canAccessLead(leadId, userId, isAdmin))) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Access denied",
      };
      return res.status(403).json(response);
    }

    const [inserted] = await db
      .insert(propertyModels)
      .values({
        leadId: leadId || null,
        propertyId: propertyId || null,
        modelVersion: modelVersion || 1,
        floorAreaM2: floorAreaM2 || null,
        ageBand: ageBand || null,
        construction: construction || {},
        infiltrationAch: infiltrationAch || null,
        zones: zones || [],
        defaultSetpoints: defaultSetpoints || {},
        notes: notes || null,
      })
      .returning();

    const response: ApiResponse<{ model: typeof inserted }> = {
      success: true,
      data: { model: inserted },
      message: "Property model created successfully",
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error creating property model:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/trajectory/property-models/:id
 * Get property model by ID
 */
router.get("/property-models/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const modelId = req.params.id;

    const [model] = await db
      .select()
      .from(propertyModels)
      .where(eq(propertyModels.id, modelId))
      .limit(1);

    if (!model) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Property model not found",
      };
      return res.status(404).json(response);
    }

    // Check permission
    if (model.leadId && !isAdmin && !(await canAccessLead(model.leadId, userId, isAdmin))) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Access denied",
      };
      return res.status(403).json(response);
    }

    const response: ApiResponse<{ model: typeof model }> = {
      success: true,
      data: { model },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting property model:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * PATCH /api/trajectory/property-models/:id
 * Update property model
 */
router.patch("/property-models/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const modelId = req.params.id;

    const [existing] = await db
      .select()
      .from(propertyModels)
      .where(eq(propertyModels.id, modelId))
      .limit(1);

    if (!existing) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Property model not found",
      };
      return res.status(404).json(response);
    }

    // Check permission
    if (existing.leadId && !isAdmin && !(await canAccessLead(existing.leadId, userId, isAdmin))) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Access denied",
      };
      return res.status(403).json(response);
    }

    const updates: any = { updatedAt: new Date() };
    const allowedFields = [
      "modelVersion",
      "floorAreaM2",
      "ageBand",
      "construction",
      "infiltrationAch",
      "zones",
      "defaultSetpoints",
      "notes",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const [updated] = await db
      .update(propertyModels)
      .set(updates)
      .where(eq(propertyModels.id, modelId))
      .returning();

    const response: ApiResponse<{ model: typeof updated }> = {
      success: true,
      data: { model: updated },
      message: "Property model updated successfully",
    };
    return res.json(response);
  } catch (error) {
    console.error("Error updating property model:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * DELETE /api/trajectory/property-models/:id
 * Delete property model
 */
router.delete("/property-models/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const modelId = req.params.id;

    const [existing] = await db
      .select()
      .from(propertyModels)
      .where(eq(propertyModels.id, modelId))
      .limit(1);

    if (!existing) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Property model not found",
      };
      return res.status(404).json(response);
    }

    // Check permission
    if (existing.leadId && !isAdmin && !(await canAccessLead(existing.leadId, userId, isAdmin))) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Access denied",
      };
      return res.status(403).json(response);
    }

    await db.delete(propertyModels).where(eq(propertyModels.id, modelId));

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: "Property model deleted successfully",
    };
    return res.json(response);
  } catch (error) {
    console.error("Error deleting property model:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

// ============================================
// Occupancy Profiles - Similar CRUD pattern
// ============================================

router.get("/occupancy-profiles", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const leadId = req.query.lead_id ? parseInt(req.query.lead_id as string) : undefined;

    const filters = [];
    if (leadId) {
      if (!isAdmin && !(await canAccessLead(leadId, userId, isAdmin))) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }
      filters.push(eq(occupancyProfiles.leadId, leadId));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const profiles = await db
      .select()
      .from(occupancyProfiles)
      .where(whereClause)
      .orderBy(desc(occupancyProfiles.createdAt));

    return res.json({ success: true, data: { profiles } });
  } catch (error) {
    console.error("Error getting occupancy profiles:", error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post("/occupancy-profiles", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const { leadId, propertyId, preset, schedule, internalGainsW, comfortPriority } = req.body;

    if (!preset) {
      return res.status(400).json({ success: false, error: "preset is required" });
    }

    if (leadId && !isAdmin && !(await canAccessLead(leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const [inserted] = await db
      .insert(occupancyProfiles)
      .values({
        leadId: leadId || null,
        propertyId: propertyId || null,
        preset,
        schedule: schedule || {},
        internalGainsW: internalGainsW || null,
        comfortPriority: comfortPriority || "balanced",
      })
      .returning();

    return res.status(201).json({ success: true, data: { profile: inserted }, message: "Occupancy profile created" });
  } catch (error) {
    console.error("Error creating occupancy profile:", error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get("/occupancy-profiles/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [profile] = await db.select().from(occupancyProfiles).where(eq(occupancyProfiles.id, req.params.id)).limit(1);

    if (!profile) return res.status(404).json({ success: false, error: "Not found" });
    if (profile.leadId && !isAdmin && !(await canAccessLead(profile.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    return res.json({ success: true, data: { profile } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch("/occupancy-profiles/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [existing] = await db.select().from(occupancyProfiles).where(eq(occupancyProfiles.id, req.params.id)).limit(1);

    if (!existing) return res.status(404).json({ success: false, error: "Not found" });
    if (existing.leadId && !isAdmin && !(await canAccessLead(existing.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const updates: any = { updatedAt: new Date() };
    ["preset", "schedule", "internalGainsW", "comfortPriority"].forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const [updated] = await db.update(occupancyProfiles).set(updates).where(eq(occupancyProfiles.id, req.params.id)).returning();
    return res.json({ success: true, data: { profile: updated } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete("/occupancy-profiles/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [existing] = await db.select().from(occupancyProfiles).where(eq(occupancyProfiles.id, req.params.id)).limit(1);

    if (!existing) return res.status(404).json({ success: false, error: "Not found" });
    if (existing.leadId && !isAdmin && !(await canAccessLead(existing.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    await db.delete(occupancyProfiles).where(eq(occupancyProfiles.id, req.params.id));
    return res.json({ success: true, data: null });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// DHW Profiles - Similar CRUD pattern
// ============================================

router.get("/dhw-profiles", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const leadId = req.query.lead_id ? parseInt(req.query.lead_id as string) : undefined;

    const filters = [];
    if (leadId) {
      if (!isAdmin && !(await canAccessLead(leadId, userId, isAdmin))) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }
      filters.push(eq(dhwProfiles.leadId, leadId));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const profiles = await db.select().from(dhwProfiles).where(whereClause).orderBy(desc(dhwProfiles.createdAt));

    return res.json({ success: true, data: { profiles } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post("/dhw-profiles", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const { leadId, propertyId, occupants, showersPerDay, bathsPerWeek, targetTempC, coldInletTempC, mixergyEnabled, mixergyStrategy } = req.body;

    if (!occupants || !showersPerDay || !bathsPerWeek) {
      return res.status(400).json({ success: false, error: "occupants, showersPerDay, bathsPerWeek are required" });
    }

    if (leadId && !isAdmin && !(await canAccessLead(leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const [inserted] = await db
      .insert(dhwProfiles)
      .values({
        leadId: leadId || null,
        propertyId: propertyId || null,
        occupants,
        showersPerDay,
        bathsPerWeek,
        targetTempC: targetTempC || "50",
        coldInletTempC: coldInletTempC || null,
        mixergyEnabled: mixergyEnabled || false,
        mixergyStrategy: mixergyStrategy || {},
      })
      .returning();

    return res.status(201).json({ success: true, data: { profile: inserted } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get("/dhw-profiles/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [profile] = await db.select().from(dhwProfiles).where(eq(dhwProfiles.id, req.params.id)).limit(1);

    if (!profile) return res.status(404).json({ success: false, error: "Not found" });
    if (profile.leadId && !isAdmin && !(await canAccessLead(profile.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    return res.json({ success: true, data: { profile } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch("/dhw-profiles/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [existing] = await db.select().from(dhwProfiles).where(eq(dhwProfiles.id, req.params.id)).limit(1);

    if (!existing) return res.status(404).json({ success: false, error: "Not found" });
    if (existing.leadId && !isAdmin && !(await canAccessLead(existing.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const updates: any = { updatedAt: new Date() };
    ["occupants", "showersPerDay", "bathsPerWeek", "targetTempC", "coldInletTempC", "mixergyEnabled", "mixergyStrategy"].forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const [updated] = await db.update(dhwProfiles).set(updates).where(eq(dhwProfiles.id, req.params.id)).returning();
    return res.json({ success: true, data: { profile: updated } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete("/dhw-profiles/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [existing] = await db.select().from(dhwProfiles).where(eq(dhwProfiles.id, req.params.id)).limit(1);

    if (!existing) return res.status(404).json({ success: false, error: "Not found" });
    if (existing.leadId && !isAdmin && !(await canAccessLead(existing.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    await db.delete(dhwProfiles).where(eq(dhwProfiles.id, req.params.id));
    return res.json({ success: true, data: null });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// Scenarios - Similar CRUD pattern
// ============================================

router.get("/scenarios", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const leadId = req.query.lead_id ? parseInt(req.query.lead_id as string) : undefined;

    const filters = [];
    if (leadId) {
      if (!isAdmin && !(await canAccessLead(leadId, userId, isAdmin))) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }
      filters.push(eq(scenarios.leadId, leadId));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const scenarioList = await db.select().from(scenarios).where(whereClause).orderBy(desc(scenarios.createdAt));

    return res.json({ success: true, data: { scenarios: scenarioList } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post("/scenarios", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const { leadId, propertyId, name, techStack, controlStrategy, capex, disruptionScore, assumptionsOverrides } = req.body;

    if (!name || !techStack || !controlStrategy) {
      return res.status(400).json({ success: false, error: "name, techStack, controlStrategy are required" });
    }

    if (leadId && !isAdmin && !(await canAccessLead(leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const [inserted] = await db
      .insert(scenarios)
      .values({
        leadId: leadId || null,
        propertyId: propertyId || null,
        name,
        techStack,
        controlStrategy,
        capex: capex || {},
        disruptionScore: disruptionScore || null,
        assumptionsOverrides: assumptionsOverrides || {},
      })
      .returning();

    return res.status(201).json({ success: true, data: { scenario: inserted } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get("/scenarios/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [scenario] = await db.select().from(scenarios).where(eq(scenarios.id, req.params.id)).limit(1);

    if (!scenario) return res.status(404).json({ success: false, error: "Not found" });
    if (scenario.leadId && !isAdmin && !(await canAccessLead(scenario.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    return res.json({ success: true, data: { scenario } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch("/scenarios/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [existing] = await db.select().from(scenarios).where(eq(scenarios.id, req.params.id)).limit(1);

    if (!existing) return res.status(404).json({ success: false, error: "Not found" });
    if (existing.leadId && !isAdmin && !(await canAccessLead(existing.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const updates: any = { updatedAt: new Date() };
    ["name", "techStack", "controlStrategy", "capex", "disruptionScore", "assumptionsOverrides"].forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const [updated] = await db.update(scenarios).set(updates).where(eq(scenarios.id, req.params.id)).returning();
    return res.json({ success: true, data: { scenario: updated } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete("/scenarios/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [existing] = await db.select().from(scenarios).where(eq(scenarios.id, req.params.id)).limit(1);

    if (!existing) return res.status(404).json({ success: false, error: "Not found" });
    if (existing.leadId && !isAdmin && !(await canAccessLead(existing.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    await db.delete(scenarios).where(eq(scenarios.id, req.params.id));
    return res.json({ success: true, data: null });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// Journeys - Similar CRUD pattern
// ============================================

router.get("/journeys", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const leadId = req.query.lead_id ? parseInt(req.query.lead_id as string) : undefined;

    const filters = [];
    if (leadId) {
      if (!isAdmin && !(await canAccessLead(leadId, userId, isAdmin))) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }
      filters.push(eq(journeys.leadId, leadId));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const journeyList = await db.select().from(journeys).where(whereClause).orderBy(desc(journeys.createdAt));

    return res.json({ success: true, data: { journeys: journeyList } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post("/journeys", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const { leadId, propertyId, name, steps, reportPins } = req.body;

    if (!name || !steps) {
      return res.status(400).json({ success: false, error: "name and steps are required" });
    }

    if (leadId && !isAdmin && !(await canAccessLead(leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const [inserted] = await db
      .insert(journeys)
      .values({
        leadId: leadId || null,
        propertyId: propertyId || null,
        name,
        steps,
        reportPins: reportPins || {},
      })
      .returning();

    return res.status(201).json({ success: true, data: { journey: inserted } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get("/journeys/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [journey] = await db.select().from(journeys).where(eq(journeys.id, req.params.id)).limit(1);

    if (!journey) return res.status(404).json({ success: false, error: "Not found" });
    if (journey.leadId && !isAdmin && !(await canAccessLead(journey.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    return res.json({ success: true, data: { journey } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch("/journeys/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [existing] = await db.select().from(journeys).where(eq(journeys.id, req.params.id)).limit(1);

    if (!existing) return res.status(404).json({ success: false, error: "Not found" });
    if (existing.leadId && !isAdmin && !(await canAccessLead(existing.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const updates: any = { updatedAt: new Date() };
    ["name", "steps", "reportPins"].forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const [updated] = await db.update(journeys).set(updates).where(eq(journeys.id, req.params.id)).returning();
    return res.json({ success: true, data: { journey: updated } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete("/journeys/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const [existing] = await db.select().from(journeys).where(eq(journeys.id, req.params.id)).limit(1);

    if (!existing) return res.status(404).json({ success: false, error: "Not found" });
    if (existing.leadId && !isAdmin && !(await canAccessLead(existing.leadId, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    await db.delete(journeys).where(eq(journeys.id, req.params.id));
    return res.json({ success: true, data: null });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
