/**
 * Utility functions for managing dock items in localStorage
 */

// Default visible dock items
export const DEFAULT_DOCK_ITEMS = [
  'home', 'addresses', 'diary', 'camera', 'photo-library',
  'transcripts', 'scans', 'engineer', 'sarah', 'presentation',
  'knowledge', 'profile'
];

/**
 * Safely load dock items from localStorage with validation
 * Returns DEFAULT_DOCK_ITEMS if stored value is invalid
 */
export function loadDockItems(): string[] {
  try {
    const stored = localStorage.getItem('dockItems');
    if (!stored) {
      return DEFAULT_DOCK_ITEMS;
    }

    const parsed = JSON.parse(stored);
    
    // Validate that it's an array of strings
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
      return parsed;
    }

    // Invalid format - clear and return default
    console.warn('[loadDockItems] Invalid dockItems format in localStorage, resetting to default');
    localStorage.removeItem('dockItems');
    return DEFAULT_DOCK_ITEMS;
  } catch (error) {
    // JSON parse error or localStorage access error - clear and return default
    console.warn('[loadDockItems] Failed to parse dockItems from localStorage, resetting to default', error);
    try {
      localStorage.removeItem('dockItems');
    } catch {
      // If we can't even clear localStorage, just continue with defaults
    }
    return DEFAULT_DOCK_ITEMS;
  }
}

/**
 * Safely save dock items to localStorage
 * @param items - Array of dock item IDs to save
 * @returns true if successful, false otherwise
 */
export function saveDockItems(items: string[]): boolean {
  try {
    localStorage.setItem('dockItems', JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('dockItemsChanged'));
    return true;
  } catch (error) {
    console.error('[saveDockItems] Failed to save dock items to localStorage', error);
    return false;
  }
}
