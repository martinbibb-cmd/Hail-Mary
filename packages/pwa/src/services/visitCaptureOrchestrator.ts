/**
 * Visit Capture Orchestrator
 *
 * Coordinates live extraction during visit recording:
 * 1. Applies transcript corrections
 * 2. Extracts fields using Rocky (local deterministic)
 * 3. Updates Lead store continuously
 * 4. Tracks which fields were auto-filled vs manual
 */

import { correctTranscript, type TranscriptCorrection } from '../utils/transcriptCorrector';
import { extractFromTranscript } from '../os/apps/visit/rockyExtractor';
import { useLeadStore } from '../stores/leadStore';
import type { Lead } from '@hail-mary/shared';

export interface CaptureResult {
  transcriptCorrection: TranscriptCorrection;
  extractedFields: Record<string, unknown>;
  updatedLead: Partial<Lead>;
  autoFilledFields: string[];
}

export interface CaptureContext {
  currentLeadId: string;
  accumulatedTranscript: string;
  previousFacts: Record<string, unknown>;
}

/**
 * Process new transcript segment and update Lead store
 */
export function processTranscriptSegment(
  newSegment: string,
  context: CaptureContext
): CaptureResult {
  // Step 1: Apply contextual corrections
  const correction = correctTranscript(newSegment);
  const correctedSegment = correction.corrected;

  // Step 2: Build accumulated transcript with corrected version
  const fullTranscript = context.accumulatedTranscript
    ? `${context.accumulatedTranscript} ${correctedSegment}`
    : correctedSegment;

  // Step 3: Extract fields using Rocky
  const rockyResult = extractFromTranscript({
    transcript: fullTranscript,
    previousFacts: context.previousFacts,
    previousChecklist: [], // Checklist handled separately in VisitApp
  });

  // Step 4: Determine which fields were newly auto-filled
  const autoFilledFields: string[] = [];
  for (const [key, value] of Object.entries(rockyResult.facts)) {
    if (value !== undefined && context.previousFacts[key] === undefined && key !== 'issues') {
      autoFilledFields.push(key);
    }
  }

  // Step 5: Map extracted fields to Lead schema (pass leadId to check manual fields)
  const leadUpdates: Partial<Lead> = mapFactsToLead(rockyResult.facts, context.currentLeadId);

  // Step 6: Update Lead store
  const leadStore = useLeadStore.getState();
  if (context.currentLeadId) {
    leadStore.updateLeadData(context.currentLeadId, leadUpdates);
  }

  return {
    transcriptCorrection: correction,
    extractedFields: rockyResult.facts,
    updatedLead: leadUpdates,
    autoFilledFields,
  };
}

/**
 * Map extracted facts to Lead entity fields
 * Skip manual fields and store suggestions separately
 */
function mapFactsToLead(facts: Record<string, unknown>, leadId?: string): Partial<Lead> {
  const updates: Partial<Lead> = {};

  // Map property type (skip if manual)
  if (facts.propertyType) {
    if (leadId && isFieldManual(leadId, 'propertyType')) {
      storeExtractionSuggestion(leadId, 'propertyType', facts.propertyType);
    } else {
      updates.propertyType = String(facts.propertyType);
    }
  }

  // Map notes (append extracted issues/observations)
  if (facts.issues && Array.isArray(facts.issues)) {
    const issuesText = facts.issues.join('; ');
    updates.notes = issuesText;
  }

  // Map estimated value (from any cost/value mentions)
  if (facts.estimatedCost) {
    updates.estimatedValue = Number(facts.estimatedCost);
  }

  // Additional mappings can be added here as needed
  // For now, we store the raw facts in notes or a custom field

  return updates;
}

/**
 * Mark fields as auto-filled (for UI highlighting)
 */
export function trackAutoFilledFields(
  leadId: string,
  fieldNames: string[]
): void {
  // Store auto-filled field metadata in localStorage
  const storageKey = `lead-${leadId}-autofill`;
  const existing = localStorage.getItem(storageKey);
  const autoFilled = existing ? JSON.parse(existing) : [];

  const updated = [...new Set([...autoFilled, ...fieldNames])];
  localStorage.setItem(storageKey, JSON.stringify(updated));
}

/**
 * Get auto-filled fields for a lead
 */
export function getAutoFilledFields(leadId: string): string[] {
  const storageKey = `lead-${leadId}-autofill`;
  const stored = localStorage.getItem(storageKey);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Clear auto-filled field tracking (when user manually edits)
 */
export function clearAutoFilledField(leadId: string, fieldName: string): void {
  const storageKey = `lead-${leadId}-autofill`;
  const existing = localStorage.getItem(storageKey);
  if (!existing) return;

  const autoFilled: string[] = JSON.parse(existing);
  const updated = autoFilled.filter(f => f !== fieldName);
  localStorage.setItem(storageKey, JSON.stringify(updated));
}

/**
 * Get manual fields for a lead (fields that user has manually edited)
 */
export function getManualFields(leadId: string): string[] {
  const storageKey = `lead-${leadId}-manual-fields`;
  const stored = localStorage.getItem(storageKey);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Check if a field is manual (user-edited)
 */
export function isFieldManual(leadId: string, fieldName: string): boolean {
  const manualFields = getManualFields(leadId);
  return manualFields.includes(fieldName);
}

/**
 * Store extraction suggestions separately when field is manual
 */
export function storeExtractionSuggestion(
  leadId: string,
  fieldName: string,
  suggestedValue: unknown
): void {
  const storageKey = `lead-${leadId}-extraction-suggestions`;
  const existing = localStorage.getItem(storageKey);
  const suggestions = existing ? JSON.parse(existing) : {};

  suggestions[fieldName] = {
    value: suggestedValue,
    timestamp: new Date().toISOString(),
  };

  localStorage.setItem(storageKey, JSON.stringify(suggestions));
}

/**
 * Get extraction suggestions for manual fields
 */
export function getExtractionSuggestions(leadId: string): Record<string, { value: unknown; timestamp: string }> {
  const storageKey = `lead-${leadId}-extraction-suggestions`;
  const stored = localStorage.getItem(storageKey);
  return stored ? JSON.parse(stored) : {};
}

