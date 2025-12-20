/**
 * Lead Store - Single Source of Truth
 * 
 * Global store for managing leads with save queue and retry logic.
 * - currentLeadId: the active lead
 * - leadById: cached lead data
 * - dirtyByLeadId: tracks unsaved changes
 * - lastSavedAtByLeadId: last save timestamp
 * - saveQueue: pending save operations
 * - saveFailuresByLeadId: failure counter for retries
 * 
 * Persists to localStorage to survive page refresh.
 */

import { create } from 'zustand';
import type { Lead } from '@hail-mary/shared';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface PendingSaveJob {
  id: string;
  leadId: string;
  reason: 'stop_recording' | 'process_recording' | 'end_visit' | 'manual_save';
  payload: unknown;
  attempts: number;
  createdAt: string;
}

interface LeadStore {
  // Current lead state
  currentLeadId: string | null;
  
  // Lead data cache
  leadById: Record<string, Lead>;
  
  // Dirty state tracking (unsaved changes)
  dirtyByLeadId: Record<string, boolean>;
  
  // Last saved timestamps
  lastSavedAtByLeadId: Record<string, string | null>;
  
  // Save queue for offline/retry
  saveQueue: PendingSaveJob[];
  
  // Failure counters for exponential backoff
  saveFailuresByLeadId: Record<string, number>;
  
  // UI state
  saveStatus: SaveStatus;
  saveError: string | null;
  isSyncing: boolean;

  // Actions
  setCurrentLead: (lead: Lead) => void;
  clearCurrentLead: () => void;
  updateLeadData: (leadId: string, updates: Partial<Lead>) => void;
  markDirty: (leadId: string) => void;
  markClean: (leadId: string) => void;
  enqueueSave: (job: Omit<PendingSaveJob, 'id' | 'attempts' | 'createdAt'>) => void;
  flushSaveQueue: () => Promise<void>;
  exportLeadAsJson: (leadId: string) => string;
  setSaveStatus: (status: SaveStatus, error?: string) => void;
  hydrate: () => Promise<void>;
}

// Storage keys for localStorage persistence
export const LEAD_STORE_STORAGE_KEY = 'hail-mary:lead-store';

