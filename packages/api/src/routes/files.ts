/**
 * Files Routes - User file management
 * 
 * Handles file uploads, listing, and streaming for users.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/drizzle-client';
import { files } from '../db/drizzle-schema';
import { eq, desc, count, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// File storage configuration
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const FILES_DIR = path.join(DATA_DIR, 'files');

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = req.user?.id;
    if (!userId) {
      cb(new Error('User not authenticated'), '');
      return;
    }
    
    const userDir = path.join(FILES_DIR, String(userId));
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (_req, file, cb) => {
    // Sanitize filename
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}-${sanitizedName}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Allow common file types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// Helper to map database row to file object
interface FileInfo {
  id: number;
  userId: number;
  visitId: number | null;
  filename: string;
  mimeType: string;
  size: number;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRowToFile(row: typeof files.$inferSelect): FileInfo {
  return {
    id: row.id,
    userId: row.userId,
    visitId: row.visitId,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    category: row.category,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// POST /files - Upload a file
router.post('/', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }
    
    // Get optional metadata
    const visitId = req.body.visitId ? parseInt(req.body.visitId) : null;
    const category = req.body.category || 'other';
    
    // Store file metadata in database
    const [inserted] = await db
      .insert(files)
      .values({
        userId,
        visitId: visitId || null,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath: file.path,
        category,
      })
      .returning();
    
    res.status(201).json({
      success: true,
      data: mapRowToFile(inserted),
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// GET /files - List user's files
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    
    // Optional filters
    const visitId = req.query.visitId ? parseInt(req.query.visitId as string) : null;
    const category = req.query.category as string | undefined;
    
    // Build conditions
    const conditions = [eq(files.userId, userId)];
    if (visitId) {
      conditions.push(eq(files.visitId, visitId));
    }
    if (category) {
      conditions.push(eq(files.category, category));
    }
    
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    
    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(files)
        .where(whereClause)
        .orderBy(desc(files.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(files).where(whereClause),
    ]);
    
    const total = Number(countResult[0]?.count ?? 0);
    
    res.json({
      success: true,
      data: rows.map(mapRowToFile),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// GET /files/:id - Get/download a file
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const fileId = parseInt(req.params.id);
    
    if (isNaN(fileId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file ID',
      });
    }
    
    // Find file and verify ownership
    const rows = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)));
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }
    
    const fileRecord = rows[0];
    
    // Check if file exists on disk
    if (!fs.existsSync(fileRecord.storagePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found on disk',
      });
    }
    
    // Set content type and disposition
    res.setHeader('Content-Type', fileRecord.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileRecord.filename)}"`);
    res.setHeader('Content-Length', fileRecord.size);
    
    // Stream the file
    const stream = fs.createReadStream(fileRecord.storagePath);
    stream.pipe(res);
  } catch (error) {
    console.error('Error getting file:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// DELETE /files/:id - Delete a file
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const fileId = parseInt(req.params.id);
    
    if (isNaN(fileId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file ID',
      });
    }
    
    // Find file and verify ownership
    const rows = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)));
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }
    
    const fileRecord = rows[0];
    
    // Delete from disk
    if (fs.existsSync(fileRecord.storagePath)) {
      fs.unlinkSync(fileRecord.storagePath);
    }
    
    // Delete from database
    await db.delete(files).where(eq(files.id, fileId));
    
    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export default router;
