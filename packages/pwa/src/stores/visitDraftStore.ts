/**
 * Visit Draft Store
 *
 * Persists Visit Notes UI state across navigation/remount:
 * - checklistItems
 * - keyDetails
 * - exceptions
 * - visitSummary
 * - autoFilledFields
 *
 * Keyed by leadId so drafts don't bleed between customers.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChecklistItem, KeyDetails } from '../os/apps/visit/components';

export interface VisitDraft {
  leadId: string;
  visitSessionId?: number;
  checklistItems: ChecklistItem[];
  keyDetails: KeyDetails;
  autoFilledFields: string[];
  exceptions: string[];
  visitSummary?: string;
  updatedAt: string; // ISO string
}

interface VisitDraftState {
  draftsByLeadId: Record<string, VisitDraft>;

  upsertDraft: (leadId: string, patch: Partial<Omit<VisitDraft, 'leadId'>>) => void;
  clearDraft: (leadId: string) => void;
  getDraft: (leadId: string) => VisitDraft | null;
}

export const useVisitDraftStore = create<VisitDraftState>()(
  persist(
    (set, get) => ({
      draftsByLeadId: {},

      upsertDraft: (leadId, patch) => {
        set((state) => {
          const existing = state.draftsByLeadId[leadId];
          const base: VisitDraft = existing ?? {
            leadId,
            checklistItems: [],
            keyDetails: {},
            autoFilledFields: [],
            exceptions: [],
            updatedAt: new Date().toISOString(),
          };

          const next: VisitDraft = {
            ...base,
            ...patch,
            leadId,
            updatedAt: new Date().toISOString(),
            checklistItems: (patch.checklistItems ?? base.checklistItems) || [],
            keyDetails: (patch.keyDetails ?? base.keyDetails) || {},
            autoFilledFields: (patch.autoFilledFields ?? base.autoFilledFields) || [],
            exceptions: (patch.exceptions ?? base.exceptions) || [],
          };
          return {
            draftsByLeadId: {
              ...state.draftsByLeadId,
              [leadId]: next,
            },
          };
        });
      },

      clearDraft: (leadId) => {
        set((state) => {
          const next = { ...state.draftsByLeadId };
          delete next[leadId];
          return { draftsByLeadId: next };
        });
      },

      getDraft: (leadId) => {
        return get().draftsByLeadId[leadId] ?? null;
      },
    }),
    {
      name: 'visit-draft-storage',
      partialize: (state) => ({
        draftsByLeadId: state.draftsByLeadId,
      }),
    }
  )
);

