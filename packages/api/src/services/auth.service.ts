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
async function hashPassword(password: string): Promise<string> {
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

/**
 * Register a new user with email and password
 */
export async function registerUser(dto: RegisterUserDto): Promise<{ user: UserPayload; token: string }> {
  // Validate input
  if (!dto.email || !dto.password || !dto.name) {
    throw new Error('Name, email, and password are required');
  }

  if (dto.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Normalize email
  const normalizedEmail = dto.email.toLowerCase().trim();

  // Check if email already exists
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail));

  if (existingUsers.length > 0) {
    throw new Error('Email already registered');
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
  };

  const token = generateToken(userPayload);

  return { user: userPayload, token };
}

/**
 * Login a user with email and password
 */
export async function loginWithPassword(dto: LoginDto): Promise<{ user: UserPayload; token: string }> {
  if (!dto.email || !dto.password) {
    throw new Error('Email and password are required');
  }

  const normalizedEmail = dto.email.toLowerCase().trim();

  // Find user by email
  const foundUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail));

  if (foundUsers.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = foundUsers[0];

  // Check if this is a local auth user
  if (user.authProvider !== 'local') {
    throw new Error('Please use your SSO provider to login');
  }

  // Verify password
  if (!user.passwordHash) {
    throw new Error('Invalid email or password');
  }

  const isValid = await verifyPassword(dto.password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  const userPayload: UserPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    accountId: user.accountId ?? undefined,
    authProvider: user.authProvider,
  };

  const token = generateToken(userPayload);

  return { user: userPayload, token };
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
  };
}
