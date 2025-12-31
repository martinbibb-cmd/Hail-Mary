/**
 * GC Enrichment Service
 * 
 * Manages the enrichment queue for missing GC numbers.
 */

import { db } from '../db/drizzle-client';
import { boilerGcEnrichmentQueue, users, leads } from '../db/drizzle-schema';
import { eq, and, desc } from 'drizzle-orm';
import { normalizeGc } from '../utils/gc-normalize';
import { createGcCatalogEntry, addSourceToGcCatalog } from './gc.service';
import type {
  BoilerGcEnrichmentQueue,
  EnrichmentContext,
  EnrichmentCandidate,
  EnrichmentStatus,
} from '@hail-mary/shared';

/**
 * Create or update an enrichment request
 */
export async function requestEnrichment(
  gcNumber: string,
  userId?: number,
  leadId?: number,
  context?: EnrichmentContext
): Promise<BoilerGcEnrichmentQueue> {
  const normalized = normalizeGc(gcNumber);

  // Check if request already exists
  const [existing] = await db
    .select()
    .from(boilerGcEnrichmentQueue)
    .where(
      and(
        eq(boilerGcEnrichmentQueue.gcNumber, normalized),
        eq(boilerGcEnrichmentQueue.status, 'pending')
      )
    )
    .limit(1);

  if (existing) {
    // Update context if provided
    if (context) {
      const [updated] = await db
        .update(boilerGcEnrichmentQueue)
        .set({
          context: context as any,
          updatedAt: new Date(),
        })
        .where(eq(boilerGcEnrichmentQueue.id, existing.id))
        .returning();
      
      return mapDbToEnrichmentQueue(updated);
    }
    return mapDbToEnrichmentQueue(existing);
  }

  // Create new request
  const [created] = await db
    .insert(boilerGcEnrichmentQueue)
    .values({
      gcNumber: normalized,
      requestedByUserId: userId,
      requestedFromLeadId: leadId,
      context: context as any,
      status: 'pending',
      searchAttempts: 0,
    })
    .returning();

  return mapDbToEnrichmentQueue(created);
}

/**
 * Get enrichment queue entry by ID
 */
export async function getEnrichmentById(id: string): Promise<BoilerGcEnrichmentQueue | null> {
  const [entry] = await db
    .select()
    .from(boilerGcEnrichmentQueue)
    .where(eq(boilerGcEnrichmentQueue.id, id))
    .limit(1);

  return entry ? mapDbToEnrichmentQueue(entry) : null;
}

/**
 * Get pending enrichment requests
 */
export async function getPendingEnrichments(limit = 50): Promise<BoilerGcEnrichmentQueue[]> {
  const entries = await db
    .select()
    .from(boilerGcEnrichmentQueue)
    .where(eq(boilerGcEnrichmentQueue.status, 'pending'))
    .orderBy(desc(boilerGcEnrichmentQueue.createdAt))
    .limit(limit);

  return entries.map(mapDbToEnrichmentQueue);
}

/**
 * Update enrichment status
 */
export async function updateEnrichmentStatus(
  id: string,
  status: EnrichmentStatus,
  candidates?: EnrichmentCandidate[]
): Promise<void> {
  const updates: any = {
    status,
    updatedAt: new Date(),
  };

  if (candidates) {
    updates.candidates = candidates;
  }

  if (status === 'searching') {
    updates.lastSearchAt = new Date();
    updates.searchAttempts = db.$with('search_attempts').as(
      db.select().from(boilerGcEnrichmentQueue)
    );
  }

  await db
    .update(boilerGcEnrichmentQueue)
    .set(updates)
    .where(eq(boilerGcEnrichmentQueue.id, id));
}

/**
 * Increment search attempts
 */
export async function incrementSearchAttempts(id: string): Promise<void> {
  await db.execute(
    db.$with('increment').as(
      db
        .update(boilerGcEnrichmentQueue)
        .set({
          searchAttempts: db.$with('current').as(
            db.select().from(boilerGcEnrichmentQueue)
          ),
          lastSearchAt: new Date(),
        })
        .where(eq(boilerGcEnrichmentQueue.id, id))
    )
  );
}

/**
 * Approve an enrichment request and create catalog entry
 */
