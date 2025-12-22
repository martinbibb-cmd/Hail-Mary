import type { ApiResponse, LeadWorkspace, UpdateLeadOccupancyDto, UpdatePropertyDto } from '@hail-mary/shared';
import type { ExtractedData } from './enhancedDataExtractor';

type ProvenanceEntry = {
  source: 'ai' | 'user';
  confidence?: number;
  timestamp: string;
};

function getManualFields(leadId: string): string[] {
  const key = `lead-${leadId}-manual-fields`;
  const stored = localStorage.getItem(key);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storeProvenance(leadId: string, entries: Record<string, ProvenanceEntry>) {
  const key = `lead-${leadId}-field-provenance`;
  try {
    const existing = localStorage.getItem(key);
    const existingObj = existing ? JSON.parse(existing) : {};
    localStorage.setItem(key, JSON.stringify({ ...existingObj, ...entries }));
  } catch {
    // Non-critical; ignore
  }
}

function normalizePropertyType(type: string): string {
  // Keep DB flexible; normalize only obvious variants
  if (type === 'semi') return 'semi-detached';
  return type;
}

function normalizeRoof(roof: string): string {
  if (!roof) return roof;
  // Property tab expects 'pitched' or 'flat'
  if (roof === 'flat') return 'flat';
  if (['tile', 'slate'].includes(roof)) return 'pitched';
  return roof;
}

function parseGlazingToGlazingType(glazing?: string): 'single' | 'double' | 'triple' | 'mixed' | undefined {
  if (!glazing) return undefined;
  const lower = glazing.toLowerCase();
  if (lower.includes('triple')) return 'triple';
  if (lower.includes('double')) return 'double';
  if (lower.includes('single')) return 'single';
  return undefined;
}

/**
 * Apply extracted facts into the normalized Lead Workspace tables.
 *
 * Conflict rule:
 * - Only fill empty fields (non-destructive)
 * - Skip fields marked manual in localStorage (best-effort)
 *
 * No schema migrations; provenance stored in localStorage.
 */
export async function applyExtractedFactsToWorkspace(
  leadId: string,
  extracted: ExtractedData
): Promise<void> {
  if (!leadId) return;

  // Avoid running on server
  if (typeof window === 'undefined') return;

  const manualFields = new Set(getManualFields(leadId));
  const now = new Date().toISOString();
  const provenanceUpdates: Record<string, ProvenanceEntry> = {};

  // Load current workspace so we can do non-destructive merges
  let workspace: LeadWorkspace | null = null;
  try {
    const res = await fetch(`/api/leads/${leadId}/workspace`, { credentials: 'include' });
    const json: ApiResponse<LeadWorkspace> = await res.json();
    if (json.success && json.data) {
      workspace = json.data;
    }
  } catch {
    // If workspace load fails, we can't safely do non-destructive writes
    return;
  }

  const propertyPatch: UpdatePropertyDto = {};
  const currentProperty = workspace?.property;
  const currentConstruction = (currentProperty?.construction as Record<string, unknown> | undefined) || {};
  const constructionPatch: Record<string, unknown> = { ...currentConstruction };
  let hasConstructionChanges = false;

  // Property.type
  if (!manualFields.has('propertyType')) {
    const currentType = (currentProperty?.type || '').trim();
    if (!currentType && extracted.property.propertyType) {
      propertyPatch.type = normalizePropertyType(extracted.property.propertyType);
      provenanceUpdates['property.type'] = { source: 'ai', confidence: extracted.confidence, timestamp: now };
    }
  }

  // Property.ageBand
  if (!manualFields.has('buildYearApprox')) {
    const currentAgeBand = (currentProperty?.ageBand || '').trim();
    if (!currentAgeBand && extracted.property.ageBand) {
      propertyPatch.ageBand = extracted.property.ageBand;
      provenanceUpdates['property.ageBand'] = { source: 'ai', confidence: extracted.confidence, timestamp: now };
    }
  }

  // Construction.walls
  if (!manualFields.has('construction.walls')) {
    const currentWalls = String((currentConstruction as any).walls || '').trim();
    const newWalls = extracted.property.construction?.walls;
    if (!currentWalls && newWalls) {
      constructionPatch.walls = newWalls;
      hasConstructionChanges = true;
      provenanceUpdates['property.construction.walls'] = { source: 'ai', confidence: extracted.confidence, timestamp: now };
    }
  }

  // Construction.roof (normalize to pitched/flat when possible)
  if (!manualFields.has('construction.roof')) {
    const currentRoof = String((currentConstruction as any).roof || '').trim();
    const newRoofRaw = extracted.property.construction?.roof;
    const newRoof = newRoofRaw ? normalizeRoof(newRoofRaw) : undefined;
    if (!currentRoof && newRoof) {
      constructionPatch.roof = newRoof;
      hasConstructionChanges = true;
      provenanceUpdates['property.construction.roof'] = { source: 'ai', confidence: extracted.confidence, timestamp: now };
    }
  }

  // Map glazing → construction.glazingType used by PropertyApp (not PropertyTab)
  if (!manualFields.has('glazingType')) {
    const currentGlazingType = String((currentConstruction as any).glazingType || '').trim();
    const glazingType = parseGlazingToGlazingType(extracted.property.construction?.glazing);
    if (!currentGlazingType && glazingType) {
      constructionPatch.glazingType = glazingType;
      hasConstructionChanges = true;
      provenanceUpdates['property.construction.glazingType'] = { source: 'ai', confidence: extracted.confidence, timestamp: now };
    }
  }

  // Map loft depth → construction.loftInsulationDepthMm used by PropertyApp
  if (!manualFields.has('loftInsulationDepthMm')) {
    const currentLoftDepth = String((currentConstruction as any).loftInsulationDepthMm || '').trim();
    if (!currentLoftDepth && typeof extracted.property.loftDepth === 'number') {
      constructionPatch.loftInsulationDepthMm = String(extracted.property.loftDepth);
      hasConstructionChanges = true;
      provenanceUpdates['property.construction.loftInsulationDepthMm'] = { source: 'ai', confidence: extracted.confidence, timestamp: now };
    }
  }

  // Occupancy fields (write to occupancy table when empty)
  const occPatch: UpdateLeadOccupancyDto = {};
  const currentOcc = workspace?.occupancy;

  if (!manualFields.has('occupancy.occupants')) {
    if (currentOcc?.occupants == null && typeof extracted.occupancy.occupants === 'number') {
      occPatch.occupants = extracted.occupancy.occupants;
      provenanceUpdates['occupancy.occupants'] = { source: 'ai', confidence: extracted.confidence, timestamp: now };
    }
  }

  if (!manualFields.has('occupancy.schedule')) {
    const currentSchedule = (currentOcc?.schedule || '').trim();
    if (!currentSchedule && extracted.occupancy.schedule) {
      occPatch.schedule = extracted.occupancy.schedule;
      provenanceUpdates['occupancy.schedule'] = { source: 'ai', confidence: extracted.confidence, timestamp: now };
    }
  }

  // For the PropertyApp (which currently reads these from property.construction), also fill these non-destructively.
  if (!manualFields.has('homeAllDay')) {
    const currentHomeAllDay = (currentConstruction as any).homeAllDay;
    if ((currentHomeAllDay === undefined || currentHomeAllDay === null) && typeof extracted.occupancy.homeAllDay === 'boolean') {
      constructionPatch.homeAllDay = extracted.occupancy.homeAllDay;
      hasConstructionChanges = true;
      provenanceUpdates['property.construction.homeAllDay'] = { source: 'ai', confidence: extracted.confidence, timestamp: now };
    }
  }

  if (!manualFields.has('hotWaterProfile')) {
    const currentHwp = String((currentConstruction as any).hotWaterProfile || '').trim();
    if (!currentHwp && extracted.occupancy.hotWaterUsage) {
      constructionPatch.hotWaterProfile = extracted.occupancy.hotWaterUsage;
      hasConstructionChanges = true;
      provenanceUpdates['property.construction.hotWaterProfile'] = { source: 'ai', confidence: extracted.confidence, timestamp: now };
    }
  }

  if (hasConstructionChanges) {
    propertyPatch.construction = constructionPatch;
  }

  // Persist provenance locally (no migrations)
  if (Object.keys(provenanceUpdates).length > 0) {
    storeProvenance(leadId, provenanceUpdates);
  }

  // Apply patches (only if there are changes)
  const propertyPatchKeys = Object.keys(propertyPatch);
  if (propertyPatchKeys.length > 0) {
    try {
      await fetch(`/api/leads/${leadId}/property`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(propertyPatch),
      });
    } catch {
      // ignore
    }
  }

  const occPatchKeys = Object.keys(occPatch);
  if (occPatchKeys.length > 0) {
    try {
      await fetch(`/api/leads/${leadId}/occupancy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(occPatch),
      });
    } catch {
      // ignore
    }
  }
}

