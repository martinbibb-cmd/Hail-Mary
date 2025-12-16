/**
 * Unit tests for Config Loader
 * 
 * Tests resilient JSON configuration loading with fallback behavior.
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadJsonConfig, clearConfigCache } from '../utils/configLoader';

describe('Config Loader', () => {
  const testFileName = 'test-config.json';
  const testFallback = { version: 1, test: 'fallback' };
  
  beforeEach(() => {
    clearConfigCache();
  });
  
  afterEach(() => {
    clearConfigCache();
  });

  describe('Resilient Loading', () => {
    it('should return fallback when no files exist', () => {
      const result = loadJsonConfig('nonexistent-file.json', testFallback);
      
      expect(result.config).toEqual(testFallback);
      expect(result.loadedFrom).toBeNull();
      expect(result.usedFallback).toBe(true);
    });

    it('should load from src path when available (dev mode)', () => {
      const srcPath = path.join(process.cwd(), 'packages', 'shared', 'src', 'core', 'depot-schema.json');
      
      if (fs.existsSync(srcPath)) {
        const result = loadJsonConfig('depot-schema.json', testFallback);
        
        expect(result.usedFallback).toBe(false);
        expect(result.loadedFrom).toBeTruthy();
        expect(result.config).toHaveProperty('sections');
      }
    });

    it('should handle invalid JSON gracefully', () => {
      // Create a temporary invalid JSON file
      const tmpDir = path.join(process.cwd(), 'tmp-test-config');
      const tmpFile = path.join(tmpDir, 'invalid.json');
      
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(tmpFile, '{ invalid json }');
        
        // Set env var to point to temp directory
        process.env.HAILMARY_CORE_PATH = tmpDir;
        
        const result = loadJsonConfig('invalid.json', testFallback);
        
        // Should fall back gracefully
        expect(result.config).toEqual(testFallback);
        expect(result.usedFallback).toBe(true);
      } finally {
        // Cleanup
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
        if (fs.existsSync(tmpDir)) {
          fs.rmdirSync(tmpDir);
        }
        delete process.env.HAILMARY_CORE_PATH;
      }
    });

    it('should prioritize HAILMARY_CORE_PATH when set', () => {
      const tmpDir = path.join(process.cwd(), 'tmp-test-config');
      const tmpFile = path.join(tmpDir, testFileName);
      const customConfig = { version: 2, custom: true };
      
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(tmpFile, JSON.stringify(customConfig));
        
        // Set env var to point to temp directory
        process.env.HAILMARY_CORE_PATH = tmpDir;
        
        const result = loadJsonConfig(testFileName, testFallback);
        
        expect(result.config).toEqual(customConfig);
        expect(result.usedFallback).toBe(false);
        expect(result.loadedFrom).toContain('tmp-test-config');
      } finally {
        // Cleanup
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
        if (fs.existsSync(tmpDir)) {
          fs.rmdirSync(tmpDir);
        }
        delete process.env.HAILMARY_CORE_PATH;
      }
    });

    it('should load valid JSON and return parsed object', () => {
      const tmpDir = path.join(process.cwd(), 'tmp-test-config');
      const tmpFile = path.join(tmpDir, testFileName);
      const validConfig = { version: 3, items: ['a', 'b', 'c'] };
      
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(tmpFile, JSON.stringify(validConfig));
        
        process.env.HAILMARY_CORE_PATH = tmpDir;
        
        const result = loadJsonConfig(testFileName, testFallback);
        
        expect(result.config).toEqual(validConfig);
        expect(result.usedFallback).toBe(false);
        expect(result.loadedFrom).toBeTruthy();
      } finally {
        // Cleanup
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
        if (fs.existsSync(tmpDir)) {
          fs.rmdirSync(tmpDir);
        }
        delete process.env.HAILMARY_CORE_PATH;
      }
    });
  });

  describe('Fallback Behavior', () => {
    it('should never throw on missing files', () => {
      expect(() => {
        loadJsonConfig('completely-missing.json', testFallback);
      }).not.toThrow();
    });

    it('should never throw on invalid JSON', () => {
      const tmpDir = path.join(process.cwd(), 'tmp-test-config');
      const tmpFile = path.join(tmpDir, 'bad.json');
      
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(tmpFile, 'not json at all');
        
        process.env.HAILMARY_CORE_PATH = tmpDir;
        
        expect(() => {
          loadJsonConfig('bad.json', testFallback);
        }).not.toThrow();
      } finally {
        // Cleanup
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
        if (fs.existsSync(tmpDir)) {
          fs.rmdirSync(tmpDir);
        }
        delete process.env.HAILMARY_CORE_PATH;
      }
    });

    it('should return correct fallback structure', () => {
      const complexFallback = {
        version: 1,
        items: [{ id: 1, name: 'test' }],
        metadata: { created: '2024-01-01' },
      };
      
      const result = loadJsonConfig('missing.json', complexFallback);
      
      expect(result.config).toEqual(complexFallback);
      expect(result.config.items).toHaveLength(1);
      expect(result.config.metadata.created).toBe('2024-01-01');
    });
  });
});
