/**
 * Passport.js Configuration for Google OAuth
 * 
 * Google OAuth is DISABLED by default. To enable:
 * 1. Set GOOGLE_AUTH_ENABLED=true
 * 2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
 * 
 * This prevents crashes when Google OAuth credentials are not configured.
 */

import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { findOrCreateGoogleUser, GoogleProfile } from '../services/auth.service';

// Google OAuth configuration from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

/**
 * Check if Google OAuth is enabled
 * Requires GOOGLE_AUTH_ENABLED=true AND valid credentials
 */
export function isGoogleAuthEnabled(): boolean {
  // Check explicit enable flag (defaults to false)
  const explicitlyEnabled = process.env.GOOGLE_AUTH_ENABLED === 'true';
  
  // Check if credentials are provided
  const hasCredentials = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
  
  return explicitlyEnabled && hasCredentials;
}

// Construct callback URL from BASE_URL if GOOGLE_CALLBACK_URL is not explicitly set
// This ensures Google OAuth works correctly with tunnels (Cloudflare Tunnel, ngrok, etc.)
const getGoogleCallbackUrl = (): string => {
  if (process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL;
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  return `${baseUrl}/api/auth/google/callback`;
};

/**
 * Configure Google OAuth Strategy
 * Only configures the strategy if Google OAuth is enabled with valid credentials
 */
export function configurePassport() {
  // Serialize user for session (not used with JWT, but required by passport)
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  // Deserialize user from session (not used with JWT, but required by passport)
  passport.deserializeUser((id: number, done) => {
    // Not used with JWT-based auth, but required by passport
    done(null, null);
  });

  // Only configure Google OAuth if enabled and credentials are present
  if (!isGoogleAuthEnabled()) {
    console.log('📋 Google OAuth is DISABLED (set GOOGLE_AUTH_ENABLED=true and provide credentials to enable)');
    return;
  }

  console.log('🔐 Google OAuth is ENABLED');
  
  const GOOGLE_CALLBACK_URL = getGoogleCallbackUrl();

  // Configure Google OAuth 2.0 Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
        try {
          // Extract user info from Google profile
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;

          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          const googleProfile: GoogleProfile = {
            id: profile.id,
            email,
            name,
            picture: profile.photos?.[0]?.value,
          };

          // Find or create user in database
          const { user, token } = await findOrCreateGoogleUser(googleProfile);

          // Attach token to user object for use in callback route
          // TypeScript doesn't know about this extra property, but it's fine
          const userWithToken = { ...user, token } as Express.User;

          // Pass user (with token) to the callback
          return done(null, userWithToken);
        } catch (error) {
          console.error('Error in Google OAuth strategy:', error);
          return done(error as Error, undefined);
        }
      }
    )
  );
}
