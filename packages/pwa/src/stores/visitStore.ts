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
import type { VisitSession, Lead, ApiResponse } from '@hail-mary/shared';
import { useLeadStore } from './leadStore';
import { useTranscriptionStore } from './transcriptionStore';
import { backgroundTranscriptionProcessor } from '../services/backgroundTranscriptionProcessor';

export type RecordingProvider = 'browser' | 'whisper';

export interface EndVisitOptions {
  keyDetails?: Record<string, unknown>;
  checklistItems?: Array<{ id: string; label: string; checked: boolean; note?: string }>;
  exceptions?: string[];
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
  
  // Actions
  setActiveSession: (session: VisitSession | null, lead: Lead | null) => void;
  startRecording: (provider: RecordingProvider) => void;
  stopRecording: () => void;
  incrementTranscriptCount: () => void;
  clearSession: () => void;
  endVisit: (options?: EndVisitOptions) => Promise<void>;
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

  // End visit - global action that works from any page
  endVisit: async (options?: EndVisitOptions) => {
    const state = get();
    if (!state.activeSession) {
      throw new Error('No active visit session');
    }

    const leadStore = useLeadStore.getState();
    const currentLeadId = leadStore.currentLeadId;
    const transcriptionStore = useTranscriptionStore.getState();
    const activeTranscriptionSession = transcriptionStore.getActiveSession();
    const accumulatedTranscript = activeTranscriptionSession?.accumulatedTranscript || '';

    // Trigger save if we have visit data and a lead
    if (currentLeadId && (accumulatedTranscript || options?.keyDetails || options?.checklistItems)) {
      leadStore.enqueueSave({
        leadId: currentLeadId,
        reason: 'end_visit',
        payload: {
          visitSessionId: state.activeSession.id,
          correctedTranscript: accumulatedTranscript,
          keyDetails: options?.keyDetails || {},
          checklistItems: options?.checklistItems || [],
          exceptions: options?.exceptions || [],
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Call API to end visit session
    try {
      const response = await fetch(`/api/visit-sessions/${state.activeSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'completed',
          endedAt: new Date(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to end visit session: ${response.statusText}`);
      }

      // Stop background transcription session
      backgroundTranscriptionProcessor.stopSession();

      // Clear all session state
      set({
        activeSession: null,
        activeLead: null,
        isRecording: false,
        recordingProvider: null,
        recordingStartTime: null,
        transcriptCount: 0,
      });

      // Clear transcription store
      transcriptionStore.clearSession();
    } catch (error) {
      console.error('Failed to end visit:', error);
      throw error;
    }
  },
}));
