/**
 * Auth Middleware for Hail-Mary API
 * 
 * Provides authentication middleware for protected routes.
 */

import { Request, Response, NextFunction } from 'express';
import { getCurrentUserFromToken, UserPayload } from '../services/auth.service';

// Cookie name for auth token
const COOKIE_NAME = 'hm_auth_token';

// Extend Express Request to include user (compatible with Passport)
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends UserPayload {}
  }
}

/**
 * Middleware to require authentication
 * Extracts user from JWT cookie and attaches to request
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  const user = getCurrentUserFromToken(token);

  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
    return;
  }

  // Attach user to request
  req.user = user;
  next();
}

/**
 * Middleware to require admin role
 * Must be used after requireAuth
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
    return;
  }

  next();
}

/**
 * Middleware to block guest users from accessing a route
 * Must be used after requireAuth
 */
export function blockGuest(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  if (req.user.role === 'guest') {
    res.status(403).json({
      success: false,
      error: 'Guest users do not have access to this resource',
    });
    return;
  }

  next();
}

/**
 * Middleware for optional authentication
 * Extracts user from JWT cookie if present, but allows request to continue without auth
 * This is useful for endpoints that work without authentication but can use user context if available
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    // No token present - continue without user
    next();
    return;
  }

  const user = getCurrentUserFromToken(token);

  if (user) {
    // Valid token - attach user to request
    req.user = user;
  }

  // Continue regardless of token validity
  next();
}
