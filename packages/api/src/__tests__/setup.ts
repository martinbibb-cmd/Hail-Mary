/**
 * Jest setup for API tests
 */

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

// Increase timeout for slower operations
jest.setTimeout(10000);
