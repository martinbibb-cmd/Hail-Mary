/**
 * Auth Service for Hail-Mary
 * 
 * Handles user authentication including:
 * - User registration with email/password
 * - Login with email/password
 * - JWT token generation and validation
 * - Password reset flow
 * 
 * Designed for future Salesforce SSO integration via auth_provider field.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/drizzle-client';
import { users, passwordResetTokens, accounts } from '../db/drizzle-schema';
import { eq, and, gt } from 'drizzle-orm';

// Types
export interface RegisterUserDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface UserPayload {
  id: number;
  email: string;
  name: string;
  accountId?: number;
  authProvider: string;
  role: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Password reset token expiry (1 hour)
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
function generateToken(user: UserPayload): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      accountId: user.accountId,
      authProvider: user.authProvider,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify and decode a JWT token
 */
function verifyToken(token: string): UserPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Generate a secure random token for password reset
 */
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Custom error class for authentication errors
export class AuthError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 401) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'AuthError';
  }
}

// Constant for invalid credentials error message
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';

// Helper to detect DB errors (like missing tables)
function isDatabaseError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      (message.includes('relation') && message.includes('does not exist')) ||
      (message.includes('table') && message.includes('does not exist')) ||
      message.includes('connection refused') ||
      message.includes('econnrefused') ||
      message.includes('getaddrinfo enotfound')
    );
  }
  return false;
}

/**
 * Register a new user with email and password
 */
export async function registerUser(dto: RegisterUserDto): Promise<{ user: UserPayload; token: string }> {
  // Validate input
  if (!dto.email || !dto.password || !dto.name) {
    throw new AuthError('validation_error', 'Name, email, and password are required', 400);
  }

  if (dto.password.length < 8) {
    throw new AuthError('validation_error', 'Password must be at least 8 characters', 400);
  }

  // Normalize email
  const normalizedEmail = dto.email.toLowerCase().trim();

  try {
    // Check if email already exists
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));

    if (existingUsers.length > 0) {
      throw new AuthError('email_exists', 'Email already registered', 409);
    }

    // Hash password
    const passwordHash = await hashPassword(dto.password);

    // Create or get default account
    let accountId: number | undefined;
    const existingAccounts = await db.select().from(accounts).limit(1);
    if (existingAccounts.length > 0) {
      accountId = existingAccounts[0].id;
    } else {
      const [newAccount] = await db
        .insert(accounts)
        .values({ name: 'Default Account' })
        .returning();
      accountId = newAccount.id;
    }

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        name: dto.name.trim(),
        passwordHash,
        authProvider: 'local',
        accountId,
        role: 'user',
      })
      .returning();

    const userPayload: UserPayload = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      accountId: newUser.accountId ?? undefined,
      authProvider: newUser.authProvider,
      role: newUser.role,
    };

    const token = generateToken(userPayload);

    return { user: userPayload, token };
  } catch (error) {
    // Re-throw AuthErrors as-is
    if (error instanceof AuthError) {
      throw error;
    }
    // Handle database errors (missing tables, connection issues)
    if (isDatabaseError(error)) {
      console.error('Database error during registration:', error);
      throw new AuthError('database_error', 'A database error occurred. Please try again later.', 500);
    }
    // Log unexpected errors and re-throw
    console.error('Unexpected error during registration:', error);
    throw new AuthError('internal_error', 'An unexpected error occurred.', 500);
  }
}

/**
 * Login a user with email and password
 */
export async function loginWithPassword(dto: LoginDto): Promise<{ user: UserPayload; token: string }> {
  if (!dto.email || !dto.password) {
    throw new AuthError('validation_error', 'Email and password are required', 400);
  }

  const normalizedEmail = dto.email.toLowerCase().trim();

  try {
    // Find user by email
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));

    if (foundUsers.length === 0) {
      throw new AuthError('invalid_credentials', INVALID_CREDENTIALS_MESSAGE, 401);
    }

    const user = foundUsers[0];

    // Check if this is a local auth user
    if (user.authProvider !== 'local') {
      throw new AuthError('invalid_credentials', 'Please use your SSO provider to login', 401);
    }

    // Verify password
    if (!user.passwordHash) {
      throw new AuthError('invalid_credentials', INVALID_CREDENTIALS_MESSAGE, 401);
    }

    const isValid = await verifyPassword(dto.password, user.passwordHash);
    if (!isValid) {
      throw new AuthError('invalid_credentials', INVALID_CREDENTIALS_MESSAGE, 401);
    }

    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      accountId: user.accountId ?? undefined,
      authProvider: user.authProvider,
      role: user.role,
    };

    const token = generateToken(userPayload);

    return { user: userPayload, token };
  } catch (error) {
    // Re-throw AuthErrors as-is
    if (error instanceof AuthError) {
      throw error;
    }
    // Handle database errors (missing tables, connection issues)
    if (isDatabaseError(error)) {
      console.error('Database error during login:', error);
      throw new AuthError('database_error', 'A database error occurred. Please try again later.', 500);
    }
    // Log unexpected errors and re-throw
    console.error('Unexpected error during login:', error);
    throw new AuthError('internal_error', 'An unexpected error occurred.', 500);
  }
}

