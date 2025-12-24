/**
 * Uploads (v2 spine helper)
 *
 * POST /api/uploads/photo
 * - multipart/form-data with `file`
 * - stores file locally under DATA_DIR/uploads
 * - returns { imageUrl: "/uploads/xyz.jpg" }
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "../../data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const mt = (file.mimetype || "").toLowerCase();
    if (!mt.startsWith("image/")) {
      cb(new Error("Only image uploads are supported"));
      return;
    }
    cb(null, true);
  },
});

function extFromMime(mime: string): string {
  const mt = (mime || "").toLowerCase();
  if (mt === "image/jpeg") return "jpg";
  if (mt === "image/png") return "png";
  if (mt === "image/webp") return "webp";
  if (mt === "image/heic" || mt === "image/heif") return "heic";
  // fallback: try to keep something usable
  return "jpg";
}

// POST /uploads/photo
router.post("/uploads/photo", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    ensureDir(UPLOADS_DIR);

    const ext = extFromMime(file.mimetype);
    const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const fullPath = path.join(UPLOADS_DIR, filename);

    await fs.promises.writeFile(fullPath, file.buffer);

    return res.status(201).json({ imageUrl: `/uploads/${filename}` });
  } catch (error) {
    console.error("Error uploading photo:", error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

