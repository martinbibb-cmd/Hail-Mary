/**
 * GC Number Normalization Utilities
 * 
 * Normalizes GC numbers to a canonical format for storage and lookup.
 */

/**
 * Normalizes a GC number to canonical format:
 * - Strip spaces
 * - Convert to uppercase
 * - Ensure consistent hyphen pattern if applicable
 * 
 * Examples:
 * - "47 311 19" -> "47-311-19"
 * - "47-311-19" -> "47-311-19"
 * - "47311 19" -> "47-311-19"
 * - "4731119" -> "47-311-19"
 * 
 * @param input Raw GC number from user input
 * @returns Normalized canonical GC number
 */
export function normalizeGc(input: string): string {
  if (!input) {
    return '';
  }

  // Remove all whitespace and convert to uppercase
  let normalized = input.trim().toUpperCase().replace(/\s+/g, '');

  // Remove existing hyphens temporarily
  normalized = normalized.replace(/-/g, '');

  // If the normalized string is all digits and matches common GC patterns, add hyphens
  // Common UK GC patterns: XX-XXX-XX (8 digits)
  if (/^\d{8}$/.test(normalized)) {
    // Format as XX-XXX-XX
    normalized = `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5, 7)}`;
  } else if (/^\d{7}$/.test(normalized)) {
    // Format as X-XXX-XX or XX-XXX-X depending on context
    // Default to XX-XXX-X for 7-digit patterns
    normalized = `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5)}`;
  }

  return normalized;
}

/**
 * Generates common aliases for a GC number to support lookup variations
 * 
 * @param canonical Canonical GC number
 * @returns Array of alias variations
 */
export function generateGcAliases(canonical: string): string[] {
  const aliases: string[] = [];

  // Add version without hyphens
  const noHyphens = canonical.replace(/-/g, '');
  if (noHyphens !== canonical) {
    aliases.push(noHyphens);
  }

  // Add version with spaces instead of hyphens
  const withSpaces = canonical.replace(/-/g, ' ');
  if (withSpaces !== canonical) {
    aliases.push(withSpaces);
  }

  // Add version with no separators and spaces
  const compact = canonical.replace(/[-\s]/g, '');
  if (compact !== canonical && !aliases.includes(compact)) {
    aliases.push(compact);
  }

  return aliases;
}

/**
 * Validates if a string looks like a plausible GC number
 * 
 * @param input String to validate
 * @returns true if it looks like a GC number
 */
export function isValidGcFormat(input: string): boolean {
  if (!input || input.trim().length === 0) {
    return false;
  }

  const normalized = normalizeGc(input);

  // Check if it matches common GC patterns
  // UK GC numbers are typically 7-8 digits with optional hyphens
  const gcPattern = /^\d{2}-\d{3}-\d{2,3}$|^\d{7,8}$/;

  return gcPattern.test(normalized);
}
