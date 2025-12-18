/**
 * CSRF Protection Middleware
 * 
 * Provides CSRF token generation and validation for protected routes.
 * Uses csrf-csrf library with double-submit cookie pattern.
 */

import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';

// Generate CSRF protection middleware
const {
  invalidCsrfTokenError, // Error to throw if token is invalid
  generateToken, // Generates a secret and a token
  validateRequest, // Validates the token
  doubleCsrfProtection, // The middleware to use
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
  cookieName: 'hm_csrf_token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string || req.body?._csrf,
});

/**
 * Middleware to generate and attach CSRF token to response
 * Use this on routes that need to provide a token to clients
 */
export function generateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  const csrfToken = generateToken(req, res);
  res.locals.csrfToken = csrfToken;
  next();
}

/**
 * Middleware to validate CSRF token on protected routes
 * Use this on state-changing routes (POST, PUT, DELETE, PATCH)
 */
export const csrfProtection = doubleCsrfProtection;

/**
 * Error handler for CSRF errors
 */
export function csrfErrorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (err === invalidCsrfTokenError) {
    res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
    });
    return;
  }
  next(err);
}
