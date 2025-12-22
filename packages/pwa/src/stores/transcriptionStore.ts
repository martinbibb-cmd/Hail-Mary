/**
 * Global Transcription Store
 *
 * Manages transcription state globally across the application.
 * This ensures transcription continues even when navigating away from the VisitApp.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TranscriptSegment {
  id: string;
  timestamp: Date;
  speaker: string;
  text: string;
  corrected?: string;
  processed?: boolean;
}

export interface TranscriptionSession {
  sessionId: string;
  leadId: string;
  startedAt: Date;
  lastTranscriptAt?: Date;
  segments: TranscriptSegment[];
  accumulatedTranscript: string;
  isActive: boolean;
}

interface TranscriptionState {
  // Active transcription session
  activeSession: TranscriptionSession | null;

  // Live interim transcript (for UI display while recording)
  interimTranscript: string;

  // Processing state
  isProcessing: boolean;
  lastProcessedAt: Date | null;

  // Actions
  startSession: (leadId: string, sessionId: string) => void;
  stopSession: () => void;
  addSegment: (segment: TranscriptSegment) => void;
  setInterimTranscript: (text: string) => void;
  markSegmentProcessed: (segmentId: string) => void;
  updateAccumulatedTranscript: (transcript: string) => void;
  clearSession: () => void;

  // Getters
  getActiveSession: () => TranscriptionSession | null;
  getUnprocessedSegments: () => TranscriptSegment[];
}

export const useTranscriptionStore = create<TranscriptionState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      interimTranscript: '',
      isProcessing: false,
      lastProcessedAt: null,

      startSession: (leadId: string, sessionId: string) => {
        console.log('[TranscriptionStore] Starting new session:', { leadId, sessionId });
        set({
          activeSession: {
            sessionId,
            leadId,
            startedAt: new Date(),
            segments: [],
            accumulatedTranscript: '',
            isActive: true,
          },
        });
      },

      stopSession: () => {
        console.log('[TranscriptionStore] Stopping session');
        set((state) => ({
          activeSession: state.activeSession
            ? { ...state.activeSession, isActive: false }
            : null,
        }));
      },

      setInterimTranscript: (text: string) => {
        set({ interimTranscript: text });
      },

      addSegment: (segment: TranscriptSegment) => {
        console.log('[TranscriptionStore] Adding segment:', segment.id);
        set((state) => {
          if (!state.activeSession) {
            console.warn('[TranscriptionStore] No active session, ignoring segment');
            return state;
          }

          return {
            activeSession: {
              ...state.activeSession,
              segments: [...state.activeSession.segments, segment],
              lastTranscriptAt: new Date(),
            },
          };
        });
      },

      markSegmentProcessed: (segmentId: string) => {
        set((state) => {
          if (!state.activeSession) return state;

          return {
            activeSession: {
              ...state.activeSession,
              segments: state.activeSession.segments.map((seg) =>
                seg.id === segmentId ? { ...seg, processed: true } : seg
              ),
            },
            lastProcessedAt: new Date(),
          };
        });
      },

      updateAccumulatedTranscript: (transcript: string) => {
        set((state) => {
          if (!state.activeSession) return state;

          return {
            activeSession: {
              ...state.activeSession,
              accumulatedTranscript: transcript,
            },
          };
        });
      },

      clearSession: () => {
        console.log('[TranscriptionStore] Clearing session');
        set({
          activeSession: null,
          interimTranscript: '',
          isProcessing: false,
          lastProcessedAt: null,
        });
      },

      getActiveSession: () => {
        return get().activeSession;
      },

      getUnprocessedSegments: () => {
        const session = get().activeSession;
        if (!session) return [];
        return session.segments.filter((seg) => !seg.processed);
      },
    }),
    {
      name: 'transcription-storage',
      partialize: (state) => ({
        activeSession: state.activeSession,
        interimTranscript: state.interimTranscript,
        lastProcessedAt: state.lastProcessedAt,
      }),
    }
  )
);
