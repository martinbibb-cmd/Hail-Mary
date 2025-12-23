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

export interface EndVisitResult {
  success: boolean;
  error?: string;
}

interface VisitStore {
  // Active visit session
  activeSession: VisitSession | null;
  activeLead: Lead | null;
  
  // Recording state
  isRecording: boolean;
  recordingProvider: RecordingProvider | null;
  recordingStartTime: Date | null;
  transcriptCount: number;
  
  // End visit state
  isEndingVisit: boolean;
  endVisitError: string | null;
  
  // Actions
  setActiveSession: (session: VisitSession | null, lead: Lead | null) => void;
  startRecording: (provider: RecordingProvider) => void;
  stopRecording: () => void;
  incrementTranscriptCount: () => void;
  clearSession: () => void;
  
  /**
   * End the active visit session.
   * This is a global action that can be called from any page.
   * It handles the API call to mark the visit as completed,
   * stops background transcription, and clears all session state.
   */
  endVisit: () => Promise<EndVisitResult>;
  
  /**
   * Clear any end visit error state
   */
  clearEndVisitError: () => void;
}

export const useVisitStore = create<VisitStore>((set, get) => ({
  // Initial state
  activeSession: null,
  activeLead: null,
  isRecording: false,
  recordingProvider: null,
  recordingStartTime: null,
  transcriptCount: 0,
  isEndingVisit: false,
  endVisitError: null,

  // Set active session (when visit starts)
  setActiveSession: (session: VisitSession | null, lead: Lead | null) => set({
    activeSession: session,
    activeLead: lead,
    transcriptCount: 0,
    endVisitError: null,
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

  // Clear session (when visit ends)
  clearSession: () => set({
    activeSession: null,
    activeLead: null,
    isRecording: false,
    recordingProvider: null,
    recordingStartTime: null,
    transcriptCount: 0,
    isEndingVisit: false,
    endVisitError: null,
  }),

  // End visit - global action that can be called from any page
  endVisit: async (): Promise<EndVisitResult> => {
    const state = get();
    const { activeSession, isRecording } = state;

    // Cannot end visit if no active session
    if (!activeSession) {
      return { success: false, error: 'No active visit session to end.' };
    }

    // Cannot end visit while recording is active
    if (isRecording) {
      return { success: false, error: 'Please stop recording before ending the visit.' };
    }

    set({ isEndingVisit: true, endVisitError: null });

    try {
      const response = await fetch(`/api/visit-sessions/${activeSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'completed',
          endedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to end visit (HTTP ${response.status})`);
      }

      // Stop background transcription session
      backgroundTranscriptionProcessor.stopSession();
      
      // Clear transcription store
      useTranscriptionStore.getState().clearSession();

      // Success - clear the session
      set({
        activeSession: null,
        activeLead: null,
        isRecording: false,
        recordingProvider: null,
        recordingStartTime: null,
        transcriptCount: 0,
        isEndingVisit: false,
        endVisitError: null,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to end visit. Please try again.';
      console.error('Failed to end visit:', error);
      set({ isEndingVisit: false, endVisitError: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  // Clear end visit error
  clearEndVisitError: () => set({ endVisitError: null }),
}));
