/**
 * Auth Routes for Hail-Mary
 *
 * Handles user authentication endpoints:
 * - POST /api/auth/register - Create new user account
 * - POST /api/auth/login - Login with email/password
 * - POST /api/auth/logout - Clear auth cookie
 * - GET /api/auth/me - Get current user from token
 * - POST /api/auth/request-password-reset - Start password reset flow
 * - POST /api/auth/reset-password - Complete password reset
 * - GET /api/auth/google - Initiate Google OAuth flow
 * - GET /api/auth/google/callback - Google OAuth callback
 */

import { Router, Request, Response } from 'express';
import passport from 'passport';
import {
  registerUser,
  loginWithPassword,
  getCurrentUserFromToken,
  startPasswordReset,
  completePasswordReset,
  AuthError,
} from '../services/auth.service';
import { configurePassport, isGoogleAuthEnabled } from '../config/passport';

const router = Router();

// Initialize Passport
configurePassport();
router.use(passport.initialize());

// Cookie configuration
const COOKIE_NAME = 'hm_auth_token';
const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
};

/**
 * Get cookie options with appropriate secure flag based on request protocol.
 * This allows the app to work correctly on both HTTP (local/NAS) and HTTPS (production).
 * 
 * Security Note: The X-Forwarded-Proto header can be spoofed by clients. When deploying
 * behind a reverse proxy (nginx, cloudflare, etc.), ensure the proxy is configured to
 * strip/override client-provided X-Forwarded headers. The nginx config in this project
 * already sets X-Forwarded-Proto correctly.
 */
const getCookieOptions = (req: Request): typeof BASE_COOKIE_OPTIONS & { secure: boolean } => {
  // Check if request is over HTTPS (via X-Forwarded-Proto header or direct)
  const forwardedProto = req.headers['x-forwarded-proto'];
  const isSecure = Boolean(
    req.secure || 
    forwardedProto === 'https' ||
    (process.env.BASE_URL && process.env.BASE_URL.startsWith('https://'))
  );
  
  return {
    ...BASE_COOKIE_OPTIONS,
    secure: isSecure,
  };
};

// Base URL for password reset links
const getBaseUrl = (): string => {
  return process.env.BASE_URL || 'https://hail_mary.cloudbibb.uk';
};

/**
 * Extract client IP address from request, considering proxies
 * @param req Express request object
 * @returns Client IP address
 */
const getClientIp = (req: Request): string => {
  // Check X-Forwarded-For header (set by reverse proxies)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2, ...)
    // Take the first one (original client)
    const ips = typeof forwardedFor === 'string' ? forwardedFor.split(',') : forwardedFor;
    return ips[0].trim();
  }

  // Check X-Real-IP header (alternative header)
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp.trim();
  }

  // Fall back to req.ip (direct connection or Express default)
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
};

/**
 * POST /api/auth/register
 * Create a new user account with email/password
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        code: 'validation_error',
        error: 'Name, email, and password are required',
      });
    }

    const { user, token } = await registerUser({ name, email, password });

    // Set auth cookie
    res.cookie(COOKIE_NAME, token, getCookieOptions(req));

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountId: user.accountId,
        authProvider: user.authProvider,
        role: user.role,
      },
      message: 'Registration successful',
    });
  } catch (error) {
    // Handle AuthError with proper code and status
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    // Generic fallback for unexpected errors
    console.error('Unexpected registration error:', error);
    return res.status(500).json({
      success: false,
      code: 'internal_error',
      error: 'An unexpected error occurred.',
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code: 'validation_error',
        error: 'Email and password are required',
      });
    }

    const { user, token } = await loginWithPassword({ email, password });

    // Set auth cookie
    res.cookie(COOKIE_NAME, token, getCookieOptions(req));

    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountId: user.accountId,
        authProvider: user.authProvider,
        role: user.role,
      },
      message: 'Login successful',
    });
  } catch (error) {
    // Handle AuthError with proper code and status
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    // Generic fallback for unexpected errors
    console.error('Unexpected login error:', error);
    return res.status(500).json({
      success: false,
      code: 'internal_error',
      error: 'An unexpected error occurred.',
    });
  }
});

/**
 * POST /api/auth/logout
 * Clear the auth cookie
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, {
    ...getCookieOptions(req),
    maxAge: 0,
  });

  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * GET /api/auth/me
 * Get current user from JWT cookie
 */
