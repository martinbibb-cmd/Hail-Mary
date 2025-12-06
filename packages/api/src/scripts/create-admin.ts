#!/usr/bin/env ts-node
/**
 * Admin CLI Script: Create Admin User
 * 
 * Usage:
 *   npx ts-node src/scripts/create-admin.ts <email> <password> [name]
 *   npm run admin:create -- <email> <password> [name]
 * 
 * Docker usage:
 *   docker exec -it hailmary-api npm run admin:create -- admin@example.com password123 "Admin User"
 * 
 * This script creates a new admin user in the system.
 * Useful for NAS deployments where you need to bootstrap an admin account.
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/drizzle-client';
import { users, accounts } from '../db/drizzle-schema';
import { hashPassword } from '../services/auth.service';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║           Hail-Mary Admin: Create Admin User                        ║
╚════════════════════════════════════════════════════════════════════╝

Usage: npx ts-node src/scripts/create-admin.ts <email> <password> [name]

Arguments:
  email         Admin's email address
  password      Password (minimum 8 characters)
  name          Display name (optional, defaults to "Admin")

Examples:
  npx ts-node src/scripts/create-admin.ts admin@example.com MySecureP@ss123
  npx ts-node src/scripts/create-admin.ts admin@example.com MySecureP@ss123 "John Admin"
  npm run admin:create -- admin@example.com MySecureP@ss123

Docker:
  docker exec -it hailmary-api npm run admin:create -- admin@example.com MySecureP@ss123 "Admin User"
`);
    await pool.end();
    process.exit(1);
  }

  const [email, password, name = 'Admin'] = args;
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedPassword = password.trim();
  const trimmedName = name.trim();

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
    console.log(`\n🔐 Creating admin user: ${normalizedEmail}`);

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      console.error(`❌ Error: A user with email ${normalizedEmail} already exists.`);
      console.log('   Use admin:reset-password to update their password instead.');
      await pool.end();
      process.exit(1);
    }

    // Get or create account
    let accountId: number;
    const [existingAccount] = await db.select().from(accounts).limit(1);
    
    if (existingAccount) {
      accountId = existingAccount.id;
    } else {
      const [newAccount] = await db
        .insert(accounts)
        .values({ name: 'Default Account' })
        .returning();
      accountId = newAccount.id;
      console.log(`   Created new account: Default Account (id: ${accountId})`);
    }

    // Hash the password
    const passwordHash = await hashPassword(trimmedPassword);

    // Create the admin user
    const [newUser] = await db.insert(users).values({
      accountId,
      email: normalizedEmail,
      name: trimmedName,
      passwordHash,
      authProvider: 'local',
      role: 'admin',
    }).returning();

    console.log(`✅ Admin user created successfully!`);
    console.log(`   ID:    ${newUser.id}`);
    console.log(`   Email: ${newUser.email}`);
    console.log(`   Name:  ${newUser.name}`);
    console.log(`   Role:  ${newUser.role}`);
    console.log(`\n   The user can now log in with the provided email and password.`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
