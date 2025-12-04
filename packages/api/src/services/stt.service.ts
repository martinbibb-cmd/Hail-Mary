/**
 * STT (Speech-to-Text) Service
 * 
 * Provider-agnostic interface for speech-to-text transcription.
 * Manages the background processing of audio chunks.
 */

import { db } from '../db/drizzle-client';
import { transcriptAudioChunks, transcriptSegments, transcriptSessions } from '../db/drizzle-schema';
import { eq } from 'drizzle-orm';

// ============================================
// STT Provider Interface
// ============================================

/**
 * Result from an STT provider
 */
export interface SttResult {
  text: string;
  segments?: Array<{
    startSeconds: number;
    endSeconds: number;
    text: string;
    confidence?: number;
  }>;
  error?: string;
}

/**
 * STT Provider interface - implement this for different providers
 */
export interface SttProvider {
  name: string;
  transcribe(audioPath: string, language?: string): Promise<SttResult>;
}

// ============================================
// Mock STT Provider (for development/testing)
// ============================================

/**
 * Mock STT provider that returns placeholder text
 * Replace with real provider (e.g., Whisper, Google, AWS Transcribe)
 */
export class MockSttProvider implements SttProvider {
  name = 'mock';

  async transcribe(_audioPath: string, _language?: string): Promise<SttResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      text: '[Mock transcription - replace with real STT provider]',
      segments: [
        {
          startSeconds: 0,
          endSeconds: 30,
          text: '[Mock transcription - replace with real STT provider]',
          confidence: 0.95,
        },
      ],
    };
  }
}

// ============================================
// STT Service
// ============================================

// In-memory job queue for STT processing
interface SttJob {
  chunkId: number;
  audioPath: string;
  addedAt: Date;
}

const jobQueue: SttJob[] = [];
let isProcessing = false;

// Current provider (configurable)
let sttProvider: SttProvider = new MockSttProvider();

/**
 * Set the STT provider to use
 */
export function setSttProvider(provider: SttProvider): void {
  sttProvider = provider;
}

/**
 * Get the current STT provider
 */
export function getSttProvider(): SttProvider {
  return sttProvider;
}

/**
 * Enqueue an audio chunk for STT processing
 */
export function enqueueSttJob(chunkId: number, audioPath: string): void {
  jobQueue.push({
    chunkId,
    audioPath,
    addedAt: new Date(),
  });
  
  // Start processing if not already running
  if (!isProcessing) {
    processQueue();
  }
}

/**
 * Process the STT job queue
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (jobQueue.length > 0) {
    const job = jobQueue.shift();
    if (!job) continue;

    try {
      await runSttForChunk(job.chunkId, job.audioPath);
    } catch (error) {
      console.error(`STT processing failed for chunk ${job.chunkId}:`, error);
    }
  }

  isProcessing = false;
}

/**
 * Run STT for a specific chunk
 * This is the main function called by the worker
 */
export async function runSttForChunk(chunkId: number, audioPath: string): Promise<void> {
  try {
    // Update chunk status to processing
    await db
      .update(transcriptAudioChunks)
      .set({
        sttStatus: 'processing',
        updatedAt: new Date(),
      })
      .where(eq(transcriptAudioChunks.id, chunkId));

    // Get chunk details for language
    const chunks = await db
      .select()
      .from(transcriptAudioChunks)
      .where(eq(transcriptAudioChunks.id, chunkId));

    if (chunks.length === 0) {
      throw new Error(`Chunk ${chunkId} not found`);
    }

    const chunk = chunks[0];

    // Get session for language setting
    const sessions = await db
      .select()
      .from(transcriptSessions)
      .where(eq(transcriptSessions.id, chunk.sessionId));

    const language = sessions[0]?.language || 'en-GB';

    // Run STT
    const result = await sttProvider.transcribe(audioPath, language);

    if (result.error) {
      // Update chunk with error
      await db
        .update(transcriptAudioChunks)
        .set({
          sttStatus: 'error',
          errorMessage: result.error,
          updatedAt: new Date(),
        })
        .where(eq(transcriptAudioChunks.id, chunkId));
      return;
    }

    // Update chunk with transcript text
    await db
      .update(transcriptAudioChunks)
      .set({
        sttStatus: 'done',
        transcriptText: result.text,
        updatedAt: new Date(),
      })
      .where(eq(transcriptAudioChunks.id, chunkId));

    // Create segments from STT result
    if (result.segments && result.segments.length > 0) {
      const segmentValues = result.segments.map(seg => ({
        sessionId: chunk.sessionId,
        chunkId: chunk.id,
        startSeconds: String(seg.startSeconds + Number(chunk.startOffsetSeconds)),
        endSeconds: String(seg.endSeconds + Number(chunk.startOffsetSeconds)),
        speaker: 'engineer',
        text: seg.text,
        confidence: seg.confidence ? String(seg.confidence) : null,
      }));

      await db.insert(transcriptSegments).values(segmentValues);
    } else {
      // If no segments from provider, create one segment per chunk
      const startOffset = Number(chunk.startOffsetSeconds);
      const duration = chunk.durationSeconds ? Number(chunk.durationSeconds) : 30;

      await db.insert(transcriptSegments).values({
        sessionId: chunk.sessionId,
        chunkId: chunk.id,
        startSeconds: String(startOffset),
        endSeconds: String(startOffset + duration),
        speaker: 'engineer',
        text: result.text,
        confidence: '0.90',
      });
    }

    // Check if all chunks are done and update session status
    await updateSessionStatus(chunk.sessionId);

  } catch (error) {
    console.error(`Error processing chunk ${chunkId}:`, error);
    
    // Update chunk with error
    await db
      .update(transcriptAudioChunks)
      .set({
        sttStatus: 'error',
        errorMessage: (error as Error).message,
        updatedAt: new Date(),
      })
      .where(eq(transcriptAudioChunks.id, chunkId));
  }
}

/**
 * Update session status based on chunk states
 */
async function updateSessionStatus(sessionId: number): Promise<void> {
  const chunks = await db
    .select()
    .from(transcriptAudioChunks)
    .where(eq(transcriptAudioChunks.sessionId, sessionId));

  const allDone = chunks.every(c => c.sttStatus === 'done');
  const anyError = chunks.some(c => c.sttStatus === 'error');
  const anyPending = chunks.some(c => c.sttStatus === 'pending' || c.sttStatus === 'processing');

  // Get current session
  const sessions = await db
    .select()
    .from(transcriptSessions)
    .where(eq(transcriptSessions.id, sessionId));

  if (sessions.length === 0) return;

  const session = sessions[0];

  // Only update if session is in processing state
  if (session.status !== 'processing') return;

  if (allDone) {
    await db
      .update(transcriptSessions)
      .set({
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(transcriptSessions.id, sessionId));
  } else if (anyError && !anyPending) {
    // All non-error chunks are done but some have errors
    await db
      .update(transcriptSessions)
      .set({
        status: 'error',
        updatedAt: new Date(),
      })
      .where(eq(transcriptSessions.id, sessionId));
  }
}

/**
 * Get the current queue length (for monitoring)
 */
export function getQueueLength(): number {
  return jobQueue.length;
}

/**
 * Check if queue is currently processing
 */
export function isQueueProcessing(): boolean {
  return isProcessing;
}
