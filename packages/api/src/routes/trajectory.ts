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

// ============================================
// Projection Engine - Mock Implementation (PR2)
// ============================================

// UK seasonality weights (sum = 1.0, higher in winter months)
const UK_MONTHLY_SEASONALITY = [
  0.14, // Jan
  0.13, // Feb
  0.11, // Mar
  0.08, // Apr
  0.05, // May
  0.03, // Jun
  0.02, // Jul
  0.03, // Aug
  0.05, // Sep
  0.09, // Oct
  0.12, // Nov
  0.15, // Dec
];

// Occupancy preset multipliers
const OCCUPANCY_MULTIPLIERS: Record<string, number> = {
  WFH: 1.15,
  always_home: 1.25,
  "9to5_out": 0.90,
  shift: 1.00,
};

// Grid decarb path multipliers (applied to grid intensity over time)
const GRID_DECARB_PATHS: Record<string, (year: number, baseYear: number) => number> = {
  central: (year: number, baseYear: number) => {
    const yearsDiff = year - baseYear;
    return Math.max(0.4, 1.0 - yearsDiff * 0.04); // -4% per year, floor at 40%
  },
  fast: (year: number, baseYear: number) => {
    const yearsDiff = year - baseYear;
    return Math.max(0.2, 1.0 - yearsDiff * 0.06); // -6% per year, floor at 20%
  },
  slow: (year: number, baseYear: number) => {
    const yearsDiff = year - baseYear;
    return Math.max(0.6, 1.0 - yearsDiff * 0.02); // -2% per year, floor at 60%
  },
};

interface MockEngineInputs {
  propertyModel: any;
  occupancyProfile: any;
  dhwProfile: any;
  scenario: any;
  assumptionsSnapshot: any;
  gridDecarbPath: string;
  horizonYears: number;
  startYear: number;
}

interface MonthlyProjection {
  period_start: string;
  space_heat: {
    kwh_by_tech: Record<string, number>;
    elec_kwh: number;
    gas_kwh: number;
  };
  dhw: {
    kwh_by_tech: Record<string, number>;
    elec_kwh: number;
    gas_kwh: number;
  };
  totals: {
    elec_kwh: number;
    gas_kwh: number;
    cost_gbp: number;
    carbon_kgco2e: number;
  };
  confidence: {
    low_factor: number;
    high_factor: number;
  };
}

interface YearlyProjection {
  year: number;
  elec_kwh: number;
  gas_kwh: number;
  cost_gbp: number;
  carbon_kgco2e: number;
}

/**
 * Mock projection engine - deterministic calculations
 * Returns consistent outputs based on inputs for UI development
 */
