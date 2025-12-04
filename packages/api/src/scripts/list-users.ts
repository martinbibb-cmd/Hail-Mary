#!/usr/bin/env ts-node
/**
 * Admin CLI Script: List All Users
 * 
 * Usage:
 *   npx ts-node src/scripts/list-users.ts
 *   npm run admin:list-users
 * 
 * Docker usage:
 *   docker exec -it hailmary-api npm run admin:list-users
 * 
 * This script lists all registered users in the system,
 * useful for NAS deployments to see who has accounts.
 */

import 'dotenv/config';
import { db, pool } from '../db/drizzle-client';
import { users } from '../db/drizzle-schema';

async function main() {
  try {
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║           Hail-Mary Admin: User List                                ║
╚════════════════════════════════════════════════════════════════════╝
`);

    // Get all users
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        authProvider: users.authProvider,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.id);

    if (allUsers.length === 0) {
      console.log('📭 No users found in the database.\n');
      console.log('To create an initial admin user, set these environment variables:');
      console.log('  INITIAL_ADMIN_EMAIL=admin@example.com');
      console.log('  INITIAL_ADMIN_PASSWORD=yourpassword');
      console.log('\nThen run: npm run db:seed');
    } else {
      console.log(`Found ${allUsers.length} user(s):\n`);
      console.log('┌────────┬────────────────────────────┬────────────────────────────────────┬────────────┬────────┐');
      console.log('│   ID   │           Name             │               Email                │  Provider  │  Role  │');
      console.log('├────────┼────────────────────────────┼────────────────────────────────────┼────────────┼────────┤');
      
      for (const user of allUsers) {
        const id = String(user.id).padStart(6, ' ');
        const name = user.name.substring(0, 24).padEnd(26, ' ');
        const email = user.email.substring(0, 32).padEnd(34, ' ');
        const provider = user.authProvider.padEnd(10, ' ');
        const role = user.role.padEnd(6, ' ');
        console.log(`│ ${id} │ ${name} │ ${email} │ ${provider} │ ${role} │`);
      }
      
      console.log('└────────┴────────────────────────────┴────────────────────────────────────┴────────────┴────────┘\n');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error listing users:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
