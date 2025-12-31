/**
 * GC Catalog Service
 * 
 * Core service for managing boiler GC catalog operations.
 */

import { db } from '../db/drizzle-client';
import { 
  boilerGcCatalog, 
  boilerGcSources, 
  boilerGcAliases 
} from '../db/drizzle-schema';
import { eq, or, desc, sql } from 'drizzle-orm';
import { normalizeGc, generateGcAliases } from '../utils/gc-normalize';
import type {
  BoilerGcCatalog,
  BoilerGcSource,
  BoilerGcAlias,
} from '@hail-mary/shared';

/**
 * Lookup a boiler by GC number (supports canonical and aliases)
 */
export async function lookupBoilerByGc(gcNumber: string): Promise<BoilerGcCatalog | null> {
  const normalized = normalizeGc(gcNumber);
  
  if (!normalized) {
    return null;
  }

  // Try direct lookup first
  const [direct] = await db
    .select()
    .from(boilerGcCatalog)
    .where(eq(boilerGcCatalog.gcNumber, normalized))
    .limit(1);

  if (direct) {
    return mapDbToBoilerGcCatalog(direct);
  }

  // Try alias lookup
  const [alias] = await db
    .select({
      catalog: boilerGcCatalog,
    })
    .from(boilerGcAliases)
    .innerJoin(
      boilerGcCatalog,
      eq(boilerGcAliases.gcNumberCanonical, boilerGcCatalog.gcNumber)
    )
    .where(eq(boilerGcAliases.alias, normalized))
    .limit(1);

  if (alias?.catalog) {
    return mapDbToBoilerGcCatalog(alias.catalog);
  }

  return null;
}

/**
 * Get sources for a GC catalog entry
 */
export async function getSourcesForGc(gcCatalogId: string): Promise<BoilerGcSource[]> {
  const sources = await db
    .select()
    .from(boilerGcSources)
    .where(eq(boilerGcSources.gcCatalogId, gcCatalogId))
    .orderBy(desc(boilerGcSources.extractedAt));

  return sources.map(mapDbToBoilerGcSource);
}

/**
 * Create a new GC catalog entry
 */
export async function createGcCatalogEntry(
  entry: Omit<BoilerGcCatalog, 'id' | 'firstSeenAt' | 'updatedAt'>
): Promise<BoilerGcCatalog> {
  const normalized = normalizeGc(entry.gcNumber);
  
  const [created] = await db
    .insert(boilerGcCatalog)
    .values({
      gcNumber: normalized,
      manufacturer: entry.manufacturer,
      brand: entry.brand,
      model: entry.model,
      variant: entry.variant,
      boilerType: entry.boilerType,
      fuel: entry.fuel,
      chOutputKwNominal: entry.chOutputKwNominal?.toString(),
      dhwOutputKwNominal: entry.dhwOutputKwNominal?.toString(),
      modulationMinKw: entry.modulationMinKw?.toString(),
      modulationMaxKw: entry.modulationMaxKw?.toString(),
      erpEfficiencyPercent: entry.erpEfficiencyPercent?.toString(),
      erpClass: entry.erpClass,
      pumpOverrunRequired: entry.pumpOverrunRequired,
      permanentLiveRequired: entry.permanentLiveRequired,
      overrunHandledBy: entry.overrunHandledBy,
      typicalFuseA: entry.typicalFuseA,
      controlsSupported: entry.controlsSupported,
      internalPumpPresent: entry.internalPumpPresent,
      internalDiverterPresent: entry.internalDiverterPresent,
      plateHexPresent: entry.plateHexPresent,
      expansionVesselPresent: entry.expansionVesselPresent,
      heightMm: entry.heightMm,
      widthMm: entry.widthMm,
      depthMm: entry.depthMm,
      weightKg: entry.weightKg?.toString(),
      flueDiameterMm: entry.flueDiameterMm,
      maxFlueLengthM: entry.maxFlueLengthM?.toString(),
      plumeKitCompatible: entry.plumeKitCompatible,
      status: entry.status || 'active',
      qualityScore: entry.qualityScore?.toString(),
      notes: entry.notes,
    })
    .returning();

  // Create common aliases
  const aliases = generateGcAliases(normalized);
  if (aliases.length > 0) {
    await db.insert(boilerGcAliases).values(
      aliases.map(alias => ({
        gcNumberCanonical: normalized,
        alias,
      }))
    );
  }

  return mapDbToBoilerGcCatalog(created);
}

/**
 * Add a source to a GC catalog entry
 */
export async function addSourceToGcCatalog(
  source: Omit<BoilerGcSource, 'id' | 'extractedAt'>
): Promise<BoilerGcSource> {
  const [created] = await db
    .insert(boilerGcSources)
    .values({
      gcCatalogId: source.gcCatalogId,
      sourceType: source.sourceType,
      sourceRef: source.sourceRef,
      extractedBy: source.extractedBy,
      fieldsCovered: source.fieldsCovered,
      confidence: source.confidence?.toString(),
      rawSnippet: source.rawSnippet,
      checksum: source.checksum,
    })
    .returning();

  return mapDbToBoilerGcSource(created);
}

