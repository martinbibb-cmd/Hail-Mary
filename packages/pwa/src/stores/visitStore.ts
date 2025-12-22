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
  clearSession: () => void;
  endVisit: () => Promise<void>;
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

  // Clear session (when visit ends)
  clearSession: () => set({
    activeSession: null,
    activeLead: null,
    isRecording: false,
    recordingProvider: null,
    recordingStartTime: null,
    transcriptCount: 0,
  }),

  // End visit (global action)
  endVisit: async () => {
    const { activeSession, clearSession } = get();
    if (!activeSession) return;

    try {
      const response = await fetch(`/api/visit-sessions/${activeSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'completed',
          endedAt: new Date(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to end visit session');
      }

      // Stop background transcription session
      backgroundTranscriptionProcessor.stopSession();
      
      // Clear transcription store
      useTranscriptionStore.getState().clearSession();

      // Clear local session
      clearSession();
      
    } catch (error) {
      console.error('Failed to end visit:', error);
      throw error;
    }
  },
}));