export async function approveEnrichment(
  queueId: string,
  reviewerUserId: number,
  chosenCandidate: EnrichmentCandidate,
  reviewerNotes?: string
): Promise<string> {
  const entry = await getEnrichmentById(queueId);
  
  if (!entry) {
    throw new Error('Enrichment queue entry not found');
  }

  if (entry.status !== 'needs_human' && entry.status !== 'candidates_found') {
    throw new Error(`Cannot approve enrichment in status: ${entry.status}`);
  }

  // Create catalog entry
  const catalog = await createGcCatalogEntry({
    gcNumber: entry.gcNumber,
    manufacturer: chosenCandidate.manufacturer,
    model: chosenCandidate.model,
    boilerType: chosenCandidate.boilerType,
    fuel: chosenCandidate.fuel,
    chOutputKwNominal: chosenCandidate.chKw,
    dhwOutputKwNominal: chosenCandidate.dhwKw,
    heightMm: chosenCandidate.dims?.height,
    widthMm: chosenCandidate.dims?.width,
    depthMm: chosenCandidate.dims?.depth,
    pumpOverrunRequired: chosenCandidate.overrunRequired,
    permanentLiveRequired: chosenCandidate.permanentLiveRequired,
    status: 'active',
    notes: reviewerNotes,
  });

  // Add source
  if (chosenCandidate.sourceRef) {
    await addSourceToGcCatalog({
      gcCatalogId: catalog.id,
      sourceType: chosenCandidate.sourceType || 'manual_entry',
      sourceRef: chosenCandidate.sourceRef,
      extractedBy: 'human',
      confidence: chosenCandidate.confidence || 0.8,
    });
  }

  // Update queue entry
  await db
    .update(boilerGcEnrichmentQueue)
    .set({
      status: 'approved',
      chosenCandidate: chosenCandidate as any,
      reviewerUserId,
      reviewerNotes,
      updatedAt: new Date(),
    })
    .where(eq(boilerGcEnrichmentQueue.id, queueId));

  return catalog.id;
}

/**
 * Reject an enrichment request
 */
export async function rejectEnrichment(
  queueId: string,
  reviewerUserId: number,
  reason: string
): Promise<void> {
  await db
    .update(boilerGcEnrichmentQueue)
    .set({
      status: 'rejected',
      reviewerUserId,
      reviewerNotes: reason,
      updatedAt: new Date(),
    })
    .where(eq(boilerGcEnrichmentQueue.id, queueId));
}

/**
 * Get enrichment statistics
 */
export async function getEnrichmentStats(): Promise<{
  pending: number;
  searching: number;
  needsHuman: number;
  approved: number;
  rejected: number;
}> {
  const result = await db
    .select()
    .from(boilerGcEnrichmentQueue);

  const stats = {
    pending: 0,
    searching: 0,
    needsHuman: 0,
    approved: 0,
    rejected: 0,
  };

  result.forEach(entry => {
    if (entry.status === 'pending') stats.pending++;
    else if (entry.status === 'searching') stats.searching++;
    else if (entry.status === 'needs_human' || entry.status === 'candidates_found') stats.needsHuman++;
    else if (entry.status === 'approved') stats.approved++;
    else if (entry.status === 'rejected') stats.rejected++;
  });

  return stats;
}

// ============================================
// Mapping Helpers
// ============================================

function mapDbToEnrichmentQueue(
  row: typeof boilerGcEnrichmentQueue.$inferSelect
): BoilerGcEnrichmentQueue {
  return {
    id: row.id,
    gcNumber: row.gcNumber,
    requestedByUserId: row.requestedByUserId || undefined,
    requestedFromLeadId: row.requestedFromLeadId || undefined,
    context: row.context as EnrichmentContext | undefined,
    status: row.status as EnrichmentStatus,
    searchAttempts: row.searchAttempts,
    lastSearchAt: row.lastSearchAt || undefined,
    candidates: row.candidates as EnrichmentCandidate[] | undefined,
    chosenCandidate: row.chosenCandidate as EnrichmentCandidate | undefined,
    reviewerUserId: row.reviewerUserId || undefined,
    reviewerNotes: row.reviewerNotes || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
