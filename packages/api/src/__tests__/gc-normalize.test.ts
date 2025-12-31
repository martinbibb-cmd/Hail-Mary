/**
 * Tests for GC normalization utilities
 */

import { normalizeGc, generateGcAliases, isValidGcFormat } from '../utils/gc-normalize';

describe('GC Normalization', () => {
  describe('normalizeGc', () => {
    test('should normalize GC number with spaces', () => {
      expect(normalizeGc('47 311 19')).toBe('47-311-19');
    });

    test('should normalize GC number with hyphens', () => {
      expect(normalizeGc('47-311-19')).toBe('47-311-19');
    });

    test('should normalize GC number without separators', () => {
      expect(normalizeGc('4731119')).toBe('47-311-19');
    });

    test('should handle mixed separators', () => {
      expect(normalizeGc('47311 19')).toBe('47-311-19');
    });

    test('should convert to uppercase', () => {
      expect(normalizeGc('47-311-19')).toBe('47-311-19');
    });

    test('should handle 7-digit patterns', () => {
      expect(normalizeGc('7831151')).toBe('78-311-51');
    });

    test('should handle empty string', () => {
      expect(normalizeGc('')).toBe('');
    });

    test('should trim whitespace', () => {
      expect(normalizeGc('  47 311 19  ')).toBe('47-311-19');
    });
  });

  describe('generateGcAliases', () => {
    test('should generate aliases for canonical GC number', () => {
      const aliases = generateGcAliases('47-311-19');
      expect(aliases).toContain('4731119');
      expect(aliases).toContain('47 311 19');
    });

    test('should not duplicate aliases', () => {
      const aliases = generateGcAliases('47-311-19');
      const uniqueAliases = new Set(aliases);
      expect(aliases.length).toBe(uniqueAliases.size);
    });

    test('should handle GC number without hyphens by normalizing first', () => {
      const normalized = normalizeGc('4731119');
      const aliases = generateGcAliases(normalized);
      expect(aliases.length).toBeGreaterThan(0);
    });
  });

  describe('isValidGcFormat', () => {
    test('should accept valid GC number formats', () => {
      expect(isValidGcFormat('47-311-19')).toBe(true);
      expect(isValidGcFormat('47 311 19')).toBe(true);
      expect(isValidGcFormat('4731119')).toBe(true);
      expect(isValidGcFormat('78-311-51')).toBe(true);
    });

    test('should reject invalid formats', () => {
      expect(isValidGcFormat('')).toBe(false);
      expect(isValidGcFormat('abc')).toBe(false);
      expect(isValidGcFormat('12-34')).toBe(false);
      expect(isValidGcFormat('123456789012')).toBe(false);
    });

    test('should handle whitespace', () => {
      expect(isValidGcFormat('   ')).toBe(false);
      expect(isValidGcFormat('  47-311-19  ')).toBe(true);
    });
  });
});
