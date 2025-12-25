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
import { sendPasswordResetEmail } from './email.service';

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
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

// JWT configuration
// SECURITY: JWT_SECRET must be set and must not use the default value
// This prevents token forgery attacks where attackers could generate valid tokens
const JWT_SECRET_ENV = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

// Password configuration
const MIN_PASSWORD_LENGTH = 8;

// Validate JWT_SECRET on module load (before any auth operations)
if (!JWT_SECRET_ENV || JWT_SECRET_ENV === 'development-secret-change-in-production') {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('🔴 FATAL SECURITY ERROR: JWT_SECRET is not configured correctly!');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  console.error('JWT_SECRET must be set in your environment and must NOT use the default value.');
  console.error('');
  console.error('To fix this:');
  console.error('  1. Generate a secure secret:');
  console.error('     node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.error('');
  console.error('  2. Set it in your .env file:');
  console.error('     JWT_SECRET=your-generated-secret-here');
  console.error('');
  console.error('  3. Or set it in docker-compose environment:');
  console.error('     JWT_SECRET=your-generated-secret-here');
  console.error('');
  console.error('Without a secure JWT_SECRET, attackers can forge authentication tokens');
  console.error('and gain unauthorized access to the system, including admin accounts.');
  console.error('');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  throw new Error('FATAL: JWT_SECRET must be set and not use default value. See error above for instructions.');
}

// After validation, JWT_SECRET is guaranteed to be a non-empty string
const JWT_SECRET: string = JWT_SECRET_ENV;

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

  if (dto.password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError('validation_error', `Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
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
 * Sends a password reset email with a secure link
 * @param email - The email address to send the reset link to
 * @param baseUrl - The base URL for constructing the reset link
 * @returns Promise<boolean> - Always returns true to not reveal if email exists
 */
export async function startPasswordReset(email: string, baseUrl: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  // Find user by email
  const foundUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail));

  // Don't reveal if email exists or not (security)
  if (foundUsers.length === 0) {
    // Return true but don't send email
    return true;
  }

  const user = foundUsers[0];

  // Only allow password reset for local auth users
  if (user.authProvider !== 'local') {
    return true;
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

  // Construct reset URL
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  // Send password reset email
  try {
    const emailSent = await sendPasswordResetEmail(normalizedEmail, resetUrl);
    if (!emailSent) {
      console.error('Failed to send password reset email, falling back to console log');
      // Fallback: log to console if email sending fails
      console.log('\n=== PASSWORD RESET ===');
      console.log(`Reset requested for: ${normalizedEmail}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log('======================\n');
    }
  } catch (error) {
    console.error('Error sending password reset email:', error);
    // Fallback: log to console
    console.log('\n=== PASSWORD RESET (FALLBACK) ===');
    console.log(`Reset requested for: ${normalizedEmail}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('==================================\n');
  }

  // Always return true to not reveal if email exists
  return true;
}

/**
 * Complete password reset with token and new password
 */
export async function completePasswordReset(dto: ResetPasswordDto): Promise<boolean> {
  if (!dto.token || !dto.newPassword) {
    throw new Error('Token and new password are required');
  }

  if (dto.newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
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

// ============================================
// Admin Functions
// ============================================

/**
 * List all users (admin only)
 */
export async function listAllUsers(): Promise<UserPayload[]> {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        accountId: users.accountId,
        authProvider: users.authProvider,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(users.name);

    return allUsers.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      accountId: user.accountId ?? undefined,
      authProvider: user.authProvider,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  } catch (error) {
    if (isDatabaseError(error)) {
      console.error('Database error listing users:', error);
      throw new AuthError('database_error', 'A database error occurred.', 500);
    }
    console.error('Unexpected error listing users:', error);
    throw new AuthError('internal_error', 'An unexpected error occurred.', 500);
  }
}

/**
 * Reset a user's password (admin only)
 * @param userId - The ID of the user whose password to reset
 * @param newPassword - The new password
 */
export async function adminResetUserPassword(userId: number, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError('validation_error', `Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
  }

  try {
    // Find user by ID
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (foundUsers.length === 0) {
      throw new AuthError('not_found', 'User not found', 404);
    }

    const user = foundUsers[0];

    // Check if this is a local auth user
    if (user.authProvider !== 'local') {
      throw new AuthError(
        'invalid_operation',
        `Cannot reset password for ${user.authProvider} users. They must use their SSO provider.`,
        400
      );
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // Update user's password
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    console.log(`[Admin] Password reset for user ${user.email} (ID: ${userId})`);
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    if (isDatabaseError(error)) {
      console.error('Database error during password reset:', error);
      throw new AuthError('database_error', 'A database error occurred.', 500);
    }
    console.error('Unexpected error during password reset:', error);
    throw new AuthError('internal_error', 'An unexpected error occurred.', 500);
  }
}

/**
 * Generate a password reset token for a user (admin only)
 * @param userId - The ID of the user
 * @param adminId - The ID of the admin generating the token
 * @param baseUrl - Base URL for constructing the reset link
 * @returns Object with token and resetLink
 */
export async function adminGenerateResetToken(
  userId: number, 
  adminId: number, 
  baseUrl: string
): Promise<{ token: string; resetLink: string }> {
  try {
    // Find user by ID
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (foundUsers.length === 0) {
      throw new AuthError('not_found', 'User not found', 404);
    }

    const user = foundUsers[0];

    // Check if this is a local auth user
    if (user.authProvider !== 'local') {
      throw new AuthError(
        'invalid_operation',
        `Cannot generate reset token for ${user.authProvider} users. They must use their SSO provider.`,
        400
      );
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

    // Construct reset URL
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    // Log the action for audit trail
    console.log(`[Admin] Password reset token generated for user ${user.email} (ID: ${userId}) by admin ID: ${adminId}`);

    return { token: resetToken, resetLink };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    if (isDatabaseError(error)) {
      console.error('Database error generating reset token:', error);
      throw new AuthError('database_error', 'A database error occurred.', 500);
    }
    console.error('Unexpected error generating reset token:', error);
    throw new AuthError('internal_error', 'An unexpected error occurred.', 500);
  }
}

/**
 * Update a user's role (admin only)
 * @param userId - The ID of the user whose role to update
 * @param newRole - The new role ('user' | 'admin')
 * @param adminId - The ID of the admin performing the action
 */
export async function updateUserRole(userId: number, newRole: string, adminId: number): Promise<UserPayload> {
  // Validate role
  if (newRole !== 'user' && newRole !== 'admin') {
    throw new AuthError('validation_error', 'Role must be either "user" or "admin"', 400);
  }

  try {
    // Find user by ID
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (foundUsers.length === 0) {
      throw new AuthError('not_found', 'User not found', 404);
    }

    const user = foundUsers[0];

    // Update user's role
    const updated = await db
      .update(users)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (updated.length === 0) {
      throw new AuthError('internal_error', 'Failed to update user role', 500);
    }

    const updatedUser = updated[0];

    // Log the action for audit trail
    console.log(`[Admin] User ${user.email} (ID: ${userId}) role changed from "${user.role}" to "${newRole}" by admin ID: ${adminId}`);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      accountId: updatedUser.accountId ?? undefined,
      authProvider: updatedUser.authProvider,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    if (isDatabaseError(error)) {
      console.error('Database error updating user role:', error);
      throw new AuthError('database_error', 'A database error occurred.', 500);
    }
    console.error('Unexpected error updating user role:', error);
    throw new AuthError('internal_error', 'An unexpected error occurred.', 500);
  }
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

// ============================================
// NAS Storage User Selection (Temporary Fix)
// ============================================

/**
 * IP range checking for NAS authentication
 * Restricts NAS auth to local/private networks only
 */
interface IPRange {
  network: string;
  cidr: number;
}

function parseIPv4(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isIPv4InRange(ip: string, range: IPRange): boolean {
  const ipNum = parseIPv4(ip);
  const networkNum = parseIPv4(range.network);
  const mask = (0xFFFFFFFF << (32 - range.cidr)) >>> 0;
  return (ipNum & mask) === (networkNum & mask);
}

function isIPAllowedForNasAuth(clientIp: string): boolean {
  // Default allowed networks: localhost + RFC1918 private networks
  const allowedRanges: IPRange[] = [
    { network: '127.0.0.0', cidr: 8 },      // Localhost
    { network: '10.0.0.0', cidr: 8 },       // Private A
    { network: '172.16.0.0', cidr: 12 },    // Private B
    { network: '192.168.0.0', cidr: 16 },   // Private C
  ];

  // Support custom allowed IPs from environment (comma-separated CIDR notation)
  // Example: NAS_ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8
  const customAllowed = process.env.NAS_ALLOWED_IPS;
  if (customAllowed) {
    const customRanges = customAllowed.split(',').map(range => {
      const [network, cidr] = range.trim().split('/');
      return { network, cidr: parseInt(cidr || '32', 10) };
    });
    allowedRanges.push(...customRanges);
  }

  // Check if IP is IPv6 localhost
  if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
    return true;
  }

  // Extract IPv4 if it's wrapped in IPv6 (::ffff:192.168.1.1)
  let ipToCheck = clientIp;
  if (clientIp.startsWith('::ffff:')) {
    ipToCheck = clientIp.substring(7);
  }

  // Check against all allowed ranges
  return allowedRanges.some(range => isIPv4InRange(ipToCheck, range));
}

/**
 * List all users for NAS quick login
 * This is a TEMPORARY solution until proper authentication is established.
 * @security WARNING: This should be disabled in production!
 *
 * @param clientIp - The IP address of the requesting client
 */
export async function listUsersForNasLogin(clientIp: string): Promise<UserPayload[]> {
  // Check if NAS mode is enabled
  if (process.env.NAS_AUTH_MODE !== 'true') {
    throw new AuthError('unauthorized', 'NAS authentication is not enabled', 403);
  }

  // SECURITY: Restrict to local/private networks only
  if (!isIPAllowedForNasAuth(clientIp)) {
    console.warn(`[NAS Auth] SECURITY: User list request blocked from non-local IP: ${clientIp}`);
    throw new AuthError(
      'forbidden',
      'NAS authentication is only available from local network',
      403
    );
  }

  console.log(`[NAS Auth] User list requested from allowed IP: ${clientIp}`);
  try {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        accountId: users.accountId,
        authProvider: users.authProvider,
        role: users.role,
      })
      .from(users)
      .orderBy(users.name);

    return allUsers.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      accountId: user.accountId ?? undefined,
      authProvider: user.authProvider,
      role: user.role,
    }));
  } catch (error) {
    if (isDatabaseError(error)) {
      console.error('Database error listing users:', error);
      throw new AuthError('database_error', 'A database error occurred.', 500);
    }
    console.error('Unexpected error listing users:', error);
    throw new AuthError('internal_error', 'An unexpected error occurred.', 500);
  }
}

