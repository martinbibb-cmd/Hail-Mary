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
import { accounts, customers, users, products } from "./drizzle-schema";
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

  // 3. Seed sample boiler products if none exist
  const [existingProduct] = await db
    .select()
    .from(products)
    .where(eq(products.accountId, accountId))
    .limit(1);

  if (!existingProduct) {
    console.log("Seeding sample boiler products...");

    const sampleProducts = [
      // Combi Boilers
      {
        accountId,
        sku: "VIESSMANN-VITODENS-100W-26KW",
        name: "Viessmann Vitodens 100-W 26kW Combi Boiler",
        description: "Compact wall-hung gas condensing combi boiler. Ideal for small to medium homes. Energy efficiency rating: A.",
        basePrice: "1250.00",
        isActive: true,
      },
      {
        accountId,
        sku: "VAILLANT-ECOTEC-PLUS-832",
        name: "Vaillant ecoTEC Plus 832 Combi Boiler",
        description: "High-efficiency combi boiler with 32kW output. Perfect for medium to large homes with high hot water demand.",
        basePrice: "1450.00",
        isActive: true,
      },
      {
        accountId,
        sku: "WORCESTER-GREENSTAR-4000-30KW",
        name: "Worcester Bosch Greenstar 4000 30kW Combi",
        description: "Premium combi boiler with excellent reliability. Includes 10-year warranty. Energy efficiency: A rated.",
        basePrice: "1650.00",
        isActive: true,
      },

      // System Boilers
      {
        accountId,
        sku: "BAXI-800-SYSTEM-18KW",
        name: "Baxi 800 18kW System Boiler",
        description: "Compact system boiler for properties with separate hot water cylinder. Suitable for homes with 1-2 bathrooms.",
        basePrice: "1100.00",
        isActive: true,
      },
      {
        accountId,
        sku: "IDEAL-LOGIC-PLUS-SYSTEM-24KW",
        name: "Ideal Logic Plus System 24kW Boiler",
        description: "Reliable system boiler with simple controls. Good choice for medium-sized properties with existing cylinder.",
        basePrice: "1200.00",
        isActive: true,
      },

      // Hot Water Cylinders
      {
        accountId,
        sku: "MEGAFLO-ECO-170L",
        name: "Heatrae Sadia Megaflo Eco 170L Unvented Cylinder",
        description: "Stainless steel unvented hot water cylinder. Suitable for 2-3 bathroom properties. Excellent insulation.",
        basePrice: "850.00",
        isActive: true,
      },
      {
        accountId,
        sku: "GLEDHILL-TORRENT-210L",
        name: "Gledhill Torrent 210L Indirect Cylinder",
        description: "High-performance indirect cylinder with rapid recovery. Ideal for large family homes.",
        basePrice: "750.00",
        isActive: true,
      },

      // Controls & Accessories
      {
        accountId,
        sku: "NEST-LEARNING-THERMOSTAT",
        name: "Nest Learning Thermostat (3rd Gen)",
        description: "Smart thermostat that learns your schedule. Control heating from anywhere via smartphone app.",
        basePrice: "220.00",
        isActive: true,
      },
      {
        accountId,
        sku: "HONEYWELL-EVOHOME-SYSTEM",
        name: "Honeywell evohome Connected Multi-Zone Kit",
        description: "Complete multi-zone heating control system. Control up to 12 zones independently.",
        basePrice: "380.00",
        isActive: true,
      },
      {
        accountId,
        sku: "FERNOX-F1-PROTECTOR",
        name: "Fernox F1 Central Heating Protector 5L",
        description: "System protector inhibitor. Prevents corrosion, limescale, and sludge in heating systems.",
        basePrice: "35.00",
        isActive: true,
      },
      {
        accountId,
        sku: "ADEY-MAGNACLEAN-PRO2",
        name: "Adey MagnaClean Professional2 Magnetic Filter",
        description: "Market-leading magnetic filter. Removes black iron oxide sludge to protect heating system.",
        basePrice: "125.00",
        isActive: true,
      },

      // Installation & Labour
      {
        accountId,
        sku: "INSTALL-COMBI-SWAP",
        name: "Combi Boiler Installation (Like-for-Like Swap)",
        description: "Standard installation labour for replacing existing combi boiler with new combi. Includes removal and disposal of old boiler.",
        basePrice: "800.00",
        isActive: true,
      },
      {
        accountId,
        sku: "INSTALL-SYSTEM-TO-COMBI",
        name: "System to Combi Conversion Installation",
        description: "Labour for converting from system boiler to combi. Includes cylinder removal, pipework modifications, and system flush.",
        basePrice: "1400.00",
        isActive: true,
      },
      {
        accountId,
        sku: "POWERFLUSH-FULL",
        name: "Full System Powerflush",
        description: "Complete powerflush of central heating system. Removes sludge and debris, improves efficiency.",
        basePrice: "450.00",
        isActive: true,
      },
    ];

    await db.insert(products).values(sampleProducts);
    console.log(`✅ Seeded ${sampleProducts.length} sample boiler products`);
  } else {
    console.log(`Products already exist for account ${accountId}, skipping product seed`);
  }

  // 4. Create initial admin user if env vars are set
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
      // User exists - reset password if this is a local auth user
      if (existingUser.authProvider === "local") {
        // Check password length
        if (initialAdminPassword.length < 8) {
          console.warn("INITIAL_ADMIN_PASSWORD must be at least 8 characters. Skipping password reset.");
        } else {
          const passwordHash = await hashPassword(initialAdminPassword);
          
          await db
            .update(users)
            .set({
              passwordHash,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id));
          
          console.log(`✅ Reset password for admin user: ${normalizedEmail} (id: ${existingUser.id})`);
        }
      } else {
        console.log(`Admin user already exists: ${normalizedEmail} (id: ${existingUser.id}), uses ${existingUser.authProvider} auth`);
      }
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
