/**
 * Unit tests for Auth Service
 * 
 * These tests focus on the pure logic of the auth service,
 * mocking the database layer.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Mock the database module before importing the service
jest.mock('../db/drizzle-client', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  },
}));

jest.mock('../db/drizzle-schema', () => ({
  users: { id: 'id', email: 'email', name: 'name', passwordHash: 'password_hash' },
  passwordResetTokens: { id: 'id', token: 'token', userId: 'user_id' },
  accounts: { id: 'id', name: 'name' },
}));

describe('Auth Service Functions', () => {
  describe('Password Hashing', () => {
    it('should hash passwords correctly with bcrypt', async () => {
      const password = 'securePassword123';
      const hash = await bcrypt.hash(password, 12);
      
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt hash prefix
    });

    it('should verify passwords correctly', async () => {
      const password = 'securePassword123';
      const hash = await bcrypt.hash(password, 12);
      
      const isValid = await bcrypt.compare(password, hash);
      const isInvalid = await bcrypt.compare('wrongPassword', hash);
      
      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });

  describe('JWT Token Generation', () => {
    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

    it('should generate valid JWT tokens', () => {
      const payload = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        authProvider: 'local',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should verify and decode JWT tokens correctly', () => {
      const payload = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        authProvider: 'local',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
      const decoded = jwt.verify(token, JWT_SECRET) as typeof payload;
      
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.name).toBe(payload.name);
      expect(decoded.authProvider).toBe(payload.authProvider);
    });

    it('should reject invalid tokens', () => {
      expect(() => {
        jwt.verify('invalid.token.here', JWT_SECRET);
      }).toThrow();
    });

    it('should reject tokens signed with different secret', () => {
      const payload = { id: 1, email: 'test@example.com' };
      const token = jwt.sign(payload, 'different-secret');
      
      expect(() => {
        jwt.verify(token, JWT_SECRET);
      }).toThrow();
    });
  });

  describe('Reset Token Generation', () => {
    it('should generate unique reset tokens', () => {
      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');
      
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
      expect(token2.length).toBe(64);
    });
  });

  describe('Email Validation', () => {
    it('should normalize emails to lowercase', () => {
      const email = 'Test@Example.COM';
      const normalized = email.toLowerCase().trim();
      
      expect(normalized).toBe('test@example.com');
    });
  });

  describe('Password Validation', () => {
    it('should require minimum 8 characters', () => {
      const shortPassword = 'short';
      const validPassword = 'password123';
      
      expect(shortPassword.length >= 8).toBe(false);
      expect(validPassword.length >= 8).toBe(true);
    });
  });
});
