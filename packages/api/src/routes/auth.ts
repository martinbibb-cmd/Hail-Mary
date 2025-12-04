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
 */

import { Router, Request, Response } from 'express';
import {
  registerUser,
  loginWithPassword,
  getCurrentUserFromToken,
  startPasswordReset,
  completePasswordReset,
  AuthError,
} from '../services/auth.service';

const router = Router();

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
 * Start password reset flow - sends reset email (or logs to console in dev)
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

    const resetToken = await startPasswordReset(email);

    // Log the reset URL (in production, this would send an email)
    if (resetToken) {
      const resetUrl = `${getBaseUrl()}/reset-password?token=${resetToken}`;
      console.log('\n=== PASSWORD RESET ===');
      console.log(`Reset requested for: ${email}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log('======================\n');
    }

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

export default router;
