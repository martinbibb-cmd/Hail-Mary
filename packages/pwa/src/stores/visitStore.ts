/**
 * Visit Store - Manages active visit session and recording state
 * 
 * Tracks:
 * - activeSession: current VisitSession if any
 * - isRecording: whether microphone/recording is active
 * - recordingStartTime: when recording started
 * - transcriptCount: number of transcript segments captured
 */

import { create } from 'zustand';
import type { VisitSession, Lead } from '@hail-mary/shared';
import { backgroundTranscriptionProcessor } from '../services/backgroundTranscriptionProcessor';
import { useTranscriptionStore } from './transcriptionStore';

export type RecordingProvider = 'browser' | 'whisper';

interface VisitStore {
  // Active visit session
  activeSession: VisitSession | null;
  activeLead: Lead | null;
  
  // Recording state
  isRecording: boolean;
  recordingProvider: RecordingProvider | null;
  recordingStartTime: Date | null;
  transcriptCount: number;
  
  // Actions
  setActiveSession: (session: VisitSession | null, lead: Lead | null) => void;
  startRecording: (provider: RecordingProvider) => void;
  stopRecording: () => void;
  incrementTranscriptCount: () => void;
  endVisit: () => Promise<{ success: true } | { success: false; error: string }>;
  clearSession: () => void;
}

export const useVisitStore = create<VisitStore>((set, get) => ({
  // Initial state
  activeSession: null,
  activeLead: null,
  isRecording: false,
  recordingProvider: null,
  recordingStartTime: null,
  transcriptCount: 0,

  // Set active session (when visit starts)
  setActiveSession: (session: VisitSession | null, lead: Lead | null) => set({
    activeSession: session,
    activeLead: lead,
    transcriptCount: 0,
  }),

  // Start recording
  startRecording: (provider: RecordingProvider) => set({
    isRecording: true,
    recordingProvider: provider,
    recordingStartTime: new Date(),
  }),

  // Stop recording
  stopRecording: () => set({
    isRecording: false,
    recordingProvider: null,
    recordingStartTime: null,
  }),

  // Increment transcript count
  incrementTranscriptCount: () => set((state) => ({
    transcriptCount: state.transcriptCount + 1,
  })),

  // End visit (global action, callable from any page/tab)
  endVisit: async () => {
    const activeSession = get().activeSession;
    if (!activeSession) {
      return { success: false, error: 'No active visit to end.' };
    }

    try {
      const res = await fetch(`/api/visit-sessions/${activeSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'completed',
          endedAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to end visit session (${res.status})`);
      }

      // Stop any background transcription and clear global session state
      backgroundTranscriptionProcessor.stopSession();
      useTranscriptionStore.getState().clearSession();

      get().clearSession();
      return { success: true };
    } catch (err) {
      console.error('[VisitStore] Failed to end visit:', err);
      return { success: false, error: 'Failed to end visit. Please try again.' };
    }
  },

  // Clear session (when visit ends)
  clearSession: () => set({
    activeSession: null,
    activeLead: null,
    isRecording: false,
    recordingProvider: null,
    recordingStartTime: null,
    transcriptCount: 0,
  }),
}));
