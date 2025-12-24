/**
 * Scans Routes (PR15)
 *
 * Postcode-based scan sessions (LiDAR placeholder)
 *
 * Endpoints:
 * - POST /api/scans/upload          (upload scan file)
 * - GET  /api/scans?postcode=...    (list scans)
 * - GET  /api/scans/:id             (get scan detail)
 * - DELETE /api/scans/:id           (delete scan)
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../db/drizzle-client";
import { scans } from "../db/drizzle-schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import type { ApiResponse, PaginatedResponse } from "@hail-mary/shared";

const router = Router();

// Multer setup for scan uploads
const SCANS_DIR = process.env.SCANS_DIR || path.join(process.cwd(), "../../data/scans");
if (!fs.existsSync(SCANS_DIR)) {
  fs.mkdirSync(SCANS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const userId = req.user?.id;
      const userDir = path.join(SCANS_DIR, String(userId));
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      cb(null, userDir);
    },
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB for scan files
  fileFilter: (_req, file, cb) => {
    // Allow various 3D/scan file formats
    const allowedExtensions = ['.zip', '.usdz', '.reality', '.ply', '.obj', '.fbx', '.glb', '.gltf', '.e57'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      cb(new Error(`File type not allowed. Allowed: ${allowedExtensions.join(', ')}`));
      return;
    }
    cb(null, true);
  },
});

function parseId(raw: unknown): number | null {
  const n = Number.parseInt(String(raw), 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

/**
 * POST /api/scans/upload
 * Upload scan file with metadata
 */
router.post("/upload", requireAuth, upload.single('scan'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      const response: ApiResponse<null> = { success: false, error: "No scan file uploaded" };
      return res.status(400).json(response);
    }

    const { postcode, kind, deviceId, notes } = req.body;

    if (!postcode || typeof postcode !== 'string') {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      const response: ApiResponse<null> = { success: false, error: "postcode is required" };
      return res.status(400).json(response);
    }

    const [inserted] = await db
      .insert(scans)
      .values({
        userId,
        postcode: postcode.trim().toUpperCase(),
        kind: kind || 'lidar',
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath: file.path,
        deviceId: deviceId || null,
        notes: notes || null,
      })
      .returning();

    const response: ApiResponse<{ scan: typeof inserted }> = {
      success: true,
      data: { scan: inserted },
      message: "Scan uploaded successfully",
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error uploading scan:", error);
    // Clean up file on error
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/scans?postcode=...&page=1&limit=50
 * List scans with optional postcode filter
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const postcode = req.query.postcode as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const conditions = [eq(scans.userId, userId)];

    if (postcode) {
      conditions.push(eq(scans.postcode, postcode.trim().toUpperCase()));
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(scans)
      .where(and(...conditions));

    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Get paginated results
    const rows = await db
      .select()
      .from(scans)
      .where(and(...conditions))
      .orderBy(desc(scans.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const response: PaginatedResponse<typeof rows[0]> = {
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error listing scans:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/scans/:id
 * Get scan detail by ID
 */
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseId(req.params.id);

    if (!id) {
      const response: ApiResponse<null> = { success: false, error: "Invalid scan ID" };
      return res.status(400).json(response);
    }

    const [scan] = await db
      .select()
      .from(scans)
      .where(
        and(
          eq(scans.id, id),
          eq(scans.userId, userId)
        )
      )
      .limit(1);

    if (!scan) {
      const response: ApiResponse<null> = { success: false, error: "Scan not found" };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ scan: typeof scan }> = {
      success: true,
      data: { scan },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting scan:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * DELETE /api/scans/:id
 * Delete scan by ID
 */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseId(req.params.id);

    if (!id) {
      const response: ApiResponse<null> = { success: false, error: "Invalid scan ID" };
      return res.status(400).json(response);
    }

    // Get scan to delete file
    const [scan] = await db
      .select()
      .from(scans)
      .where(
        and(
          eq(scans.id, id),
          eq(scans.userId, userId)
        )
      )
      .limit(1);

    if (!scan) {
      const response: ApiResponse<null> = { success: false, error: "Scan not found" };
      return res.status(404).json(response);
    }

    // Delete from database
    await db
      .delete(scans)
      .where(eq(scans.id, id));

    // Delete file from storage
    try {
      if (fs.existsSync(scan.storagePath)) {
        fs.unlinkSync(scan.storagePath);
      }
    } catch (fileError) {
      console.error("Error deleting scan file:", fileError);
      // Continue even if file deletion fails
    }

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
      message: "Scan deleted successfully",
    };
    return res.json(response);
  } catch (error) {
    console.error("Error deleting scan:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

export default router;