router.get('/me', (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated',
    });
  }

  const user = getCurrentUserFromToken(token);

  if (!user) {
    res.clearCookie(COOKIE_NAME, getCookieOptions(req));
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }

  return res.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      accountId: user.accountId,
      authProvider: user.authProvider,
      role: user.role,
    },
  });
});

/**
 * POST /api/auth/request-password-reset
 * Start password reset flow - sends reset email
 */
router.post('/request-password-reset', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Send password reset email (or log to console if email service fails)
    await startPasswordReset(email, getBaseUrl());

    // Always return success to not leak whether email exists
    return res.json({
      success: true,
      message: 'If an account exists with that email, you will receive a password reset link.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.json({
      success: true,
      message: 'If an account exists with that email, you will receive a password reset link.',
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Complete password reset with token and new password
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required',
      });
    }

    await completePasswordReset({ token, newPassword });

    return res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Password reset failed';
    const status = message.includes('expired') || message.includes('Invalid') ? 400 : 500;
    return res.status(status).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 * Only available if Google OAuth is enabled
 */
if (isGoogleAuthEnabled()) {
  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
  );

  /**
   * GET /api/auth/google/callback
   * Google OAuth callback - handles the redirect from Google
   */
  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/' }),
    (req: Request, res: Response) => {
      try {
        // User is attached by passport strategy, token is attached as extra property
        const userWithToken = req.user as any;

        if (!userWithToken || !userWithToken.token) {
          console.error('Missing user or token from Google OAuth');
          return res.redirect('/?error=auth_failed');
        }

        const token = userWithToken.token;

        // Set auth cookie
        res.cookie(COOKIE_NAME, token, getCookieOptions(req));

        // Redirect to home page after successful login
        return res.redirect('/');
      } catch (error) {
        console.error('Error in Google OAuth callback:', error);
        return res.redirect('/?error=auth_failed');
      }
    }
  );
} else {
  // Return helpful error if Google OAuth routes are accessed but not enabled
  router.get('/google', (_req: Request, res: Response) => {
    return res.status(503).json({
      success: false,
      error: 'Google OAuth is not enabled. Set GOOGLE_AUTH_ENABLED=true and provide GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
    });
  });

  router.get('/google/callback', (_req: Request, res: Response) => {
    return res.status(503).json({
      success: false,
      error: 'Google OAuth is not enabled.',
    });
  });
}

// ============================================
// NAS Quick Login Routes (Temporary)
// ============================================

/**
 * GET /api/auth/nas/users
 * List all users for NAS quick login
 * @security WARNING: Only enable on trusted networks!
 * @security IP restrictions applied - only accessible from local/private networks
 */
router.get('/nas/users', async (req: Request, res: Response) => {
  // Check if NAS mode is enabled
  if (process.env.NAS_AUTH_MODE !== 'true') {
    return res.status(403).json({
      success: false,
      error: 'NAS quick login is not enabled. Set NAS_AUTH_MODE=true to enable.',
    });
  }

  try {
    const clientIp = getClientIp(req);
    const { listUsersForNasLogin } = await import('../services/auth.service');
    const users = await listUsersForNasLogin(clientIp);
    return res.json({
      success: true,
      data: users,
      message: 'Users retrieved for NAS quick login',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    console.error('Error listing users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list users',
    });
  }
});

/**
 * POST /api/auth/nas/login
 * Quick login as a user without password (NAS mode)
 * @security WARNING: Only enable on trusted networks!
 * @security IP restrictions applied - only accessible from local/private networks
 */
router.post('/nas/login', async (req: Request, res: Response) => {
  // Check if NAS mode is enabled
  if (process.env.NAS_AUTH_MODE !== 'true') {
    return res.status(403).json({
      success: false,
      error: 'NAS quick login is not enabled. Set NAS_AUTH_MODE=true to enable.',
    });
  }

  try {
    const { userId } = req.body;

    if (!userId || typeof userId !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'userId is required and must be a number',
      });
    }

    const clientIp = getClientIp(req);
    const { nasQuickLogin } = await import('../services/auth.service');
    const { user, token } = await nasQuickLogin(userId, clientIp);

    // Set auth cookie
    res.cookie(COOKIE_NAME, token, getCookieOptions(req));

    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountId: user.accountId,
        authProvider: user.authProvider,
        role: user.role,
      },
      message: 'NAS quick login successful',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        error: error.message,
      });
    }
    console.error('Error in NAS login:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to login',
    });
  }
});

export default router;
