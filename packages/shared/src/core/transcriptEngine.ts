/**
 * TranscriptEngine Interface
 * 
 * Core service for handling audio transcription during site surveys.
 * Records audio, returns segments, and tags topics.
 */

import type { TranscriptSession, TranscriptSegment, TopicTag } from '../types';

/**
 * Configuration for transcript session
 */
export interface TranscriptConfig {
  /** Language code (default: 'en-GB') */
  language?: string;
  /** Enable speaker diarization */
  enableDiarization?: boolean;
  /** Enable automatic topic tagging */
  enableTopicTagging?: boolean;
  /** Chunk duration in seconds for progressive upload */
  chunkDurationSeconds?: number;
}

/**
 * Result of topic extraction from transcript
 */
export interface TopicExtractionResult {
  /** Detected topic tag */
  topic: TopicTag;
  /** Confidence score 0-1 */
  confidence: number;
  /** Text snippet that triggered detection */
  evidence: string;
}

/**
 * TranscriptEngine interface - records audio and produces tagged segments
 */
export interface ITranscriptEngine {
  /**
   * Start a new transcript session
   */
  startSession(config?: TranscriptConfig): Promise<TranscriptSession>;

  /**
   * End the current session
   */
  endSession(sessionId: number): Promise<void>;

  /**
   * Upload an audio chunk for processing
   */
  uploadChunk(
    sessionId: number,
    audioData: Blob | ArrayBuffer,
    startOffsetSeconds: number
  ): Promise<void>;

  /**
   * Get all segments for a session
   */
  getSegments(sessionId: number): Promise<TranscriptSegment[]>;

  /**
   * Get segments for a specific topic
   */
  getSegmentsByTopic(sessionId: number, topic: TopicTag): Promise<TranscriptSegment[]>;

  /**
   * Extract topics from recent transcript
   */
  extractTopics(sessionId: number): Promise<TopicExtractionResult[]>;

  /**
   * Get the current active topic based on recent speech
   */
  getCurrentTopic(sessionId: number): Promise<TopicTag | null>;

  /**
   * Search transcript for mentions of specific terms
   */
  searchTranscript(sessionId: number, query: string): Promise<TranscriptSegment[]>;

  /**
   * Get session status
   */
  getSessionStatus(sessionId: number): Promise<TranscriptSession | null>;
}

/**
 * Default transcript configuration
 */
export const defaultTranscriptConfig: TranscriptConfig = {
  language: 'en-GB',
  enableDiarization: true,
  enableTopicTagging: true,
  chunkDurationSeconds: 30,
};