function calculateMockProjection(inputs: MockEngineInputs) {
  const {
    propertyModel,
    occupancyProfile,
    dhwProfile,
    scenario,
    assumptionsSnapshot,
    gridDecarbPath,
    horizonYears,
    startYear,
  } = inputs;

  // Calculate baseline annual space heat kWh
  let baselineSpaceHeatKwh = 0;
  if (propertyModel.zones && Array.isArray(propertyModel.zones) && propertyModel.zones.length > 0) {
    // Sum heat_loss_w_per_k from all zones
    baselineSpaceHeatKwh = propertyModel.zones.reduce((sum: number, zone: any) => {
      return sum + (zone.heat_loss_w_per_k || 0);
    }, 0) * 35; // Simple constant multiplier
  } else if (propertyModel.floorAreaM2) {
    // Fallback: floor area * 90 kWh/m2
    baselineSpaceHeatKwh = parseFloat(propertyModel.floorAreaM2) * 90;
  } else {
    // Default estimate
    baselineSpaceHeatKwh = 12000;
  }

  // Apply occupancy multiplier
  const occupancyMultiplier = OCCUPANCY_MULTIPLIERS[occupancyProfile.preset] || 1.0;
  const annualSpaceHeatKwh = baselineSpaceHeatKwh * occupancyMultiplier;

  // Calculate DHW baseline (litres/day -> kWh/day -> annual)
  const litresPerDay =
    (dhwProfile.showersPerDay || 0) * 45 +
    ((dhwProfile.bathsPerWeek || 0) * 80) / 7 +
    (dhwProfile.occupants || 1) * 10;
  const tempDelta = parseFloat(dhwProfile.targetTempC || "50") - 10; // cold inlet ~10C
  const dhwKwhPerDay = (litresPerDay * 4.186 * tempDelta) / 3600;
  const annualDhwKwh = dhwKwhPerDay * 365;

  // Confidence band
  const hasZoneData = propertyModel.zones && Array.isArray(propertyModel.zones) && propertyModel.zones.length > 0;
  const confidenceLow = hasZoneData ? 0.88 : 0.75;
  const confidenceHigh = hasZoneData ? 1.12 : 1.25;

  // Generate monthly projections
  const monthly: MonthlyProjection[] = [];
  const baseYear = startYear;

  for (let yearOffset = 0; yearOffset < horizonYears; yearOffset++) {
    const year = baseYear + yearOffset;

    // Apply grid decarb path
    const decarbFunction = GRID_DECARB_PATHS[gridDecarbPath] || GRID_DECARB_PATHS.central;
    const gridIntensityMultiplier = decarbFunction(year, baseYear);
    const gridIntensity = parseFloat(assumptionsSnapshot.gridIntensityGco2ePerKwh) * gridIntensityMultiplier;
    const gasIntensity = parseFloat(assumptionsSnapshot.gasIntensityGco2ePerKwh);

    // Energy prices
    const elecRate = parseFloat(assumptionsSnapshot.electricityUnitPPerKwh) / 100; // convert pence to pounds
    const gasRate = parseFloat(assumptionsSnapshot.gasUnitPPerKwh) / 100;

    for (let month = 0; month < 12; month++) {
      const monthlySpaceHeat = annualSpaceHeatKwh * UK_MONTHLY_SEASONALITY[month];
      const monthlyDhw = annualDhwKwh / 12;

      // Allocate space heat by tech stack
      const spaceHeatByTech: Record<string, number> = {};
      let spaceHeatElecKwh = 0;
      let spaceHeatGasKwh = 0;

      if (scenario.techStack && scenario.techStack.space_heat) {
        for (const tech of scenario.techStack.space_heat) {
          const techType = tech.type;
          const servedFraction = 1.0 / scenario.techStack.space_heat.length; // Simple equal split
          const techKwh = monthlySpaceHeat * servedFraction;

          if (techType === "air_to_air" || techType === "heat_pump") {
            const scop = tech.scop || tech.seasonal_cop || 3.0;
            const elecKwh = techKwh / Math.max(1.0, scop);
            spaceHeatByTech[techType] = elecKwh;
            spaceHeatElecKwh += elecKwh;
          } else if (techType === "gas_boiler") {
            const eff = tech.seasonal_eff || 0.85;
            const gasKwh = techKwh / Math.max(0.65, eff);
            spaceHeatByTech[techType] = gasKwh;
            spaceHeatGasKwh += gasKwh;
          }
        }
      } else {
        // Default: 100% gas boiler
        const gasKwh = monthlySpaceHeat / 0.85;
        spaceHeatByTech.gas_boiler = gasKwh;
        spaceHeatGasKwh = gasKwh;
      }

      // Allocate DHW by tech stack
      const dhwByTech: Record<string, number> = {};
      let dhwElecKwh = 0;
      let dhwGasKwh = 0;

      if (scenario.techStack && scenario.techStack.dhw) {
        for (const tech of scenario.techStack.dhw) {
          const techType = tech.type;

          if (techType === "mixergy" && dhwProfile.mixergyEnabled) {
            // Mixergy: 70% from electric (top slice efficiency)
            const elecFraction = 0.7;
            dhwElecKwh = monthlyDhw * elecFraction;
            dhwGasKwh = monthlyDhw * (1 - elecFraction) / 0.85;
            dhwByTech.mixergy_elec = dhwElecKwh;
            dhwByTech.gas = dhwGasKwh;
          } else if (techType === "electric" || techType === "heat_pump") {
            const cop = tech.cop || 2.5;
            dhwElecKwh = monthlyDhw / Math.max(1.0, cop);
            dhwByTech[techType] = dhwElecKwh;
          } else {
            // Gas DHW
            dhwGasKwh = monthlyDhw / 0.80;
            dhwByTech.gas = dhwGasKwh;
          }
        }
      } else {
        // Default: gas DHW
        dhwGasKwh = monthlyDhw / 0.80;
        dhwByTech.gas = dhwGasKwh;
      }

      // Totals
      const totalElecKwh = spaceHeatElecKwh + dhwElecKwh;
      const totalGasKwh = spaceHeatGasKwh + dhwGasKwh;

      // Cost calculation
      const elecCost = totalElecKwh * elecRate;
      const gasCost = totalGasKwh * gasRate;
      const standingCharges =
        ((parseFloat(assumptionsSnapshot.elecStandingChargePPerDay || "0") +
          parseFloat(assumptionsSnapshot.gasStandingChargePPerDay || "0")) *
          30) /
        100; // 30 days, convert pence to pounds
      const totalCostGbp = elecCost + gasCost + standingCharges;

      // Carbon calculation
      const totalCarbonKgCo2e = (totalElecKwh * gridIntensity + totalGasKwh * gasIntensity) / 1000; // gCO2e -> kgCO2e

      // Build monthly projection
      const periodDate = new Date(year, month, 1);
      monthly.push({
        period_start: periodDate.toISOString().split("T")[0],
        space_heat: {
          kwh_by_tech: spaceHeatByTech,
          elec_kwh: Math.round(spaceHeatElecKwh * 10) / 10,
          gas_kwh: Math.round(spaceHeatGasKwh * 10) / 10,
        },
        dhw: {
          kwh_by_tech: dhwByTech,
          elec_kwh: Math.round(dhwElecKwh * 10) / 10,
          gas_kwh: Math.round(dhwGasKwh * 10) / 10,
        },
        totals: {
          elec_kwh: Math.round(totalElecKwh * 10) / 10,
          gas_kwh: Math.round(totalGasKwh * 10) / 10,
          cost_gbp: Math.round(totalCostGbp * 100) / 100,
          carbon_kgco2e: Math.round(totalCarbonKgCo2e * 100) / 100,
        },
        confidence: {
          low_factor: confidenceLow,
          high_factor: confidenceHigh,
        },
      });
    }
  }

  // Aggregate into yearly
  const yearly: YearlyProjection[] = [];
  for (let yearOffset = 0; yearOffset < horizonYears; yearOffset++) {
    const year = baseYear + yearOffset;
    const yearMonths = monthly.slice(yearOffset * 12, (yearOffset + 1) * 12);

    const yearElecKwh = yearMonths.reduce((sum, m) => sum + m.totals.elec_kwh, 0);
    const yearGasKwh = yearMonths.reduce((sum, m) => sum + m.totals.gas_kwh, 0);
    const yearCostGbp = yearMonths.reduce((sum, m) => sum + m.totals.cost_gbp, 0);
    const yearCarbonKgCo2e = yearMonths.reduce((sum, m) => sum + m.totals.carbon_kgco2e, 0);

    yearly.push({
      year,
      elec_kwh: Math.round(yearElecKwh),
      gas_kwh: Math.round(yearGasKwh),
      cost_gbp: Math.round(yearCostGbp * 100) / 100,
      carbon_kgco2e: Math.round(yearCarbonKgCo2e),
    });
  }

  // Summary
  const year1 = yearly[0];
  const year10 = yearly[Math.min(9, yearly.length - 1)];
  const disruptionScore = scenario.disruptionScore || 3;
  const comfortScore = occupancyProfile.comfortPriority === "comfort" ? 5 : occupancyProfile.comfortPriority === "saver" ? 3 : 4;

  return {
    monthly,
    yearly,
    summary: {
      year_1: {
        cost_gbp: year1.cost_gbp,
        carbon_kgco2e: year1.carbon_kgco2e,
      },
      year_10: {
        cost_gbp: year10.cost_gbp,
        carbon_kgco2e: year10.carbon_kgco2e,
      },
      disruption_score: disruptionScore,
      comfort_score: comfortScore,
    },
  };
}

