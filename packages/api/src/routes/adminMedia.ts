/**
 * Admin Media Library (PR12 / PR12a assumed)
 *
 * Read-only endpoint used by the Presentation Builder to select reusable assets.
 *
 * Endpoint:
 * - GET /api/admin/media?q=&tag=
 *
 * Notes:
 * - This route intentionally requires auth but NOT admin role, because
 *   engineers need to pick from admin-curated media.
 */

import { Router, type Request, type Response } from "express";
import { and, desc, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/drizzle-client";
import { presentationAssets } from "../db/drizzle-schema";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth);

const normalizeQuery = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
};

// GET /api/admin/media?q=&tag=
router.get("/", async (req: Request, res: Response) => {
  try {
    const q = normalizeQuery(req.query.q);
    const tag = normalizeQuery(req.query.tag);

    const whereParts: any[] = [];

    if (q) {
      const pattern = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      whereParts.push(or(ilike(presentationAssets.title, pattern), ilike(presentationAssets.description, pattern)));
    }

    if (tag) {
      // tag = ANY(tags)
      whereParts.push(sql`${tag} = ANY(${presentationAssets.tags})`);
    }

    const where = whereParts.length === 0 ? undefined : (whereParts.length === 1 ? whereParts[0] : and(...whereParts));

    const rows = await db
      .select()
      .from(presentationAssets)
      .where(where as any)
      .orderBy(desc(presentationAssets.createdAt))
      .limit(200);

    return res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        description: r.description,
        tags: r.tags ?? [],
        url: r.url,
        thumbUrl: r.thumbUrl,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error listing admin media:", error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;

