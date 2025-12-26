/**
 * Safe localStorage helpers that prevent crashes from:
 * - localStorage access exceptions
 * - Invalid JSON parsing
 * - Type mismatches
 */

/**
 * Safely retrieve and parse JSON from localStorage
 * @param key - localStorage key to retrieve
 * @returns Parsed value or null if not found/invalid
 */
export function safeGetJSON<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      return null;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`[safeGetJSON] Failed to get/parse "${key}" from localStorage:`, error);
    return null;
  }
}

/**
 * Safely stringify and save value to localStorage
 * @param key - localStorage key to set
 * @param value - Value to stringify and save
 * @returns true if successful, false otherwise
 */
export function safeSetJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[safeSetJSON] Failed to save "${key}" to localStorage:`, error);
    return false;
  }
}
