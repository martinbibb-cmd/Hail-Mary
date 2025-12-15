/**
 * Transcription Routes - Session-based chunked audio transcription
 * 
 * Handles creating transcript sessions, uploading audio chunks,
 * and retrieving transcription results.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/drizzle-client';
import { 
  transcriptSessions, 
  transcriptAudioChunks, 
  transcriptSegments 
} from '../db/drizzle-schema';
import { eq, desc, asc, and } from 'drizzle-orm';
import type { 
  ApiResponse,
  TranscriptSession,
  TranscriptAudioChunk,
  TranscriptSegment,
  CreateTranscriptSessionDto,
  TranscriptSessionWithDetails,
} from '@hail-mary/shared';
import { enqueueSttJob } from '../services/stt.service';

const router = Router();

// File storage configuration for audio uploads
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');

// Ensure audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Multer configuration for audio uploads
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const sessionId = req.params.sessionId;
    if (!sessionId) {
      cb(new Error('Session ID required'), '');
      return;
    }
    
    const sessionDir = path.join(AUDIO_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    const index = req.body.index || '0';
    const ext = path.extname(file.originalname) || '.m4a';
    cb(null, `chunk_${index}${ext}`);
  },
});

// Allowed audio types
const allowedAudioTypes: Record<string, string[]> = {
  'audio/mp4': ['.m4a', '.mp4'],
  'audio/mpeg': ['.mp3'],
  'audio/webm': ['.webm'],
  'audio/ogg': ['.ogg'],
  'audio/wav': ['.wav'],
  'audio/x-m4a': ['.m4a'],
};

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit per chunk
  },
  fileFilter: (_req, file, cb) => {
    // Check MIME type
    if (!allowedAudioTypes[file.mimetype]) {
      cb(new Error(`Audio type ${file.mimetype} not allowed`));
      return;
    }
    cb(null, true);
  },
});

// Helper to map database row to TranscriptSession
function mapRowToSession(row: typeof transcriptSessions.$inferSelect): TranscriptSession {
  return {
    id: row.id,
    leadId: row.leadId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    status: row.status as TranscriptSession['status'],
    durationSeconds: row.durationSeconds ?? undefined,
    language: row.language,
    notes: row.notes ?? undefined,
  };
}

// Helper to map database row to TranscriptAudioChunk
function mapRowToChunk(row: typeof transcriptAudioChunks.$inferSelect): TranscriptAudioChunk {
  return {
    id: row.id,
    sessionId: row.sessionId,
    index: row.index,
    startOffsetSeconds: Number(row.startOffsetSeconds),
    durationSeconds: row.durationSeconds ? Number(row.durationSeconds) : undefined,
    storagePath: row.storagePath,
    sttStatus: row.sttStatus as TranscriptAudioChunk['sttStatus'],
    transcriptText: row.transcriptText ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Helper to map database row to TranscriptSegment
function mapRowToSegment(row: typeof transcriptSegments.$inferSelect): TranscriptSegment {
  return {
    id: row.id,
    sessionId: row.sessionId,
    chunkId: row.chunkId,
    startSeconds: Number(row.startSeconds),
    endSeconds: Number(row.endSeconds),
    speaker: row.speaker,
    text: row.text,
    roomTag: row.roomTag ?? undefined,
    topicTag: row.topicTag ?? undefined,
    confidence: row.confidence ? Number(row.confidence) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// POST /sessions - Create a new transcript session
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const dto: CreateTranscriptSessionDto = req.body;

    const [inserted] = await db
      .insert(transcriptSessions)
      .values({
        leadId: dto.leadId || null,
        status: 'recording',
        language: dto.language || 'en-GB',
        notes: dto.notes || null,
      })
      .returning();

    const response: ApiResponse<{ sessionId: number }> = {
      success: true,
      data: { sessionId: inserted.id },
      message: 'Transcript session created',
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating transcript session:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /sessions/:sessionId/chunks - Upload an audio chunk
router.post('/sessions/:sessionId/chunks', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid session ID',
      };
      return res.status(400).json(response);
    }

    // Verify session exists
    const sessions = await db
      .select()
      .from(transcriptSessions)
      .where(eq(transcriptSessions.id, sessionId));

    if (sessions.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Transcript session not found',
      };
      return res.status(404).json(response);
    }

    const file = req.file;
    if (!file) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No audio file uploaded',
      };
      return res.status(400).json(response);
    }

    const index = parseInt(req.body.index) || 0;
    const startOffsetSeconds = parseFloat(req.body.startOffsetSeconds) || 0;
    const durationSeconds = req.body.durationSeconds ? parseFloat(req.body.durationSeconds) : null;

    // Create audio chunk record
    const [inserted] = await db
      .insert(transcriptAudioChunks)
      .values({
        sessionId,
        index,
        startOffsetSeconds: String(startOffsetSeconds),
        durationSeconds: durationSeconds ? String(durationSeconds) : null,
        storagePath: file.path,
        sttStatus: 'pending',
      })
      .returning();

    // Enqueue async job to run STT for this chunk
    enqueueSttJob(inserted.id, file.path);

    const response: ApiResponse<TranscriptAudioChunk> = {
      success: true,
      data: mapRowToChunk(inserted),
      message: 'Audio chunk uploaded and queued for transcription',
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error uploading audio chunk:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /sessions/:sessionId/complete - Mark session as complete
router.post('/sessions/:sessionId/complete', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid session ID',
      };
      return res.status(400).json(response);
    }

    // Verify session exists
    const sessions = await db
      .select()
      .from(transcriptSessions)
      .where(eq(transcriptSessions.id, sessionId));

    if (sessions.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Transcript session not found',
      };
      return res.status(404).json(response);
    }

    // Calculate total duration from chunks
    const chunks = await db
      .select()
      .from(transcriptAudioChunks)
      .where(eq(transcriptAudioChunks.sessionId, sessionId))
      .orderBy(desc(transcriptAudioChunks.index));

    let totalDuration: number | null = null;
    if (chunks.length > 0) {
      const lastChunk = chunks[0];
      const startOffset = Number(lastChunk.startOffsetSeconds);
      const duration = lastChunk.durationSeconds ? Number(lastChunk.durationSeconds) : 0;
      totalDuration = Math.round(startOffset + duration);
    }

    // Update session status
    const [updated] = await db
      .update(transcriptSessions)
      .set({
        status: 'processing',
        durationSeconds: totalDuration,
        updatedAt: new Date(),
      })
      .where(eq(transcriptSessions.id, sessionId))
      .returning();

    const response: ApiResponse<TranscriptSession> = {
      success: true,
      data: mapRowToSession(updated),
      message: 'Transcript session marked as processing',
    };
    res.json(response);
  } catch (error) {
    console.error('Error completing transcript session:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /sessions/:sessionId - Get session with chunks and segments
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid session ID',
      };
      return res.status(400).json(response);
    }

    // Get session
    const sessions = await db
      .select()
      .from(transcriptSessions)
      .where(eq(transcriptSessions.id, sessionId));

    if (sessions.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Transcript session not found',
      };
      return res.status(404).json(response);
    }

    // Get chunks
    const chunks = await db
      .select()
      .from(transcriptAudioChunks)
      .where(eq(transcriptAudioChunks.sessionId, sessionId))
      .orderBy(asc(transcriptAudioChunks.index));

    // Get segments
    const segments = await db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.sessionId, sessionId))
      .orderBy(asc(transcriptSegments.startSeconds));

    const result: TranscriptSessionWithDetails = {
      session: mapRowToSession(sessions[0]),
      chunks: chunks.map(mapRowToChunk),
      segments: segments.map(mapRowToSegment),
    };

    const response: ApiResponse<TranscriptSessionWithDetails> = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting transcript session:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /sessions - List all sessions (optional: filter by leadId)
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const leadId = req.query.leadId ? parseInt(req.query.leadId as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions = [];
    if (leadId) {
      conditions.push(eq(transcriptSessions.leadId, leadId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(transcriptSessions)
      .where(whereClause)
      .orderBy(desc(transcriptSessions.createdAt))
      .limit(limit)
      .offset(offset);

    const response: ApiResponse<TranscriptSession[]> = {
      success: true,
      data: rows.map(mapRowToSession),
    };
    res.json(response);
  } catch (error) {
    console.error('Error listing transcript sessions:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
