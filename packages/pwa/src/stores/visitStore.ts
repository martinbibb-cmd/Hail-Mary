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
import type { VisitSession, Customer } from '@hail-mary/shared';

export type RecordingProvider = 'browser' | 'whisper';

interface VisitStore {
  // Active visit session
  activeSession: VisitSession | null;
  activeCustomer: Customer | null;
  
  // Recording state
  isRecording: boolean;
  recordingProvider: RecordingProvider | null;
  recordingStartTime: Date | null;
  transcriptCount: number;
  
  // Actions
  setActiveSession: (session: VisitSession | null, customer: Customer | null) => void;
  startRecording: (provider: RecordingProvider) => void;
  stopRecording: () => void;
  incrementTranscriptCount: () => void;
  clearSession: () => void;
}

export const useVisitStore = create<VisitStore>((set) => ({
  // Initial state
  activeSession: null,
  activeCustomer: null,
  isRecording: false,
  recordingProvider: null,
  recordingStartTime: null,
  transcriptCount: 0,

  // Set active session (when visit starts)
  setActiveSession: (session: VisitSession | null, customer: Customer | null) => set({
    activeSession: session,
    activeCustomer: customer,
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
    activeCustomer: null,
    isRecording: false,
    recordingProvider: null,
    recordingStartTime: null,
    transcriptCount: 0,
  }),
}));
