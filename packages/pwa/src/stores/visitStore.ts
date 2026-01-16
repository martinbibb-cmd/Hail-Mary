/**
 * Visit Store - Manages active visit session and recording state
 * 
 * Tracks:
 * - activeSession: current VisitSession (legacy) if any
 * - currentSpineVisitId: current spine_visit ID (new workflow)
 * - currentPropertyId: current spine_property ID (new workflow)
 * 
 * This store supports both legacy (leadId-based) and new (spine-based) workflows during transition.
 */

import { create } from 'zustand';
import type { VisitSession, Lead } from '@hail-mary/shared';
import { useTranscriptionStore } from './transcriptionStore';

export interface SpineProperty {
  id: string; // UUID
  addressId?: string; // UUID
  addressLine1: string;
  addressLine2?: string | null;
  town?: string | null;
  postcode: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpineVisit {
  id: string; // UUID
  propertyId: string; // UUID
  startedAt: string;
  endedAt?: string | null;
  createdAt: string;
}

export interface EndVisitResult {
  success: boolean;
  error?: string;
}

interface VisitStore {
  // Legacy: Active visit session (for backward compatibility)
  activeSession: VisitSession | null;
  activeLead: Lead | null;
  
  // NEW: Spine-based visit context
  currentSpineVisitId: string | null;
  currentPropertyId: string | null;
  spineVisitById: Record<string, SpineVisit>;
  propertyById: Record<string, SpineProperty>;
  
  // End visit state
  isEndingVisit: boolean;
  endVisitError: string | null;
  
  // Legacy Actions
  setActiveSession: (session: VisitSession | null, lead: Lead | null) => void;
  clearSession: () => void;
  endVisit: () => Promise<EndVisitResult>;
  clearEndVisitError: () => void;
  
  // NEW: Spine-based Actions
  setCurrentSpineVisit: (visit: SpineVisit, property: SpineProperty) => void;
  clearCurrentSpineVisit: () => void;
  updateSpineVisit: (visitId: string, updates: Partial<SpineVisit>) => void;
  updateProperty: (propertyId: string, updates: Partial<SpineProperty>) => void;
}

// Storage key for localStorage persistence
const VISIT_STORE_STORAGE_KEY = 'hail-mary:visit-store';

// Helper to persist to localStorage
const persistToStorage = (state: Partial<VisitStore>) => {
  try {
    const toStore = {
      currentSpineVisitId: state.currentSpineVisitId,
      currentPropertyId: state.currentPropertyId,
      spineVisitById: state.spineVisitById,
      propertyById: state.propertyById,
    };
    localStorage.setItem(VISIT_STORE_STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('Failed to persist visit store to localStorage:', error);
  }
};

// Helper to load from localStorage
const loadFromStorage = (): Partial<VisitStore> | null => {
  try {
    const stored = localStorage.getItem(VISIT_STORE_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load visit store from localStorage:', error);
  }
  return null;
};

export const useVisitStore = create<VisitStore>((set, get) => {
  // Load initial state from storage
  const stored = loadFromStorage();
  
  return {
    // Legacy initial state
    activeSession: null,
    activeLead: null,
    isEndingVisit: false,
    endVisitError: null,

    // NEW: Spine-based initial state
    currentSpineVisitId: stored?.currentSpineVisitId ?? null,
    currentPropertyId: stored?.currentPropertyId ?? null,
    spineVisitById: stored?.spineVisitById ?? {},
    propertyById: stored?.propertyById ?? {},

    // Legacy: Set active session (when visit starts)
    setActiveSession: (session: VisitSession | null, lead: Lead | null) => set({
      activeSession: session,
      activeLead: lead,
      endVisitError: null,
    }),

    // Legacy: Clear session (when visit ends)
    clearSession: () => set({
      activeSession: null,
      activeLead: null,
      isEndingVisit: false,
      endVisitError: null,
    }),

    // Legacy: End visit - global action that can be called from any page
    endVisit: async (): Promise<EndVisitResult> => {
      const state = get();
      const { activeSession } = state;

      // Cannot end visit if no active session
      if (!activeSession) {
        return { success: false, error: 'No active visit session to end.' };
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

        // Clear transcription store
        useTranscriptionStore.getState().clearSession();

        // Success - clear the session
        set({
          activeSession: null,
          activeLead: null,
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

    // Legacy: Clear end visit error
    clearEndVisitError: () => set({ endVisitError: null }),

    // NEW: Set current spine visit and property
    setCurrentSpineVisit: (visit: SpineVisit, property: SpineProperty) => {
      const state = get();
      const newState = {
        currentSpineVisitId: visit.id,
        currentPropertyId: property.id,
        spineVisitById: { ...state.spineVisitById, [visit.id]: visit },
        propertyById: { ...state.propertyById, [property.id]: property },
      };
      set(newState);
      persistToStorage({ ...state, ...newState });
    },

    // NEW: Clear current spine visit
    clearCurrentSpineVisit: () => {
      const state = get();
      const newState = {
        currentSpineVisitId: null,
        currentPropertyId: null,
      };
      set(newState);
      persistToStorage({ ...state, ...newState });
    },

    // NEW: Update spine visit data
    updateSpineVisit: (visitId: string, updates: Partial<SpineVisit>) => {
      const state = get();
      const existing = state.spineVisitById[visitId];
      if (!existing) return;
      
      const updated = { ...existing, ...updates };
      const newState = {
        spineVisitById: { ...state.spineVisitById, [visitId]: updated },
      };
      set(newState);
      persistToStorage({ ...state, ...newState });
    },

    // NEW: Update property data
    updateProperty: (propertyId: string, updates: Partial<SpineProperty>) => {
      const state = get();
      const existing = state.propertyById[propertyId];
      if (!existing) return;
      
      const updated = { ...existing, ...updates };
      const newState = {
        propertyById: { ...state.propertyById, [propertyId]: updated },
      };
      set(newState);
      persistToStorage({ ...state, ...newState });
    },
  };
});
