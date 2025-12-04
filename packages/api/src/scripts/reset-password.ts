#!/usr/bin/env ts-node
/**
 * Admin CLI Script: Reset User Password
 * 
 * Usage:
 *   npx ts-node src/scripts/reset-password.ts <email> <new-password>
 *   npm run admin:reset-password -- <email> <new-password>
 * 
 * Docker usage:
 *   docker exec -it hailmary-api npm run admin:reset-password -- admin@example.com newpassword123
 * 
 * This script allows administrators to manually reset a user's password
 * from the command line, useful for NAS deployments where email is not configured.
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/drizzle-client';
import { users } from '../db/drizzle-schema';
import { hashPassword } from '../services/auth.service';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║           Hail-Mary Admin: Password Reset Tool                      ║
╚════════════════════════════════════════════════════════════════════╝

Usage: npx ts-node src/scripts/reset-password.ts <email> <new-password>

Arguments:
  email         User's email address
  new-password  New password (minimum 8 characters)

Examples:
  npx ts-node src/scripts/reset-password.ts admin@example.com MyNewP@ss123
  npm run admin:reset-password -- admin@example.com MyNewP@ss123

Docker:
  docker exec -it hailmary-api npm run admin:reset-password -- admin@example.com MyNewP@ss123
`);
    await pool.end();
    process.exit(1);
  }

  const [email, newPassword] = args;
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedPassword = newPassword.trim();

  // Validate password is not empty after trimming
  if (!trimmedPassword || trimmedPassword.length === 0) {
    console.error('❌ Error: Password cannot be empty or contain only whitespace.');
    await pool.end();
    process.exit(1);
  }

  // Validate password length
  if (trimmedPassword.length < 8) {
    console.error('❌ Error: Password must be at least 8 characters long.');
    await pool.end();
    process.exit(1);
  }

  try {
    console.log(`\n🔐 Resetting password for: ${normalizedEmail}`);

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      console.error(`❌ Error: No user found with email: ${normalizedEmail}`);
      await pool.end();
      process.exit(1);
    }

    // Check if this is a local auth user
    if (user.authProvider !== 'local') {
      console.error(`❌ Error: User ${normalizedEmail} uses SSO (${user.authProvider}). Cannot reset password.`);
      await pool.end();
      process.exit(1);
    }

    // Hash the new password
    const passwordHash = await hashPassword(trimmedPassword);

    // Update user's password
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    console.log(`✅ Password successfully reset for: ${user.name} (${normalizedEmail})`);
    console.log('   The user can now log in with the new password.');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
