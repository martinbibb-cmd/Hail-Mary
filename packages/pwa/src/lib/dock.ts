/**
 * Dock items validation and defaults
 */

// Default visible dock items
export const DEFAULT_DOCK_ITEMS: string[] = [
  'home', 'addresses', 'visit', 'customers', 'leads', 'diary',
  'camera', 'photo-library', 'engineer', 'sarah', 'profile'
];

// All known dock item IDs for validation
const KNOWN_DOCK_IDS = new Set([
  'home', 'addresses', 'visit', 'customers', 'quotes', 'leads',
  'diary', 'camera', 'photo-library', 'transcripts', 'scans',
  'engineer', 'sarah', 'presentation', 'knowledge', 'trajectory', 'profile'
]);

/**
 * Validate and coerce value to be a valid dock items array
 * @param value - Unknown value to validate
 * @returns Valid string array or null if invalid
 */
export function coerceDockItems(value: unknown): string[] | null {
  // Must be an array
  if (!Array.isArray(value)) {
    return null;
  }

  // All items must be strings
  if (!value.every(item => typeof item === 'string')) {
    return null;
  }

  // Filter to only known dock item IDs
  const validItems = value.filter(item => KNOWN_DOCK_IDS.has(item));

  // Must have at least one valid item
  if (validItems.length === 0) {
    return null;
  }

  return validItems;
}
