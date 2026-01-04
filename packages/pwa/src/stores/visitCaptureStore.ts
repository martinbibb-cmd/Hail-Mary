/**
 * Visit Capture Store
 *
 * Stores derived "structured" visit state (key details, checklist, exceptions)
 * so it survives navigation while recording.
 *
 * Updated by BackgroundTranscriptionProcessor on each final transcript segment.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ChecklistItem, KeyDetails } from '../os/apps/visit/components';
import { extractFromTranscript } from '../os/apps/visit/rockyExtractor';
import { DEFAULT_CHECKLIST_ITEMS } from '../os/apps/visit/visitDefaults';
import { trackAutoFilledFields } from '../services/visitCaptureOrchestrator';

interface VisitCaptureState {
  leadId: string | null;
  sessionId: string | null;

  // Structured state rendered by VisitApp
  keyDetails: KeyDetails;
  checklistItems: ChecklistItem[];
  autoFilledFields: string[];
  exceptions: string[];

  // Actions
  resetForSession: (leadId: string, sessionId: string) => void;
  clear: () => void;
  ingestAccumulatedTranscript: (leadId: string, accumulatedTranscript: string) => void;

  setKeyDetails: (details: KeyDetails) => void;
  toggleChecklistItem: (id: string, checked: boolean) => void;
  addAutoFilledFields: (fields: string[]) => void;
  removeAutoFilledField: (fieldName: string) => void;
  setExceptions: (exceptions: string[]) => void;
}

const STORAGE_KEY = 'hail-mary:visit-capture';

export const useVisitCaptureStore = create<VisitCaptureState>()(
  persist(
    (set, get) => ({
      leadId: null,
      sessionId: null,

      keyDetails: {},
      checklistItems: DEFAULT_CHECKLIST_ITEMS,
      autoFilledFields: [],
      exceptions: [],

      resetForSession: (leadId: string, sessionId: string) => {
        set({
          leadId,
          sessionId,
          keyDetails: {},
          checklistItems: DEFAULT_CHECKLIST_ITEMS,
          autoFilledFields: [],
          exceptions: [],
        });
      },

      clear: () => {
        set({
          leadId: null,
          sessionId: null,
          keyDetails: {},
          checklistItems: DEFAULT_CHECKLIST_ITEMS,
          autoFilledFields: [],
          exceptions: [],
        });
      },

      ingestAccumulatedTranscript: (leadId: string, accumulatedTranscript: string) => {
        const state = get();
        if (!state.leadId || state.leadId !== leadId) return;

        const prevFacts = state.keyDetails;
        const prevChecklist = state.checklistItems;

        const rocky = extractFromTranscript({
          transcript: accumulatedTranscript,
          previousFacts: prevFacts,
          previousChecklist: prevChecklist,
        });

        // Determine newly auto-filled fields (match orchestrator behavior: ignore issues)
        const newlyAutoFilled: string[] = [];
        for (const [key, value] of Object.entries(rocky.facts)) {
          if (key === 'issues') continue;
          if (value !== undefined && (prevFacts as any)[key] === undefined) {
            newlyAutoFilled.push(key);
          }
        }

        if (newlyAutoFilled.length > 0) {
          trackAutoFilledFields(leadId, newlyAutoFilled);
        }

        // Apply checklist updates
        let nextChecklist = prevChecklist;
        if (rocky.checklistUpdates.length > 0) {
          nextChecklist = prevChecklist.map((item) => {
            const update = rocky.checklistUpdates.find((u: any) => u.id === item.id);
            return update
              ? { ...item, checked: update.checked, note: update.note, autoDetected: true }
              : item;
          });
        }

        // Apply flags to exceptions list (dedupe)
        let nextExceptions = state.exceptions;
        if (rocky.flags.length > 0) {
          const newOnes = rocky.flags.map((flag: any) => `${String(flag.type).toUpperCase()}: ${flag.message}`);
          nextExceptions = Array.from(new Set([...nextExceptions, ...newOnes]));
        }

        set({
          keyDetails: rocky.facts as unknown as KeyDetails,
          checklistItems: nextChecklist,
          exceptions: nextExceptions,
          autoFilledFields: Array.from(new Set([...state.autoFilledFields, ...newlyAutoFilled])),
        });
      },

      setKeyDetails: (details: KeyDetails) => set({ keyDetails: details }),

      toggleChecklistItem: (id: string, checked: boolean) =>
        set((state) => ({
          checklistItems: state.checklistItems.map((item) => (item.id === id ? { ...item, checked } : item)),
        })),

      addAutoFilledFields: (fields: string[]) =>
        set((state) => ({
          autoFilledFields: Array.from(new Set([...state.autoFilledFields, ...fields])),
        })),

      removeAutoFilledField: (fieldName: string) =>
        set((state) => ({
          autoFilledFields: state.autoFilledFields.filter((f) => f !== fieldName),
        })),

      setExceptions: (exceptions: string[]) => set({ exceptions }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        leadId: state.leadId,
        sessionId: state.sessionId,
        keyDetails: state.keyDetails,
        checklistItems: state.checklistItems,
        autoFilledFields: state.autoFilledFields,
        exceptions: state.exceptions,
      }),
    }
  )
);

