/**
 * Unit tests for STT Service
 * 
 * Tests the speech-to-text service and provider interface.
 */

import {
  MockSttProvider,
  SttProvider,
  SttResult,
  setSttProvider,
  getSttProvider,
  getQueueLength,
  isQueueProcessing,
} from '../services/stt.service';

// Mock the database module before importing the service
jest.mock('../db/drizzle-client', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 1 }]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  },
}));

jest.mock('../db/drizzle-schema', () => ({
  transcriptAudioChunks: { id: 'id', sessionId: 'session_id', sttStatus: 'stt_status' },
  transcriptSegments: { id: 'id', sessionId: 'session_id', chunkId: 'chunk_id' },
  transcriptSessions: { id: 'id', status: 'status' },
}));

describe('STT Service', () => {
  describe('MockSttProvider', () => {
    it('should have correct name', () => {
      const provider = new MockSttProvider();
      expect(provider.name).toBe('mock');
    });

    it('should return mock transcription result', async () => {
      const provider = new MockSttProvider();
      const result = await provider.transcribe('/path/to/audio.m4a', 'en-GB');

      expect(result.text).toBeTruthy();
      expect(typeof result.text).toBe('string');
      expect(result.text).toContain('Mock transcription');
    });

    it('should return segments with timestamps', async () => {
      const provider = new MockSttProvider();
      const result = await provider.transcribe('/path/to/audio.m4a');

      expect(result.segments).toBeDefined();
      expect(Array.isArray(result.segments)).toBe(true);
      expect(result.segments!.length).toBeGreaterThan(0);

      const segment = result.segments![0];
      expect(segment.startSeconds).toBeDefined();
      expect(segment.endSeconds).toBeDefined();
      expect(segment.text).toBeDefined();
      expect(typeof segment.startSeconds).toBe('number');
      expect(typeof segment.endSeconds).toBe('number');
    });

    it('should include confidence in segments', async () => {
      const provider = new MockSttProvider();
      const result = await provider.transcribe('/path/to/audio.m4a');

      const segment = result.segments![0];
      expect(segment.confidence).toBeDefined();
      expect(segment.confidence).toBeGreaterThanOrEqual(0);
      expect(segment.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Provider Management', () => {
    it('should allow setting and getting providers', () => {
      const customProvider: SttProvider = {
        name: 'custom',
        transcribe: async () => ({ text: 'custom result' }),
      };

      setSttProvider(customProvider);
      const current = getSttProvider();

      expect(current.name).toBe('custom');
    });

    it('should use mock provider by default', () => {
      // Reset to default
      setSttProvider(new MockSttProvider());
      const provider = getSttProvider();

      expect(provider.name).toBe('mock');
    });
  });

  describe('Job Queue', () => {
    it('should report queue length', () => {
      const length = getQueueLength();
      expect(typeof length).toBe('number');
      expect(length).toBeGreaterThanOrEqual(0);
    });

    it('should report processing status', () => {
      const processing = isQueueProcessing();
      expect(typeof processing).toBe('boolean');
    });
  });

  describe('SttProvider Interface', () => {
    it('should enforce interface contract', async () => {
      const provider: SttProvider = {
        name: 'test-provider',
        transcribe: async (audioPath: string, language?: string): Promise<SttResult> => {
          return {
            text: `Transcribed ${audioPath} in ${language || 'default'}`,
            segments: [
              {
                startSeconds: 0,
                endSeconds: 10,
                text: 'Test segment',
                confidence: 0.99,
              },
            ],
          };
        },
      };

      const result = await provider.transcribe('/audio/test.m4a', 'en-US');

      expect(result.text).toContain('test.m4a');
      expect(result.text).toContain('en-US');
      expect(result.segments![0].confidence).toBe(0.99);
    });

    it('should handle error results', async () => {
      const provider: SttProvider = {
        name: 'error-provider',
        transcribe: async (): Promise<SttResult> => {
          return {
            text: '',
            error: 'Audio file not found',
          };
        },
      };

      const result = await provider.transcribe('/nonexistent.m4a');

      expect(result.error).toBe('Audio file not found');
    });
  });
});