/**
 * POST /api/trajectory/projections/scenario
 * Generate cost/carbon projection for a single scenario
 */
router.post("/projections/scenario", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    const {
      lead_id,
      property_model_id,
      occupancy_profile_id,
      dhw_profile_id,
      scenario_id,
      horizon_years,
      assumptions_snapshot_id,
      grid_decarb_path,
    } = req.body;

    // Validate required fields
    if (!property_model_id || !occupancy_profile_id || !dhw_profile_id || !scenario_id) {
      return res.status(400).json({
        success: false,
        error: "property_model_id, occupancy_profile_id, dhw_profile_id, and scenario_id are required",
      });
    }

    // Check permissions if lead_id provided
    if (lead_id && !isAdmin && !(await canAccessLead(lead_id, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Fetch entities
    const [propertyModel] = await db.select().from(propertyModels).where(eq(propertyModels.id, property_model_id)).limit(1);
    const [occupancyProfile] = await db.select().from(occupancyProfiles).where(eq(occupancyProfiles.id, occupancy_profile_id)).limit(1);
    const [dhwProfile] = await db.select().from(dhwProfiles).where(eq(dhwProfiles.id, dhw_profile_id)).limit(1);
    const [scenario] = await db.select().from(scenarios).where(eq(scenarios.id, scenario_id)).limit(1);

    if (!propertyModel || !occupancyProfile || !dhwProfile || !scenario) {
      return res.status(404).json({ success: false, error: "One or more entities not found" });
    }

    // Resolve assumptions snapshot
    let assumptionsSnapshot;
    if (assumptions_snapshot_id) {
      [assumptionsSnapshot] = await db
        .select()
        .from(assumptionsSnapshots)
        .where(eq(assumptionsSnapshots.id, assumptions_snapshot_id))
        .limit(1);
    } else {
      // Use latest for UK-GB
      [assumptionsSnapshot] = await db
        .select()
        .from(assumptionsSnapshots)
        .where(eq(assumptionsSnapshots.regionCode, "UK-GB"))
        .orderBy(desc(assumptionsSnapshots.periodStart))
        .limit(1);
    }

    if (!assumptionsSnapshot) {
      return res.status(404).json({ success: false, error: "No assumptions snapshot found" });
    }

    // Calculate projection
    const horizonYrs = horizon_years || 10;
    const gridPath = grid_decarb_path || "central";
    const startYear = new Date().getFullYear();

    const projection = calculateMockProjection({
      propertyModel,
      occupancyProfile,
      dhwProfile,
      scenario,
      assumptionsSnapshot,
      gridDecarbPath: gridPath,
      horizonYears: horizonYrs,
      startYear,
    });

    // Build response
    const response = {
      success: true,
      data: {
        metadata: {
          lead_id: lead_id || null,
          property_model_id,
          occupancy_profile_id,
          dhw_profile_id,
          scenario_id,
          journey_id: null,
          assumptions_snapshot_id: assumptionsSnapshot.id,
          region_code: assumptionsSnapshot.regionCode,
          grid_decarb_path: gridPath,
          engine_version: "0.1-mock",
          generated_at: new Date().toISOString(),
        },
        ...projection,
      },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error generating scenario projection:", error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/trajectory/projections/journey
 * Generate cost/carbon projection for a staged journey
 */
router.post("/projections/journey", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    const {
      lead_id,
      property_model_id,
      occupancy_profile_id,
      dhw_profile_id,
      journey_id,
      horizon_years,
      assumptions_snapshot_id,
      grid_decarb_path,
    } = req.body;

    // Validate required fields
    if (!property_model_id || !occupancy_profile_id || !dhw_profile_id || !journey_id) {
      return res.status(400).json({
        success: false,
        error: "property_model_id, occupancy_profile_id, dhw_profile_id, and journey_id are required",
      });
    }

    // Check permissions
    if (lead_id && !isAdmin && !(await canAccessLead(lead_id, userId, isAdmin))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Fetch entities
    const [propertyModel] = await db.select().from(propertyModels).where(eq(propertyModels.id, property_model_id)).limit(1);
    const [occupancyProfile] = await db.select().from(occupancyProfiles).where(eq(occupancyProfiles.id, occupancy_profile_id)).limit(1);
    const [dhwProfile] = await db.select().from(dhwProfiles).where(eq(dhwProfiles.id, dhw_profile_id)).limit(1);
    const [journey] = await db.select().from(journeys).where(eq(journeys.id, journey_id)).limit(1);

    if (!propertyModel || !occupancyProfile || !dhwProfile || !journey) {
      return res.status(404).json({ success: false, error: "One or more entities not found" });
    }

    // Resolve assumptions snapshot
    let assumptionsSnapshot;
    if (assumptions_snapshot_id) {
      [assumptionsSnapshot] = await db
        .select()
        .from(assumptionsSnapshots)
        .where(eq(assumptionsSnapshots.id, assumptions_snapshot_id))
        .limit(1);
    } else {
      [assumptionsSnapshot] = await db
        .select()
        .from(assumptionsSnapshots)
        .where(eq(assumptionsSnapshots.regionCode, "UK-GB"))
        .orderBy(desc(assumptionsSnapshots.periodStart))
        .limit(1);
    }

    if (!assumptionsSnapshot) {
      return res.status(404).json({ success: false, error: "No assumptions snapshot found" });
    }

    // For journey projections, use first scenario as baseline (PR2 simplification)
    // In PR3, we'll properly handle scenario transitions by date
    const journeySteps = (journey.steps || []) as any[];
    if (!journeySteps || journeySteps.length === 0) {
      return res.status(400).json({ success: false, error: "Journey has no steps" });
    }

    const firstStep = journeySteps[0];
    const [scenario] = await db.select().from(scenarios).where(eq(scenarios.id, firstStep.scenario_id)).limit(1);

    if (!scenario) {
      return res.status(404).json({ success: false, error: "Scenario not found in journey step" });
    }

    // Calculate projection
    const horizonYrs = horizon_years || 10;
    const gridPath = grid_decarb_path || "central";
    const startYear = new Date().getFullYear();

    const projection = calculateMockProjection({
      propertyModel,
      occupancyProfile,
      dhwProfile,
      scenario,
      assumptionsSnapshot,
      gridDecarbPath: gridPath,
      horizonYears: horizonYrs,
      startYear,
    });

    // Build response
    const response = {
      success: true,
      data: {
        metadata: {
          lead_id: lead_id || null,
          property_model_id,
          occupancy_profile_id,
          dhw_profile_id,
          scenario_id: null,
          journey_id,
          assumptions_snapshot_id: assumptionsSnapshot.id,
          region_code: assumptionsSnapshot.regionCode,
          grid_decarb_path: gridPath,
          engine_version: "0.1-mock",
          generated_at: new Date().toISOString(),
        },
        ...projection,
      },
    };

    return res.json(response);
  } catch (error) {
    console.error("Error generating journey projection:", error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
