/**
 * Trajectory Engine - UK Assumptions Seed Data
 *
 * Seeds placeholder assumptions snapshot for UK-GB region
 * Replace with real data from official sources or admin-entered values
 */

import { db } from "../drizzle-client";
import { assumptionsSnapshots } from "../drizzle-schema";
import { eq } from "drizzle-orm";

export async function seedUKAssumptions() {
  console.log("🌱 Seeding UK trajectory assumptions...");

  try {
    // Check if we already have UK assumptions for 2026
    const existing = await db
      .select()
      .from(assumptionsSnapshots)
      .where(eq(assumptionsSnapshots.regionCode, "UK-GB"))
      .limit(1);

    if (existing.length > 0) {
      console.log("✅ UK assumptions already seeded, skipping");
      return;
    }

    // Placeholder UK assumptions for 2026
    // Based on approximate 2025/2026 estimates - REPLACE WITH REAL DATA
    const ukAssumptions = {
      regionCode: "UK-GB",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-12-31"),

      // Electricity prices (pence per kWh)
      // Typical domestic tariff ~28-32p/kWh in 2025
      electricityUnitPPerKwh: "30.00",

      // Off-peak electricity (e.g. Economy 7, Octopus Go)
      // Typically ~15-20p/kWh
      electricityOffpeakPPerKwh: "18.00",

      // Gas prices (pence per kWh)
      // Typical ~7-8p/kWh in 2025
      gasUnitPPerKwh: "7.50",

      // Standing charges (pence per day)
      elecStandingChargePPerDay: "55.00",
      gasStandingChargePPerDay: "30.00",

      // Grid carbon intensity (gCO2e per kWh)
      // UK grid ~150-180 gCO2e/kWh in 2025, declining to ~100-120 by 2030
      gridIntensityGco2ePerKwh: "160.00",

      // Gas carbon intensity (gCO2e per kWh)
      // Natural gas ~204 gCO2e/kWh (relatively constant)
      gasIntensityGco2ePerKwh: "204.00",

      // Policy flags
      policyFlags: {
        BUS_available: true,
        BUS_grant_gbp: 7500,
        BUS_max_gbp: 7500,
        vat_relief: true, // VAT relief on energy-saving materials
        vat_rate: 0.0, // 0% VAT on qualifying installations
        ECO4_available: true,
        notes: "Boiler Upgrade Scheme (BUS) provides £7,500 grant for heat pumps. ECO4 scheme provides additional support for eligible households.",
      },

      // Source metadata
      sourceMeta: {
        source: "placeholder",
        note: "PLACEHOLDER DATA - Replace with admin-entered or automated feed from official sources",
        disclaimer: "These are estimated values for demonstration purposes. Actual energy prices and grid intensity vary by region, supplier, and time of day.",
        suggested_sources: [
          "Ofgem Price Cap announcements",
          "National Grid ESO Carbon Intensity API",
          "BEIS/DESNZ energy statistics",
          "Energy Saving Trust",
        ],
        last_updated: new Date().toISOString(),
      },
    };

    // Insert seed data
    await db.insert(assumptionsSnapshots).values(ukAssumptions);

    console.log("✅ UK assumptions seeded successfully");
    console.log(`   Region: ${ukAssumptions.regionCode}`);
    console.log(`   Period: ${ukAssumptions.periodStart.toISOString().split('T')[0]} to ${ukAssumptions.periodEnd.toISOString().split('T')[0]}`);
    console.log(`   Electricity: ${ukAssumptions.electricityUnitPPerKwh}p/kWh`);
    console.log(`   Gas: ${ukAssumptions.gasUnitPPerKwh}p/kWh`);
    console.log(`   Grid Intensity: ${ukAssumptions.gridIntensityGco2ePerKwh} gCO2e/kWh`);
    console.log("⚠️  NOTE: This is PLACEHOLDER data - replace with real values!");
  } catch (error) {
    console.error("❌ Error seeding UK assumptions:", error);
    throw error;
  }
}

// Allow running directly
if (require.main === module) {
  seedUKAssumptions()
    .then(() => {
      console.log("✅ Seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seed failed:", error);
      process.exit(1);
    });
}
