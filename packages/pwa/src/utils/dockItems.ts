/**
 * Utility functions for managing dock items in localStorage
 */

import { safeGetJSON, safeSetJSON } from '../lib/storage';
import { DEFAULT_DOCK_ITEMS, coerceDockItems, ensureRequiredDockItems } from '../lib/dock';

// Re-export DEFAULT_DOCK_ITEMS for backward compatibility
export { DEFAULT_DOCK_ITEMS };

/**
 * Safely load dock items from localStorage with validation
 * Returns DEFAULT_DOCK_ITEMS if stored value is invalid
 */
export function loadDockItems(): string[] {
  const raw = safeGetJSON<unknown>('dockItems');
  
  if (!raw) {
    return [...DEFAULT_DOCK_ITEMS];
  }

  const coerced = coerceDockItems(raw);
  
  if (!coerced) {
    // Invalid format - clear and return default
    console.warn('[loadDockItems] Invalid dockItems format in localStorage, resetting to default');
    try {
      localStorage.removeItem('dockItems');
    } catch {
      // If we can't clear localStorage, just continue with defaults
    }
    return [...DEFAULT_DOCK_ITEMS];
  }

  return ensureRequiredDockItems(coerced);
}

/**
 * Safely save dock items to localStorage
 * @param items - Array of dock item IDs to save
 * @returns true if successful, false otherwise
 */
export function saveDockItems(items: string[]): boolean {
  const normalizedItems = ensureRequiredDockItems(items);
  const success = safeSetJSON('dockItems', normalizedItems);
  
  if (success) {
    // Use Event instead of CustomEvent for Safari compatibility
    window.dispatchEvent(new Event('dockItemsChanged'));
  }
  
  return success;
}
