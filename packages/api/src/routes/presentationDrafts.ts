/**
 * Presentation Drafts (PR12b)
 *
 * Drafts are visit-based "Customer Packs" that can be refined over time.
 *
 * Endpoints:
 * - POST  /api/presentation/drafts
 * - GET   /api/presentation/drafts?visitId=...
 * - PATCH /api/presentation/drafts/:id
 */

import { Router, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/drizzle-client";
import { presentationDrafts, spineVisits } from "../db/drizzle-schema";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuid(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  if (!v) return null;
  return UUID_RE.test(v) ? v : null;
}

function asOptionalString(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  return v ? v : null;
}

function asUuidArray(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  for (const v of input) {
    const id = asUuid(v);
    if (!id) continue;
    out.push(id);
    if (out.length >= 500) break;
  }
  return out;
}

function asJsonValue(input: unknown): unknown {
  // We store sections as jsonb; keep validation minimal and safe.
  if (input === null) return null;
  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return null;
    // Allow string sections payload (rare) but try parse first.
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  }
  if (typeof input === "number" || typeof input === "boolean") return input;
  if (Array.isArray(input)) return input;
  if (typeof input === "object") return input;
  return null;
}

type CreateDraftBody = {
  visitId?: unknown;
  title?: unknown;
  sections?: unknown;
  selectedPhotoEventIds?: unknown;
  selectedAssetIds?: unknown;
};

// POST /api/presentation/drafts
router.post("/drafts", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as CreateDraftBody;
    const visitId = asUuid(body.visitId);
    if (!visitId) return res.status(400).json({ success: false, error: "visitId is required" });

    // Ensure visit exists
    const visitRows = await db.select({ id: spineVisits.id }).from(spineVisits).where(eq(spineVisits.id, visitId)).limit(1);
    if (!visitRows[0]) return res.status(404).json({ success: false, error: "Visit not found" });

    const title = asOptionalString(body.title) ?? "Customer Pack";
    const sections = asJsonValue(body.sections) ?? [];
    const selectedPhotoEventIds = asUuidArray(body.selectedPhotoEventIds) ?? [];
    const selectedAssetIds = asUuidArray(body.selectedAssetIds) ?? [];

    const [inserted] = await db
      .insert(presentationDrafts)
      .values({
        visitId,
        title,
        sections: sections as any,
        selectedPhotoEventIds,
        selectedAssetIds,
      })
      .returning();

    return res.status(201).json({ success: true, data: inserted });
  } catch (error) {
    console.error("Error creating presentation draft:", error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/presentation/drafts?visitId=...
router.get("/drafts", async (req: Request, res: Response) => {
  try {
    const visitId = asUuid(req.query.visitId);
    if (!visitId) return res.status(400).json({ success: false, error: "visitId is required" });

    const rows = await db
      .select()
      .from(presentationDrafts)
      .where(eq(presentationDrafts.visitId, visitId))
      .orderBy(desc(presentationDrafts.createdAt))
      .limit(50);

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error listing presentation drafts:", error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

type PatchDraftBody = {
  visitId?: unknown; // not updatable (guarded)
  title?: unknown;
  sections?: unknown;
  selectedPhotoEventIds?: unknown;
  selectedAssetIds?: unknown;
};

// PATCH /api/presentation/drafts/:id
router.patch("/drafts/:id", async (req: Request, res: Response) => {
  try {
    const id = asUuid(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid draft id" });

    const body = (req.body ?? {}) as PatchDraftBody;

    const title = body.title !== undefined ? asOptionalString(body.title) : undefined;
    const sections = body.sections !== undefined ? asJsonValue(body.sections) : undefined;
    const selectedPhotoEventIds =
      body.selectedPhotoEventIds !== undefined ? (asUuidArray(body.selectedPhotoEventIds) ?? []) : undefined;
    const selectedAssetIds = body.selectedAssetIds !== undefined ? (asUuidArray(body.selectedAssetIds) ?? []) : undefined;

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title || "Customer Pack";
    if (sections !== undefined) updates.sections = (sections ?? []) as any;
    if (selectedPhotoEventIds !== undefined) updates.selectedPhotoEventIds = selectedPhotoEventIds;
    if (selectedAssetIds !== undefined) updates.selectedAssetIds = selectedAssetIds;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: "No updatable fields provided" });
    }

    const updated = await db
      .update(presentationDrafts)
      .set(updates)
      .where(eq(presentationDrafts.id, id))
      .returning();

    if (!updated[0]) return res.status(404).json({ success: false, error: "Draft not found" });

    return res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error("Error updating presentation draft:", error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;

