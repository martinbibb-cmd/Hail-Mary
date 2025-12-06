/**
 * Database Seed Script
 *
 * Seeds the database with:
 * - At least one account
 * - At least one customer (for testing)
 * - An initial admin user (if INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are set)
 * 
 * This script is idempotent - it will not create duplicates if run multiple times.
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./drizzle-client";
import { accounts, customers, users } from "./drizzle-schema";
import { hashPassword } from "../services/auth.service";

async function main() {
  console.log("Starting database seed...");

  // 1. Ensure there is at least one account
  const [existingAccount] = await db.select().from(accounts).limit(1);

  let accountId: number;
  if (existingAccount) {
    accountId = existingAccount.id;
    console.log(`Using existing account: ${existingAccount.name} (id: ${accountId})`);
  } else {
    const [insertedAccount] = await db
      .insert(accounts)
      .values({ name: "Test Account" })
      .returning();
    accountId = insertedAccount.id;
    console.log(`Seeded Test Account (id: ${accountId})`);
  }

  // 2. Ensure there is at least one customer for this account
  const [existingCustomer] = await db
    .select()
    .from(customers)
    .where(eq(customers.accountId, accountId))
    .limit(1);

  if (!existingCustomer) {
    const [insertedCustomer] = await db.insert(customers).values({
      accountId,
      firstName: "Test",
      lastName: "Customer",
      email: "test@example.com",
      phone: "00000000000",
      addressLine1: "1 Test Street",
      city: "Testville",
      postcode: "TE57 1NG",
      country: "UK",
    }).returning();
    console.log(`Seeded Test Customer (id: ${insertedCustomer.id})`);
  } else {
    console.log(`Customer already exists for account ${accountId}: ${existingCustomer.firstName} ${existingCustomer.lastName} (id: ${existingCustomer.id}), no seed needed`);
  }

  // 3. Create initial admin user if env vars are set
  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const initialAdminName = process.env.INITIAL_ADMIN_NAME || "Admin";

  if (initialAdminEmail && initialAdminPassword) {
    const normalizedEmail = initialAdminEmail.toLowerCase().trim();
    
    // Check if user with this email already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!existingUser) {
      // Check password length
      if (initialAdminPassword.length < 8) {
        console.warn("INITIAL_ADMIN_PASSWORD must be at least 8 characters. Skipping admin user creation.");
      } else {
        const passwordHash = await hashPassword(initialAdminPassword);
        
        const [insertedUser] = await db.insert(users).values({
          accountId,
          email: normalizedEmail,
          name: initialAdminName,
          passwordHash,
          authProvider: "local",
          role: "admin",
        }).returning();
        
        console.log(`✅ Created initial admin user: ${normalizedEmail} (id: ${insertedUser.id})`);
      }
    } else {
      console.log(`Admin user already exists: ${normalizedEmail} (id: ${existingUser.id}), no seed needed`);
    }
  } else {
    // Check if there are any users at all
    const [anyUser] = await db.select().from(users).limit(1);
    if (!anyUser) {
      console.log("ℹ️  No INITIAL_ADMIN_EMAIL/INITIAL_ADMIN_PASSWORD set. No admin user created.");
      console.log("   You can create an account using:");
      console.log("   - The signup flow");
      console.log("   - npm run admin:create -- <email> <password> [name]");
      console.log("   - Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD env vars");
    }
  }

  console.log("Seed completed successfully!");

  // Properly close the connection pool
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
