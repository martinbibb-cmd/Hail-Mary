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