/**
 * Quick login as a user without password (NAS mode)
 * This is a TEMPORARY solution until proper authentication is established.
 *
 * @security WARNING: This should only be enabled on trusted local networks!
 *
 * Security considerations:
 * - Only enable via NAS_AUTH_MODE=true on trusted networks
 * - IP-based restrictions limit access to local/private networks
 * - Tokens are short-lived (same as regular auth: 24h)
 * - All access is logged for audit purposes
 *
 * @param userId - The user ID to login as
 * @param clientIp - The IP address of the requesting client
 */
export async function nasQuickLogin(userId: number, clientIp: string): Promise<{ user: UserPayload; token: string }> {
  // Check if NAS mode is enabled
  if (process.env.NAS_AUTH_MODE !== 'true') {
    throw new AuthError('unauthorized', 'NAS quick login is not enabled', 403);
  }

  // SECURITY: Restrict to local/private networks only
  if (!isIPAllowedForNasAuth(clientIp)) {
    console.warn(`[NAS Auth] SECURITY: Login attempt blocked from non-local IP: ${clientIp} for userId: ${userId}`);
    throw new AuthError(
      'forbidden',
      'NAS authentication is only available from local network',
      403
    );
  }

  // Log NAS login attempt for security audit
  console.log(`[NAS Auth] Quick login attempt for userId: ${userId} from allowed IP: ${clientIp} at ${new Date().toISOString()}`);

  try {
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (foundUsers.length === 0) {
      console.warn(`[NAS Auth] Failed - user ${userId} not found`);
      throw new AuthError('not_found', 'User not found', 404);
    }

    const user = foundUsers[0];
    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      accountId: user.accountId ?? undefined,
      authProvider: user.authProvider,
      role: user.role,
    };

    const token = generateToken(userPayload);
    
    console.log(`[NAS Auth] Successful login for user: ${user.email}`);
    return { user: userPayload, token };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    if (isDatabaseError(error)) {
      console.error('Database error during NAS login:', error);
      throw new AuthError('database_error', 'A database error occurred.', 500);
    }
    console.error('Unexpected error during NAS login:', error);
    throw new AuthError('internal_error', 'An unexpected error occurred.', 500);
  }
}

/**
 * Login as guest user (read-only access, no customer data)
 * Finds the guest user with role='guest' and logs them in
 */
export async function loginAsGuest(): Promise<{ user: UserPayload; token: string }> {
  try {
    // Find guest user by role
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'guest'))
      .limit(1);

    if (foundUsers.length === 0) {
      throw new AuthError(
        'guest_not_configured', 
        'Guest login is not available. Please contact administrator.',
        503
      );
    }

    const user = foundUsers[0];

    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      accountId: user.accountId ?? undefined,
      authProvider: user.authProvider,
      role: user.role,
    };

    const token = generateToken(userPayload);
    
    // Note: Reduced logging for guest logins to avoid log clutter
    return { user: userPayload, token };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    if (isDatabaseError(error)) {
      console.error('Database error during guest login:', error);
      throw new AuthError('database_error', 'A database error occurred.', 500);
    }
    console.error('Unexpected error during guest login:', error);
    throw new AuthError('internal_error', 'An unexpected error occurred.', 500);
  }
}
