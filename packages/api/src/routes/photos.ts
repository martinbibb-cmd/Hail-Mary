/**
 * Photos Routes (PR14)
 *
 * Postcode-based property photos with metadata
 *
 * Endpoints:
 * - POST /api/photos              (upload photo with metadata)
 * - GET  /api/photos?postcode=... (list photos)
 * - GET  /api/photos/:id          (get photo detail)
 * - DELETE /api/photos/:id        (delete photo)
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../db/drizzle-client";
import { photos } from "../db/drizzle-schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import type { ApiResponse, PaginatedResponse } from "@hail-mary/shared";

const router = Router();

// Multer setup for photo uploads
const PHOTOS_DIR = process.env.PHOTOS_DIR || path.join(process.cwd(), "../../data/photos");
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const userId = req.user?.id;
      const userDir = path.join(PHOTOS_DIR, String(userId));
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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.mimetype.toLowerCase())) {
      cb(new Error(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`));
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
 * POST /api/photos
 * Upload photo with metadata
 */
router.post("/", requireAuth, upload.single('photo'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      const response: ApiResponse<null> = { success: false, error: "No photo uploaded" };
      return res.status(400).json(response);
    }

    const { postcode, notes, tag, latitude, longitude } = req.body;

    if (!postcode || typeof postcode !== 'string') {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      const response: ApiResponse<null> = { success: false, error: "postcode is required" };
      return res.status(400).json(response);
    }

    // Parse latitude/longitude if provided
    const lat = latitude ? parseFloat(latitude) : null;
    const lon = longitude ? parseFloat(longitude) : null;

    const [inserted] = await db
      .insert(photos)
      .values({
        userId,
        postcode: postcode.trim().toUpperCase(),
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath: file.path,
        notes: notes || null,
        tag: tag || null,
        latitude: lat !== null && !isNaN(lat) ? String(lat) : null,
        longitude: lon !== null && !isNaN(lon) ? String(lon) : null,
      })
      .returning();

    const response: ApiResponse<{ photo: typeof inserted }> = {
      success: true,
      data: { photo: inserted },
      message: "Photo uploaded successfully",
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error uploading photo:", error);
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
 * GET /api/photos?postcode=...&page=1&limit=50
 * List photos with optional postcode filter
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const postcode = req.query.postcode as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const conditions = [eq(photos.userId, userId)];

    if (postcode) {
      conditions.push(eq(photos.postcode, postcode.trim().toUpperCase()));
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(and(...conditions));

    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Get paginated results
    const rows = await db
      .select()
      .from(photos)
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt))
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
    console.error("Error listing photos:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/photos/:id
 * Get photo detail by ID
 */
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseId(req.params.id);

    if (!id) {
      const response: ApiResponse<null> = { success: false, error: "Invalid photo ID" };
      return res.status(400).json(response);
    }

    const [photo] = await db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.id, id),
          eq(photos.userId, userId)
        )
      )
      .limit(1);

    if (!photo) {
      const response: ApiResponse<null> = { success: false, error: "Photo not found" };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ photo: typeof photo }> = {
      success: true,
      data: { photo },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting photo:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * DELETE /api/photos/:id
 * Delete photo by ID
 */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseId(req.params.id);

    if (!id) {
      const response: ApiResponse<null> = { success: false, error: "Invalid photo ID" };
      return res.status(400).json(response);
    }

    // Get photo to delete file
    const [photo] = await db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.id, id),
          eq(photos.userId, userId)
        )
      )
      .limit(1);

    if (!photo) {
      const response: ApiResponse<null> = { success: false, error: "Photo not found" };
      return res.status(404).json(response);
    }

    // Delete from database
    await db
      .delete(photos)
      .where(eq(photos.id, id));

    // Delete file from storage
    try {
      if (fs.existsSync(photo.storagePath)) {
        fs.unlinkSync(photo.storagePath);
      }
    } catch (fileError) {
      console.error("Error deleting photo file:", fileError);
      // Continue even if file deletion fails
    }

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
      message: "Photo deleted successfully",
    };
    return res.json(response);
  } catch (error) {
    console.error("Error deleting photo:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

export default router;