// Helper to persist to localStorage
const persistToStorage = (state: Partial<LeadStore>) => {
  try {
    const toStore = {
      currentLeadId: state.currentLeadId,
      leadById: state.leadById,
      dirtyByLeadId: state.dirtyByLeadId,
      lastSavedAtByLeadId: state.lastSavedAtByLeadId,
      saveQueue: state.saveQueue,
      saveFailuresByLeadId: state.saveFailuresByLeadId,
    };
    localStorage.setItem(LEAD_STORE_STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('Failed to persist lead store to localStorage:', error);
  }
};

// Helper to load from localStorage
const loadFromStorage = (): Partial<LeadStore> | null => {
  try {
    const stored = localStorage.getItem(LEAD_STORE_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load lead store from localStorage:', error);
  }
  return null;
};

// Generate unique ID for save jobs
const generateJobId = () => `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useLeadStore = create<LeadStore>((set, get) => ({
  // Initial state
  currentLeadId: null,
  leadById: {},
  dirtyByLeadId: {},
  lastSavedAtByLeadId: {},
  saveQueue: [],
  saveFailuresByLeadId: {},
  saveStatus: 'idle',
  saveError: null,
  isSyncing: false,

  // Set current lead (also caches it)
  setCurrentLead: (lead: Lead) => {
    const leadId = String(lead.id);
    const state = get();
    const newState = {
      currentLeadId: leadId,
      leadById: { ...state.leadById, [leadId]: lead },
      saveStatus: 'idle' as SaveStatus,
      saveError: null,
    };
    set(newState);
    persistToStorage({ ...state, ...newState });
  },

  // Clear current lead (doesn't remove from cache)
  clearCurrentLead: () => {
    const state = get();
    const newState = {
      currentLeadId: null,
      saveStatus: 'idle' as SaveStatus,
      saveError: null,
    };
    set(newState);
    persistToStorage({ ...state, ...newState });
  },

  // Update lead data in cache (marks as dirty)
  updateLeadData: (leadId: string, updates: Partial<Lead>) => {
    const state = get();
    const existingLead = state.leadById[leadId];
    if (!existingLead) return;
    
    const updatedLead = { ...existingLead, ...updates };
    const newState = {
      leadById: { ...state.leadById, [leadId]: updatedLead },
      dirtyByLeadId: { ...state.dirtyByLeadId, [leadId]: true },
    };
    set(newState);
    persistToStorage({ ...state, ...newState });
  },

  // Mark lead as having unsaved changes
  markDirty: (leadId: string) => {
    const state = get();
    const newState = {
      dirtyByLeadId: { ...state.dirtyByLeadId, [leadId]: true },
    };
    set(newState);
    persistToStorage({ ...state, ...newState });
  },

  // Mark lead as clean (saved)
  markClean: (leadId: string) => {
    const state = get();
    const now = new Date().toISOString();
    const newState = {
      dirtyByLeadId: { ...state.dirtyByLeadId, [leadId]: false },
      lastSavedAtByLeadId: { ...state.lastSavedAtByLeadId, [leadId]: now },
      saveFailuresByLeadId: { ...state.saveFailuresByLeadId, [leadId]: 0 },
    };
    set(newState);
    persistToStorage({ ...state, ...newState });
  },

  // Add save job to queue
  enqueueSave: (job: Omit<PendingSaveJob, 'id' | 'attempts' | 'createdAt'>) => {
    const state = get();
    const newJob: PendingSaveJob = {
      ...job,
      id: generateJobId(),
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    const newState = {
      saveQueue: [...state.saveQueue, newJob],
    };
    set(newState);
    persistToStorage({ ...state, ...newState });
    
    // Auto-flush queue
    setTimeout(() => get().flushSaveQueue(), 100);
  },

  // Process save queue with retry logic
  flushSaveQueue: async () => {
    const state = get();
    if (state.isSyncing || state.saveQueue.length === 0) return;

    set({ isSyncing: true, saveStatus: 'saving' });

    const queue = [...state.saveQueue];
    const failedJobs: PendingSaveJob[] = [];

    for (const job of queue) {
      try {
        // Attempt to save to API
        const response = await fetch(`/api/leads/${job.leadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(job.payload),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Save failed');
        }

        // Success - mark clean
        get().markClean(job.leadId);
      } catch (error) {
        console.error(`Save job ${job.id} failed:`, error);
        
        // Increment failure counter
        const failures = (state.saveFailuresByLeadId[job.leadId] || 0) + 1;
        
        // Retry with exponential backoff (max 3 attempts)
        if (job.attempts < 2) {
          failedJobs.push({ ...job, attempts: job.attempts + 1 });
        } else {
          // Max retries reached
          set({
            saveFailuresByLeadId: {
              ...state.saveFailuresByLeadId,
              [job.leadId]: failures,
            },
          });
        }
      }
    }

    // Update queue with only failed jobs
    const newState = {
      saveQueue: failedJobs,
      isSyncing: false,
      saveStatus: (failedJobs.length > 0 ? 'error' : 'saved') as SaveStatus,
      saveError: failedJobs.length > 0 ? 'Some saves failed. You can export data as JSON.' : null,
    };
    set(newState);
    persistToStorage({ ...state, ...newState });
  },

  // Export lead data as JSON (for offline backup)
  exportLeadAsJson: (leadId: string) => {
    const state = get();
    const lead = state.leadById[leadId];
    const pendingJobs = state.saveQueue.filter(job => job.leadId === leadId);
    
    const exportData = {
      lead,
      pendingJobs,
      exportedAt: new Date().toISOString(),
      isDirty: state.dirtyByLeadId[leadId] || false,
      lastSavedAt: state.lastSavedAtByLeadId[leadId] || null,
    };
    
    return JSON.stringify(exportData, null, 2);
  },

  // Set save status
  setSaveStatus: (status: SaveStatus, error?: string) => {
    set({
      saveStatus: status,
      saveError: error || null,
    });
  },

  // Hydrate from localStorage on boot
  hydrate: async () => {
    const stored = loadFromStorage();
    
    if (stored) {
      set({
        currentLeadId: stored.currentLeadId || null,
        leadById: stored.leadById || {},
        dirtyByLeadId: stored.dirtyByLeadId || {},
        lastSavedAtByLeadId: stored.lastSavedAtByLeadId || {},
        saveQueue: stored.saveQueue || [],
        saveFailuresByLeadId: stored.saveFailuresByLeadId || {},
      });

      // Validate current lead if set
      if (stored.currentLeadId) {
        try {
          const response = await fetch(`/api/leads/${stored.currentLeadId}`, {
            credentials: 'include',
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              get().setCurrentLead(result.data);
            }
          }
        } catch (error) {
          console.error('Failed to validate current lead:', error);
          // Keep cached data on network error
        }
      }

      // Auto-flush any pending saves
      if (stored.saveQueue && stored.saveQueue.length > 0) {
        setTimeout(() => get().flushSaveQueue(), 1000);
      }
    }
  },
}));

// Backwards compatibility export
export const useActiveCustomerStore = useLeadStore;