/**
 * Get the current user from a JWT token
 */
export function getCurrentUserFromToken(token: string): UserPayload | null {
  return verifyToken(token);
}

/**
 * Start a password reset flow for an email address
 * Returns the reset token (in production this would be sent via email)
 */
export async function startPasswordReset(email: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // Find user by email
  const foundUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail));

  // Don't reveal if email exists or not (security)
  if (foundUsers.length === 0) {
    // Return null but don't indicate email doesn't exist
    return null;
  }

  const user = foundUsers[0];

  // Only allow password reset for local auth users
  if (user.authProvider !== 'local') {
    return null;
  }

  // Generate reset token
  const resetToken = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  // Store token in database
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token: resetToken,
    expiresAt,
  });

  return resetToken;
}

/**
 * Complete password reset with token and new password
 */
export async function completePasswordReset(dto: ResetPasswordDto): Promise<boolean> {
  if (!dto.token || !dto.newPassword) {
    throw new Error('Token and new password are required');
  }

  if (dto.newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const now = new Date();

  // Find valid token (not expired, not used)
  const foundTokens = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, dto.token),
        gt(passwordResetTokens.expiresAt, now)
      )
    );

  // Check if token exists and is not used
  const validToken = foundTokens.find(t => t.usedAt === null);
  if (!validToken) {
    throw new Error('Invalid or expired reset token');
  }

  // Hash new password
  const passwordHash = await hashPassword(dto.newPassword);

  // Update user password
  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: now,
    })
    .where(eq(users.id, validToken.userId));

  // Mark token as used
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, validToken.id));

  return true;
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<UserPayload | null> {
  const foundUsers = await db
    .select()
    .from(users)
    .where(eq(users.id, id));

  if (foundUsers.length === 0) {
    return null;
  }

  const user = foundUsers[0];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountId: user.accountId ?? undefined,
    authProvider: user.authProvider,
    role: user.role,
  };
}

/**
 * Google OAuth profile data
 */
export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * Find or create user from Google OAuth profile
 * Returns user payload and JWT token
 */
export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<{ user: UserPayload; token: string }> {
  const normalizedEmail = profile.email.toLowerCase().trim();

  try {
    // Check if user already exists
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));

    if (existingUsers.length > 0) {
      const user = existingUsers[0];

      // If user exists with local auth, update to google
      if (user.authProvider === 'local') {
        await db
          .update(users)
          .set({
            authProvider: 'google',
            externalId: profile.id,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
      }

      const userPayload: UserPayload = {
        id: user.id,
        email: user.email,
        name: user.name,
        accountId: user.accountId ?? undefined,
        authProvider: 'google',
        role: user.role,
      };

      const token = generateToken(userPayload);
      return { user: userPayload, token };
    }

    // Create or get default account
    let accountId: number | undefined;
    const existingAccounts = await db.select().from(accounts).limit(1);
    if (existingAccounts.length > 0) {
      accountId = existingAccounts[0].id;
    } else {
      const [newAccount] = await db
        .insert(accounts)
        .values({ name: 'Default Account' })
        .returning();
      accountId = newAccount.id;
    }

    // Create new user with Google auth
    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        name: profile.name,
        authProvider: 'google',
        externalId: profile.id,
        accountId,
        role: 'user',
        passwordHash: null, // No password for OAuth users
      })
      .returning();

    const userPayload: UserPayload = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      accountId: newUser.accountId ?? undefined,
      authProvider: newUser.authProvider,
      role: newUser.role,
    };

    const token = generateToken(userPayload);
    return { user: userPayload, token };
  } catch (error) {
    console.error('Error in Google OAuth user creation:', error);
    throw new AuthError('oauth_error', 'Failed to authenticate with Google', 500);
  }
}