/**
 * Update quality score for a catalog entry
 */
export async function updateQualityScore(
  gcCatalogId: string,
  qualityScore: number
): Promise<void> {
  await db
    .update(boilerGcCatalog)
    .set({
      qualityScore: qualityScore.toString(),
      updatedAt: new Date(),
    })
    .where(eq(boilerGcCatalog.id, gcCatalogId));
}

/**
 * Calculate quality score based on field completeness and source confidence
 */
export function calculateQualityScore(
  catalog: BoilerGcCatalog,
  sources: BoilerGcSource[]
): number {
  // Critical fields for quality score
  const criticalFields = [
    catalog.manufacturer,
    catalog.model,
    catalog.boilerType,
    catalog.fuel,
    catalog.chOutputKwNominal,
    catalog.pumpOverrunRequired,
    catalog.permanentLiveRequired,
  ];

  const criticalFieldsPresent = criticalFields.filter(f => f !== undefined && f !== null).length;
  const criticalFieldsTotal = criticalFields.length;
  const criticalScore = criticalFieldsPresent / criticalFieldsTotal;

  // Source confidence average
  const confidences = sources
    .map(s => s.confidence)
    .filter((c): c is number => c !== undefined);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0.5;

  // Weighted score: 70% field completeness, 30% source confidence
  return (criticalScore * 0.7) + (avgConfidence * 0.3);
}

// ============================================
// Mapping Helpers
// ============================================

function mapDbToBoilerGcCatalog(row: typeof boilerGcCatalog.$inferSelect): BoilerGcCatalog {
  return {
    id: row.id,
    gcNumber: row.gcNumber,
    manufacturer: row.manufacturer || undefined,
    brand: row.brand || undefined,
    model: row.model || undefined,
    variant: row.variant || undefined,
    boilerType: (row.boilerType || undefined) as BoilerGcCatalog['boilerType'],
    fuel: (row.fuel || undefined) as BoilerGcCatalog['fuel'],
    chOutputKwNominal: row.chOutputKwNominal ? Number(row.chOutputKwNominal) : undefined,
    dhwOutputKwNominal: row.dhwOutputKwNominal ? Number(row.dhwOutputKwNominal) : undefined,
    modulationMinKw: row.modulationMinKw ? Number(row.modulationMinKw) : undefined,
    modulationMaxKw: row.modulationMaxKw ? Number(row.modulationMaxKw) : undefined,
    erpEfficiencyPercent: row.erpEfficiencyPercent ? Number(row.erpEfficiencyPercent) : undefined,
    erpClass: row.erpClass || undefined,
    pumpOverrunRequired: row.pumpOverrunRequired || undefined,
    permanentLiveRequired: row.permanentLiveRequired || undefined,
    overrunHandledBy: (row.overrunHandledBy || undefined) as BoilerGcCatalog['overrunHandledBy'],
    typicalFuseA: row.typicalFuseA || undefined,
    controlsSupported: (row.controlsSupported || undefined) as BoilerGcCatalog['controlsSupported'],
    internalPumpPresent: row.internalPumpPresent || undefined,
    internalDiverterPresent: row.internalDiverterPresent || undefined,
    plateHexPresent: row.plateHexPresent || undefined,
    expansionVesselPresent: row.expansionVesselPresent || undefined,
    heightMm: row.heightMm || undefined,
    widthMm: row.widthMm || undefined,
    depthMm: row.depthMm || undefined,
    weightKg: row.weightKg ? Number(row.weightKg) : undefined,
    flueDiameterMm: row.flueDiameterMm || undefined,
    maxFlueLengthM: row.maxFlueLengthM ? Number(row.maxFlueLengthM) : undefined,
    plumeKitCompatible: row.plumeKitCompatible || undefined,
    firstSeenAt: row.firstSeenAt,
    updatedAt: row.updatedAt,
    status: row.status as BoilerGcCatalog['status'],
    qualityScore: row.qualityScore ? Number(row.qualityScore) : undefined,
    notes: row.notes || undefined,
  };
}

function mapDbToBoilerGcSource(row: typeof boilerGcSources.$inferSelect): BoilerGcSource {
  return {
    id: row.id,
    gcCatalogId: row.gcCatalogId,
    sourceType: row.sourceType as BoilerGcSource['sourceType'],
    sourceRef: row.sourceRef || undefined,
    extractedBy: row.extractedBy as BoilerGcSource['extractedBy'],
    extractedAt: row.extractedAt,
    fieldsCovered: (row.fieldsCovered as string[]) || undefined,
    confidence: row.confidence ? Number(row.confidence) : undefined,
    rawSnippet: row.rawSnippet || undefined,
    checksum: row.checksum || undefined,
  };
}
