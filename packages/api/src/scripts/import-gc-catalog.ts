/**
 * GC Catalog Import Script
 * 
 * Imports GC catalog data from CSV or JSON files.
 * Usage: ts-node src/scripts/import-gc-catalog.ts <filepath>
 */

import { db } from '../db/drizzle-client';
import { boilerGcCatalog, boilerGcSources } from '../db/drizzle-schema';
import { eq } from 'drizzle-orm';
import { normalizeGc } from '../utils/gc-normalize';
import { createGcCatalogEntry, addSourceToGcCatalog } from '../services/gc.service';
import type { BoilerGcCatalog, GcBoilerType, GcFuelType } from '@hail-mary/shared';
import * as fs from 'fs';
import * as path from 'path';

interface CsvRow {
  gc_number: string;
  manufacturer?: string;
  brand?: string;
  model?: string;
  variant?: string;
  boiler_type?: string;
  fuel?: string;
  ch_output_kw?: string;
  dhw_output_kw?: string;
  pump_overrun_required?: string;
  permanent_live_required?: string;
  overrun_handled_by?: string;
  typical_fuse_a?: string;
  internal_pump_present?: string;
  internal_diverter_present?: string;
  height_mm?: string;
  width_mm?: string;
  depth_mm?: string;
  weight_kg?: string;
  flue_diameter_mm?: string;
  source_ref?: string;
  notes?: string;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};

    headers.forEach((header, index) => {
      if (values[index]) {
        row[header] = values[index];
      }
    });

    rows.push(row);
  }

  return rows;
}

function parseBoolean(value?: string): boolean | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === '1') return true;
  if (lower === 'false' || lower === 'no' || lower === '0') return false;
  return undefined;
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

function validateBoilerType(value?: string): GcBoilerType | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase() as GcBoilerType;
  if (['combi', 'system', 'regular', 'unknown'].includes(lower)) {
    return lower;
  }
  return 'unknown';
}

function validateFuelType(value?: string): GcFuelType | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase() as GcFuelType;
  if (['ng', 'lpg', 'oil', 'unknown'].includes(lower)) {
    return lower;
  }
  return 'unknown';
}

function validateOverrunHandledBy(value?: string): 'boiler' | 'external' | 'unknown' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (['boiler', 'external', 'unknown'].includes(lower)) {
    return lower as 'boiler' | 'external' | 'unknown';
  }
  return 'unknown';
}

async function importRow(row: CsvRow): Promise<void> {
  try {
    const gcNumber = normalizeGc(row.gc_number);
    
    if (!gcNumber) {
      console.warn(`Skipping row: invalid GC number "${row.gc_number}"`);
      return;
    }

    // Check if already exists
    const existing = await db
      .select()
      .from(boilerGcCatalog)
      .where(eq(boilerGcCatalog.gcNumber, gcNumber))
      .limit(1);

    if (existing.length > 0) {
      console.log(`Skipping ${gcNumber}: already exists`);
      return;
    }

    // Create catalog entry
    const entry: Omit<BoilerGcCatalog, 'id' | 'firstSeenAt' | 'updatedAt'> = {
      gcNumber,
      manufacturer: row.manufacturer,
      brand: row.brand,
      model: row.model,
      variant: row.variant,
      boilerType: validateBoilerType(row.boiler_type),
      fuel: validateFuelType(row.fuel),
      chOutputKwNominal: parseNumber(row.ch_output_kw),
      dhwOutputKwNominal: parseNumber(row.dhw_output_kw),
      pumpOverrunRequired: parseBoolean(row.pump_overrun_required),
      permanentLiveRequired: parseBoolean(row.permanent_live_required),
      overrunHandledBy: validateOverrunHandledBy(row.overrun_handled_by),
      typicalFuseA: parseNumber(row.typical_fuse_a) ? Math.floor(parseNumber(row.typical_fuse_a)!) : undefined,
      internalPumpPresent: parseBoolean(row.internal_pump_present),
      internalDiverterPresent: parseBoolean(row.internal_diverter_present),
      heightMm: parseNumber(row.height_mm) ? Math.floor(parseNumber(row.height_mm)!) : undefined,
      widthMm: parseNumber(row.width_mm) ? Math.floor(parseNumber(row.width_mm)!) : undefined,
      depthMm: parseNumber(row.depth_mm) ? Math.floor(parseNumber(row.depth_mm)!) : undefined,
      weightKg: parseNumber(row.weight_kg),
      flueDiameterMm: parseNumber(row.flue_diameter_mm) ? Math.floor(parseNumber(row.flue_diameter_mm)!) : undefined,
      status: 'active',
      notes: row.notes,
    };

    const catalog = await createGcCatalogEntry(entry);

    // Add source
    await addSourceToGcCatalog({
      gcCatalogId: catalog.id,
      sourceType: 'manual_entry',
      sourceRef: row.source_ref || 'seed:v1',
      extractedBy: 'import',
      fieldsCovered: Object.keys(row).filter(k => row[k as keyof CsvRow]),
      confidence: 0.85,
    });

    console.log(`✓ Imported ${gcNumber} - ${entry.manufacturer} ${entry.model}`);
  } catch (error) {
    console.error(`Error importing row:`, error);
    console.error(`Row data:`, row);
  }
}

async function importFile(filepath: string): Promise<void> {
  console.log(`Importing GC catalog from: ${filepath}`);

  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  const ext = path.extname(filepath).toLowerCase();
  const content = fs.readFileSync(filepath, 'utf-8');

  let rows: CsvRow[];

  if (ext === '.json') {
    rows = JSON.parse(content);
  } else if (ext === '.csv') {
    rows = parseCsv(content);
  } else {
    throw new Error(`Unsupported file format: ${ext}. Use .csv or .json`);
  }

  console.log(`Found ${rows.length} rows to import`);

  for (const row of rows) {
    await importRow(row);
  }

  console.log('Import complete!');
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: ts-node src/scripts/import-gc-catalog.ts <filepath>');
  process.exit(1);
}

const filepath = args[0];

importFile(filepath)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
