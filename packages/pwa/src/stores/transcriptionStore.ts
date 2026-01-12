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
  role?: 'expert' | 'customer';
  corrected?: string;
  processed?: boolean;
}

export interface TranscriptionSession {
  sessionId: string;
  leadId: string;
  startedAt: Date;
  lastTranscriptAt?: Date;
  lastSeq?: number;
  segments: TranscriptSegment[];
  accumulatedTranscript: string;
  isActive: boolean;
}

interface TranscriptionState {
  // Active transcription session
  activeSession: TranscriptionSession | null;

  // Live interim transcript (for UI display while recording)
  interimTranscript: string;

  // Current role for new segments
  currentRole: 'expert' | 'customer';

  // Processing state
  isProcessing: boolean;
  lastProcessedAt: Date | null;

  // Actions
  startSession: (leadId: string, sessionId: string) => void;
  stopSession: () => void;
  addSegment: (segment: TranscriptSegment) => void;
  addSegments: (segments: TranscriptSegment[]) => void;
  setInterimTranscript: (text: string) => void;
  setCurrentRole: (role: 'expert' | 'customer') => void;
  updateSegmentRole: (segmentId: string, role: 'expert' | 'customer') => void;
  markSegmentProcessed: (segmentId: string) => void;
  updateAccumulatedTranscript: (transcript: string) => void;
  setLastSeq: (seq: number) => void;
  clearSession: () => void;

  // Getters
  getActiveSession: () => TranscriptionSession | null;
  getUnprocessedSegments: () => TranscriptSegment[];
  getCurrentRole: () => 'expert' | 'customer';
}

export const useTranscriptionStore = create<TranscriptionState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      interimTranscript: '',
      currentRole: 'expert',
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
            lastSeq: -1,
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

      setCurrentRole: (role: 'expert' | 'customer') => {
        console.log('[TranscriptionStore] Setting current role:', role);
        set({ currentRole: role });
      },

      updateSegmentRole: (segmentId: string, role: 'expert' | 'customer') => {
        console.log('[TranscriptionStore] Updating segment role:', segmentId, role);
        set((state) => {
          if (!state.activeSession) return state;

          return {
            activeSession: {
              ...state.activeSession,
              segments: state.activeSession.segments.map((seg) =>
                seg.id === segmentId ? { ...seg, role } : seg
              ),
            },
          };
        });
      },

      addSegment: (segment: TranscriptSegment) => {
        console.log('[TranscriptionStore] Adding segment:', segment.id);
        set((state) => {
          if (!state.activeSession) {
            console.warn('[TranscriptionStore] No active session, ignoring segment');
            return state;
          }

          // Idempotent: don't duplicate if we already have this segment id
          if (state.activeSession.segments.some((s) => s.id === segment.id)) {
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

      addSegments: (segments: TranscriptSegment[]) => {
        if (!segments || segments.length === 0) return;
        set((state) => {
          if (!state.activeSession) return state;

          const existingIds = new Set(state.activeSession.segments.map((s) => s.id));
          const deduped = segments.filter((s) => !existingIds.has(s.id));
          if (deduped.length === 0) return state;

          return {
            activeSession: {
              ...state.activeSession,
              segments: [...state.activeSession.segments, ...deduped],
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

      setLastSeq: (seq: number) => {
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: { ...state.activeSession, lastSeq: seq },
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

      getCurrentRole: () => {
        return get().currentRole;
      },
    }),
    {
      name: 'transcription-storage',
      partialize: (state) => ({
        activeSession: state.activeSession,
        interimTranscript: state.interimTranscript,
        currentRole: state.currentRole,
        lastProcessedAt: state.lastProcessedAt,
      }),
    }
  )
);
