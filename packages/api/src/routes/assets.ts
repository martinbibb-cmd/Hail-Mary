/**
 * Media Receiver: Asset ingest + listing + download
 *
 * Endpoints:
 * - POST   /api/leads/:leadId/visits/:visitId/assets      (multipart/form-data)
 * - GET    /api/leads/:leadId/visits/:visitId/assets
 * - GET    /api/assets/:assetId/download
 *
 * Storage:
 * - Local filesystem under: ${DATA_DIR}/uploads/leads/{leadId}/visits/{visitId}/{kind}/{assetId}.{ext}
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";

import { db } from "../db/drizzle-client";
import { assets, visitEvents, visitSessions } from "../db/drizzle-schema";
import { optionalAuth } from "../middleware/auth.middleware";
import type { ApiResponse } from "@hail-mary/shared";

const router = Router();

// Use optional auth to allow unauthenticated access for PWA photo/asset uploads
router.use(optionalAuth);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "../../data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const ALLOWED_EXTS = new Set([
  "m4a",
  "mp3",
  "wav",
  "jpg",
  "jpeg",
  "png",
  "heic",
  "txt",
  "json",
  "obj",
  "glb",
  "usdz",
]);

type AssetKind = "audio" | "image" | "text" | "model" | "other";

function normalizeExt(originalName: string): string | null {
  const ext = path.extname(originalName || "").toLowerCase().replace(".", "");
  return ext ? ext : null;
}

function detectKind(mimeType: string, ext: string): AssetKind {
  const mt = (mimeType || "").toLowerCase();
  const e = (ext || "").toLowerCase();

  if (mt.startsWith("audio/") || ["m4a", "mp3", "wav"].includes(e)) return "audio";
  if (mt.startsWith("image/") || ["jpg", "jpeg", "png", "heic"].includes(e)) return "image";
  if (mt.startsWith("text/") || mt === "application/json" || ["txt", "json"].includes(e)) return "text";
  if (["obj", "glb", "usdz"].includes(e)) return "model";
  return "other";
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 250 * 1024 * 1024, // 250MB (models can be large)
    files: 25,
  },
  fileFilter: (_req, file, cb) => {
    const ext = normalizeExt(file.originalname);
    if (!ext || !ALLOWED_EXTS.has(ext)) {
      cb(new Error(`File extension .${ext || "?"} not allowed`));
      return;
    }
    cb(null, true);
  },
});

// POST /leads/:leadId/visits/:visitId/assets
router.post(
  "/leads/:leadId/visits/:visitId/assets",
  upload.any(),
  async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const visitId = parseInt(req.params.visitId);

      if (Number.isNaN(leadId) || Number.isNaN(visitId)) {
        const response: ApiResponse<null> = { success: false, error: "Invalid leadId or visitId" };
        return res.status(400).json(response);
      }

      const files = (req.files || []) as Express.Multer.File[];
      if (!files.length) {
        const response: ApiResponse<null> = { success: false, error: "No files uploaded" };
        return res.status(400).json(response);
      }

      // Ensure visit belongs to lead
      const visitRows = await db
        .select()
        .from(visitSessions)
        .where(and(eq(visitSessions.id, visitId), eq(visitSessions.leadId, leadId)))
        .limit(1);
      if (visitRows.length === 0) {
        const response: ApiResponse<null> = { success: false, error: "Visit not found for lead" };
        return res.status(404).json(response);
      }

      ensureDir(UPLOADS_DIR);

      const deviceId =
        typeof req.body?.deviceId === "string" && req.body.deviceId.trim() ? req.body.deviceId.trim() : null;

      const results: Array<{ assetId: string; kind: AssetKind }> = [];

      for (const file of files) {
        const ext = normalizeExt(file.originalname);
        if (!ext || !ALLOWED_EXTS.has(ext)) {
          // should be blocked by multer, but keep it defensive
          continue;
        }

        const kind = detectKind(file.mimetype, ext);
        const assetId = crypto.randomUUID();
        const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");

        const storageKey = path.posix.join(
          "leads",
          String(leadId),
          "visits",
          String(visitId),
          kind,
          `${assetId}.${ext}`
        );
        const fullPath = path.join(UPLOADS_DIR, storageKey);
        ensureDir(path.dirname(fullPath));

        await fs.promises.writeFile(fullPath, file.buffer);

        await db.insert(assets).values({
          id: assetId,
          leadId,
          visitId,
          kind,
          mimeType: file.mimetype || "application/octet-stream",
          ext,
          bytes: file.size,
          sha256,
          storageProvider: "local",
          storageKey,
          originalFilename: file.originalname || null,
          capturedAt: null,
          deviceId,
        });

        await db.insert(visitEvents).values({
          id: crypto.randomUUID(),
          leadId,
          visitId,
          type: "asset.imported",
          seq: null,
          payload: {
            assetId,
            kind,
            storageKey,
            filename: file.originalname || null,
          },
          deviceId,
        });

        results.push({ assetId, kind });
      }

      const response: ApiResponse<{ assets: Array<{ assetId: string; kind: AssetKind }> }> = {
        success: true,
        data: { assets: results },
      };
      return res.status(201).json(response);
    } catch (error) {
      console.error("Error importing assets:", error);
      const response: ApiResponse<null> = { success: false, error: (error as Error).message };
      return res.status(500).json(response);
    }
  }
);

// GET /leads/:leadId/visits/:visitId/assets
router.get("/leads/:leadId/visits/:visitId/assets", async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.leadId);
    const visitId = parseInt(req.params.visitId);

    if (Number.isNaN(leadId) || Number.isNaN(visitId)) {
      const response: ApiResponse<null> = { success: false, error: "Invalid leadId or visitId" };
      return res.status(400).json(response);
    }

    const rows = await db
      .select()
      .from(assets)
      .where(and(eq(assets.leadId, leadId), eq(assets.visitId, visitId)))
      .orderBy(desc(assets.createdAt));

    const response: ApiResponse<
      Array<{
        id: string;
        leadId: number;
        visitId: number;
        kind: string;
        mimeType: string;
        ext: string;
        bytes: number | null;
        sha256: string | null;
        storageKey: string;
        originalFilename: string | null;
        createdAt: Date;
        downloadUrl: string;
      }>
    > = {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        leadId: r.leadId,
        visitId: r.visitId,
        kind: r.kind,
        mimeType: r.mimeType,
        ext: r.ext,
        bytes: r.bytes ?? null,
        sha256: r.sha256 ?? null,
        storageKey: r.storageKey,
        originalFilename: r.originalFilename ?? null,
        createdAt: r.createdAt,
        downloadUrl: `/api/assets/${r.id}/download`,
      })),
    };

    return res.json(response);
  } catch (error) {
    console.error("Error listing assets:", error);
    const response: ApiResponse<null> = { success: false, error: (error as Error).message };
    return res.status(500).json(response);
  }
});

// GET /assets/:assetId/download
router.get("/assets/:assetId/download", async (req: Request, res: Response) => {
  try {
    const assetId = req.params.assetId;
    if (!assetId) {
      const response: ApiResponse<null> = { success: false, error: "Missing assetId" };
      return res.status(400).json(response);
    }

    const rows = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    if (rows.length === 0) {
      const response: ApiResponse<null> = { success: false, error: "Asset not found" };
      return res.status(404).json(response);
    }

    const asset = rows[0];
    const fullPath = path.join(UPLOADS_DIR, asset.storageKey);

    if (!fs.existsSync(fullPath)) {
      const response: ApiResponse<null> = { success: false, error: "Asset not found on disk" };
      return res.status(404).json(response);
    }

    const stat = fs.statSync(fullPath);
    res.setHeader("Content-Type", asset.mimeType || "application/octet-stream");

    const filename = asset.originalFilename || `asset-${asset.id}.${asset.ext}`;
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Length", stat.size);

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  } catch (error) {
    console.error("Error downloading asset:", error);
    const response: ApiResponse<null> = { success: false, error: (error as Error).message };
    return res.status(500).json(response);
  }
});

export default router;

