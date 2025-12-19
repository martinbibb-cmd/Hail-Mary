/**
 * Active Customer Store
 * 
 * Global store for managing the currently active customer/lead.
 * All artifact creation (notes, photos, transcripts, etc.) should reference this active customer.
 * Persists to localStorage to survive page refresh.
 */

import { create } from 'zustand';
import type { Lead } from '@hail-mary/shared';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ActiveCustomerStore {
  // State
  activeLeadId: string | null;
  activeLead: Lead | null;
  saveStatus: SaveStatus;
  saveError: string | null;

  // Actions
  setActiveLead: (lead: Lead) => void;
  clearActiveLead: () => void;
  setSaveStatus: (status: SaveStatus, error?: string) => void;
  hydrate: () => Promise<void>;
}

// Storage key for localStorage persistence
// Shared constant to avoid duplication across the application
export const ACTIVE_CUSTOMER_STORAGE_KEY = 'hail-mary:active-customer';

// Helper to persist to localStorage
const persistToStorage = (leadId: string | null, lead: Lead | null) => {
  if (leadId && lead) {
    localStorage.setItem(ACTIVE_CUSTOMER_STORAGE_KEY, JSON.stringify({ leadId, lead }));
  } else {
    localStorage.removeItem(ACTIVE_CUSTOMER_STORAGE_KEY);
  }
};

// Helper to load from localStorage
const loadFromStorage = (): { leadId: string | null; lead: Lead | null } => {
  try {
    const stored = localStorage.getItem(ACTIVE_CUSTOMER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        leadId: parsed.leadId || null,
        lead: parsed.lead || null,
      };
    }
  } catch (error) {
    console.error('Failed to load active customer from localStorage:', error);
  }
  return { leadId: null, lead: null };
};

export const useActiveCustomerStore = create<ActiveCustomerStore>((set, get) => ({
  // Initial state
  activeLeadId: null,
  activeLead: null,
  saveStatus: 'idle',
  saveError: null,

  // Set active lead
  setActiveLead: (lead: Lead) => {
    const leadId = String(lead.id);
    persistToStorage(leadId, lead);
    set({
      activeLeadId: leadId,
      activeLead: lead,
      saveStatus: 'idle',
      saveError: null,
    });
  },

  // Clear active lead
  clearActiveLead: () => {
    persistToStorage(null, null);
    set({
      activeLeadId: null,
      activeLead: null,
      saveStatus: 'idle',
      saveError: null,
    });
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
    const { leadId, lead } = loadFromStorage();
    
    if (leadId && lead) {
      // If we have stored data, validate it's still current by fetching from API
      try {
        const response = await fetch(`/api/leads/${leadId}`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          // API returned error - could be 404 (deleted), 401 (auth), or 500 (server error)
          console.warn(`Failed to validate active customer (HTTP ${response.status}). Clearing stored data.`);
          persistToStorage(null, null);
          set({ activeLeadId: null, activeLead: null });
          return;
        }
        
        const result = await response.json();
        if (result.success && result.data) {
          set({
            activeLeadId: leadId,
            activeLead: result.data,
          });
          persistToStorage(leadId, result.data);
          return;
        } else {
          // API returned unsuccessful response (e.g., lead not found)
          console.warn('Active customer validation failed - lead may have been deleted');
          persistToStorage(null, null);
        }
      } catch (error) {
        // Network error or other fetch failure
        console.error('Network error validating active customer:', error);
        // In case of network error, keep the cached data but don't fail
        // User can still see who they were working with
        set({
          activeLeadId: leadId,
          activeLead: lead,
        });
        return;
      }
    }
    
    set({
      activeLeadId: null,
      activeLead: null,
    });
  },
}));
