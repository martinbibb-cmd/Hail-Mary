/**
 * Database Seed Script
 *
 * Seeds the database with at least one account and one customer
 * to allow testing of the visit backbone.
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./drizzle-client";
import { accounts, customers } from "./drizzle-schema";

async function main() {
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
      name: "Test Customer",
      email: "test@example.com",
      phone: "00000000000",
      addressLine1: "1 Test Street",
      town: "Testville",
      postcode: "TE57 1NG",
    }).returning();
    console.log(`Seeded Test Customer (id: ${insertedCustomer.id})`);
  } else {
    console.log(`Customer already exists for account ${accountId}: ${existingCustomer.name} (id: ${existingCustomer.id}), no seed needed`);
  }

  // Properly close the connection pool
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
