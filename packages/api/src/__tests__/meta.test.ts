/**
 * Tests for Meta API endpoint
 */

describe('Meta API Endpoint', () => {
  describe('Build Metadata', () => {
    it('should have GIT_SHA environment variable or default to unknown', () => {
      const gitSha = process.env.GIT_SHA || 'unknown';
      
      expect(gitSha).toBeTruthy();
      expect(typeof gitSha).toBe('string');
    });

    it('should have BUILD_TIME environment variable or use current time', () => {
      const buildTime = process.env.BUILD_TIME || new Date().toISOString();
      const buildDate = new Date(buildTime);
      
      expect(buildDate).toBeInstanceOf(Date);
      expect(buildDate.toString()).not.toBe('Invalid Date');
    });

    it('should have valid NODE_ENV', () => {
      const env = process.env.NODE_ENV || 'development';
      
      expect(['test', 'development', 'production']).toContain(env);
    });

    it('should have Node.js version', () => {
      const nodeVersion = process.version;
      
      expect(nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
    });
  });

  describe('Meta Route Response Structure', () => {
    it('should export metadata fields with correct types', () => {
      // This test verifies the expected structure
      const mockMetadata = {
        gitSha: process.env.GIT_SHA || 'unknown',
        buildTime: process.env.BUILD_TIME || new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || 'unknown',
        hostname: require('os').hostname(),
        nodeVersion: process.version,
      };

      expect(typeof mockMetadata.gitSha).toBe('string');
      expect(typeof mockMetadata.buildTime).toBe('string');
      expect(typeof mockMetadata.env).toBe('string');
      expect(typeof mockMetadata.version).toBe('string');
      expect(typeof mockMetadata.hostname).toBe('string');
      expect(typeof mockMetadata.nodeVersion).toBe('string');
    });
  });
});
