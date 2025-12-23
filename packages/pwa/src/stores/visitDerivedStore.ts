import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KeyDetails } from '../os/apps/visit/components/KeyDetailsForm';

export interface VisitDerivedEntry {
  keyDetails: KeyDetails;
  /**
   * Fields that are currently considered auto-populated from transcript extraction.
   * Consumers can use this for UI badges/highlights.
   */
  autoFilledFields: string[];
  lastUpdated: string;
}

interface VisitDerivedStore {
  byLeadId: Record<string, VisitDerivedEntry>;
  upsert: (leadId: string, entry: VisitDerivedEntry) => void;
  clear: (leadId: string) => void;
}

export const useVisitDerivedStore = create<VisitDerivedStore>()(
  persist(
    (set, get) => ({
      byLeadId: {},
      upsert: (leadId: string, entry: VisitDerivedEntry) =>
        set({
          byLeadId: {
            ...get().byLeadId,
            [leadId]: entry,
          },
        }),
      clear: (leadId: string) => {
        const next = { ...get().byLeadId };
        delete next[leadId];
        set({ byLeadId: next });
      },
    }),
    {
      name: 'visit-derived-storage',
    }
  )
);

