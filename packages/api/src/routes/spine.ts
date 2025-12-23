/**
 * v2 Spine Routes
 *
 * - GET  /feed?limit=50
 * - GET  /properties?postcode=SW1A1AA
 * - POST /properties
 * - GET  /properties/:id (helper for "Open property")
 * - POST /visits
 */

import { Router, Request, Response } from "express";
import { desc, eq, like } from "drizzle-orm";
import { db } from "../db/drizzle-client";
import { spineProperties, spineTimelineEvents, spineVisits } from "../db/drizzle-schema";

const router = Router();

const normalizePostcode = (input: unknown): string => {
  if (typeof input !== "string") return "";
  return input.toUpperCase().replace(/\s+/g, "").trim();
};

// GET /feed?limit=50 - latest timeline events across all properties
router.get("/feed", async (req: Request, res: Response) => {
  try {
    const limitRaw = req.query.limit;
    const limit = Math.min(200, Math.max(1, Number(limitRaw ?? 50) || 50));

    const rows = await db
      .select({
        event: spineTimelineEvents,
        visit: spineVisits,
        property: spineProperties,
      })
      .from(spineTimelineEvents)
      .innerJoin(spineVisits, eq(spineTimelineEvents.visitId, spineVisits.id))
      .innerJoin(spineProperties, eq(spineVisits.propertyId, spineProperties.id))
      .orderBy(desc(spineTimelineEvents.ts))
      .limit(limit);

    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.event.id,
        type: r.event.type,
        ts: r.event.ts,
        payload: r.event.payload,
        geo: r.event.geo,
        visit: {
          id: r.visit.id,
          propertyId: r.visit.propertyId,
          startedAt: r.visit.startedAt,
          endedAt: r.visit.endedAt,
        },
        property: {
          id: r.property.id,
          addressLine1: r.property.addressLine1,
          addressLine2: r.property.addressLine2,
          town: r.property.town,
          postcode: r.property.postcode,
        },
      })),
    });
  } catch (error) {
    console.error("Error loading spine feed:", error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /properties?postcode=SW1A1AA - postcode-first property search
router.get("/properties", async (req: Request, res: Response) => {
  try {
    const postcodeNorm = normalizePostcode(req.query.postcode);
    if (!postcodeNorm) {
      return res.json({ success: true, data: [] });
    }

    // Prefix match to support partial entry while typing.
    const rows = await db
      .select()
      .from(spineProperties)
      .where(like(spineProperties.postcode, `${postcodeNorm}%`))
      .orderBy(spineProperties.postcode)
      .limit(50);

    res.json({
      success: true,
      data: rows.map((p) => ({
        id: p.id,
        addressLine1: p.addressLine1,
        addressLine2: p.addressLine2,
        town: p.town,
        postcode: p.postcode,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error searching spine properties:", error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /properties/:id - helper for "Open property"
router.get("/properties/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const [row] = await db.select().from(spineProperties).where(eq(spineProperties.id, id)).limit(1);
    if (!row) return res.status(404).json({ success: false, error: "Property not found" });

    res.json({
      success: true,
      data: {
        id: row.id,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        town: row.town,
        postcode: row.postcode,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error getting spine property:", error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// POST /properties - create property
router.post("/properties", async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<{
      addressLine1: string;
      addressLine2?: string | null;
      town?: string | null;
      postcode: string;
    }>;

    if (!body.addressLine1?.trim()) {
      return res.status(400).json({ success: false, error: "addressLine1 is required" });
    }

    const postcodeNorm = normalizePostcode(body.postcode);
    if (!postcodeNorm) {
      return res.status(400).json({ success: false, error: "postcode is required" });
    }

    const [inserted] = await db
      .insert(spineProperties)
      .values({
        addressLine1: body.addressLine1.trim(),
        addressLine2: body.addressLine2 ?? null,
        town: body.town ?? null,
        postcode: postcodeNorm,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: {
        id: inserted.id,
        addressLine1: inserted.addressLine1,
        addressLine2: inserted.addressLine2,
        town: inserted.town,
        postcode: inserted.postcode,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating spine property:", error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// POST /visits - create visit for a property
router.post("/visits", async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<{ propertyId: string }>;
    if (!body.propertyId) {
      return res.status(400).json({ success: false, error: "propertyId is required" });
    }

    // Ensure property exists
    const [property] = await db
      .select({ id: spineProperties.id })
      .from(spineProperties)
      .where(eq(spineProperties.id, body.propertyId))
      .limit(1);
    if (!property) return res.status(404).json({ success: false, error: "Property not found" });

    const [visit] = await db
      .insert(spineVisits)
      .values({ propertyId: body.propertyId })
      .returning();

    res.status(201).json({
      success: true,
      data: {
        id: visit.id,
        propertyId: visit.propertyId,
        startedAt: visit.startedAt,
        endedAt: visit.endedAt,
        createdAt: visit.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating spine visit:", error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;

