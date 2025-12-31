/**
 * GC Resolver Service
 * 
 * Resolves survey fields from GC catalog with confidence scoring and fallback rules.
 */

import { lookupBoilerByGc } from './gc.service';
import type {
  BoilerGcCatalog,
  FieldValue,
  FieldSource,
  ResolveGcRequest,
  ResolveGcResponse,
  ResolvedField,
  getConfidenceForSource,
} from '@hail-mary/shared';

// Re-export confidence function for use in this service
function getConfidence(source: FieldSource): number {
  const confidenceMap: Record<FieldSource, number> = {
    'GC_CATALOG': 0.95,
    'IMAGE_OCR_PLATE': 0.85,
    'IMAGE_BRAND_FAMILY_RECO': 0.70,
    'MANUAL_ENGINEER_ENTRY': 0.65,
    'HEURISTIC_FROM_PIPES': 0.55,
    'UNKNOWN': 0.00,
  };
  return confidenceMap[source] || 0.00;
}

/**
 * Resolve survey fields with confidence and provenance
 */
export async function resolveGcFields(
  request: ResolveGcRequest
): Promise<ResolveGcResponse> {
  const resolved: ResolvedField = {};
  const requiredPrompts: string[] = [];
  const installIssues: string[] = [];
  
  let gcCatalog: BoilerGcCatalog | null = null;
  let gcFound = false;

  // Step 1: Try GC lookup
  if (request.gcNumber) {
    gcCatalog = await lookupBoilerByGc(request.gcNumber);
    gcFound = !!gcCatalog;
  }

  // Step 2: Resolve fields from GC catalog if found
  if (gcCatalog) {
    resolveFromGcCatalog(gcCatalog, resolved);
  }

  // Step 3: Apply manual inputs (engineer entry)
  if (request.manualBrand) {
    resolved.brand = createFieldValue(
      request.manualBrand,
      'MANUAL_ENGINEER_ENTRY'
    );
  }

  if (request.manualModel) {
    resolved.model = createFieldValue(
      request.manualModel,
      'MANUAL_ENGINEER_ENTRY'
    );
  }

  if (request.manualType) {
    resolved.boilerType = createFieldValue(
      request.manualType,
      'MANUAL_ENGINEER_ENTRY'
    );
  }

  // Step 4: Apply heuristics from pipe signature if available
  if (request.pipeSignature) {
    applyPipeHeuristics(request.pipeSignature, resolved);
  }

  // Step 5: Determine required prompts
  determineRequiredPrompts(resolved, gcFound, requiredPrompts);

  // Step 6: Check for install issues
  checkInstallIssues(resolved, request, installIssues);

  return {
    success: true,
    data: {
      resolved,
      requiredPrompts,
      gcFound,
      installIssues: installIssues.length > 0 ? installIssues : undefined,
    },
  };
}

/**
 * Resolve fields from GC catalog
 */
function resolveFromGcCatalog(
  catalog: BoilerGcCatalog,
  resolved: ResolvedField
): void {
  const source: FieldSource = 'GC_CATALOG';

  if (catalog.manufacturer) {
    resolved.manufacturer = createFieldValue(catalog.manufacturer, source);
  }

  if (catalog.brand) {
    resolved.brand = createFieldValue(catalog.brand, source);
  }

  if (catalog.model) {
    resolved.model = createFieldValue(catalog.model, source);
  }

  if (catalog.variant) {
    resolved.variant = createFieldValue(catalog.variant, source);
  }

  if (catalog.boilerType) {
    resolved.boilerType = createFieldValue(catalog.boilerType, source);
  }

  if (catalog.fuel) {
    resolved.fuel = createFieldValue(catalog.fuel, source);
  }

  if (catalog.chOutputKwNominal) {
    resolved.chOutputKw = createFieldValue(catalog.chOutputKwNominal, source);
  }

  if (catalog.dhwOutputKwNominal) {
    resolved.dhwOutputKw = createFieldValue(catalog.dhwOutputKwNominal, source);
  }

  // Critical install fields
  if (catalog.pumpOverrunRequired !== undefined) {
    resolved.pumpOverrunRequired = createFieldValue(
      catalog.pumpOverrunRequired,
      source,
      'Required for correct pump control'
    );
  }

  if (catalog.permanentLiveRequired !== undefined) {
    resolved.permanentLiveRequired = createFieldValue(
      catalog.permanentLiveRequired,
      source,
      'Required for correct electrical installation'
    );
  }

  if (catalog.overrunHandledBy) {
    resolved.overrunHandledBy = createFieldValue(catalog.overrunHandledBy, source);
  }

  if (catalog.typicalFuseA) {
    resolved.typicalFuseA = createFieldValue(catalog.typicalFuseA, source);
  }

  // Hydraulic info
  if (catalog.internalPumpPresent !== undefined) {
    resolved.internalPumpPresent = createFieldValue(
      catalog.internalPumpPresent,
      source
    );
  }

  if (catalog.internalDiverterPresent !== undefined) {
    resolved.internalDiverterPresent = createFieldValue(
      catalog.internalDiverterPresent,
      source
    );
  }

  // Physical dimensions
  if (catalog.heightMm) {
    resolved.heightMm = createFieldValue(catalog.heightMm, source);
  }

  if (catalog.widthMm) {
    resolved.widthMm = createFieldValue(catalog.widthMm, source);
  }

  if (catalog.depthMm) {
    resolved.depthMm = createFieldValue(catalog.depthMm, source);
  }
}

/**
 * Apply heuristics from pipe signature
 */
function applyPipeHeuristics(
  pipeSignature: string,
  resolved: ResolvedField
): void {
  const source: FieldSource = 'HEURISTIC_FROM_PIPES';
  
  // Common pipe patterns
  const gravityLike = /2x28.*2x22.*1x15/i;
  const systemLike = /3x22.*2x15/i;
  
  let systemTopology: string | undefined;

  if (gravityLike.test(pipeSignature)) {
    systemTopology = 'gravity_like';
  } else if (systemLike.test(pipeSignature)) {
    systemTopology = 'pumped_system_like';
  } else {
    systemTopology = 'ambiguous';
  }

  resolved.systemTopology = createFieldValue(
    systemTopology,
    source,
    'Inferred from pipe configuration; does NOT determine boiler type'
  );
}

/**
 * Determine what prompts are still needed
 */
function determineRequiredPrompts(
  resolved: ResolvedField,
  gcFound: boolean,
  prompts: string[]
): void {
  // If no GC found, request it
  if (!gcFound) {
    prompts.push('gc_number');
  }

  // Critical install fields must be known
  if (!resolved.pumpOverrunRequired || resolved.pumpOverrunRequired.confidence < 0.65) {
    prompts.push('pump_overrun_required');
  }

  if (!resolved.permanentLiveRequired || resolved.permanentLiveRequired.confidence < 0.65) {
    prompts.push('permanent_live_required');
  }

  // Cylinder presence (site reality)
  if (!resolved.cylinderPresent) {
    prompts.push('cylinder_present');
  }

  // Pipe signature if not provided
  if (!resolved.systemTopology) {
    prompts.push('pipe_signature');
  }

  // Wiring cores observation
  if (!resolved.wiringCores) {
    prompts.push('wiring_cores');
  }

  // Controls type
  if (!resolved.existingControlType) {
    prompts.push('existing_control_type');
  }
}

/**
 * Check for install issues
 */
function checkInstallIssues(
  resolved: ResolvedField,
  request: ResolveGcRequest,
  issues: string[]
): void {
  // Check if permanent live is required but only 3-core available
  if (
    resolved.permanentLiveRequired?.value === true &&
    request.wiringCores === 3
  ) {
    issues.push(
      'Permanent live required but only 3-core wiring observed. ' +
      'Additional core or wiring upgrade needed for pump overrun.'
    );
  }

  // Check if pump overrun is required but no clarity on handling
  if (
    resolved.pumpOverrunRequired?.value === true &&
    (!resolved.overrunHandledBy || resolved.overrunHandledBy.value === 'unknown')
  ) {
    issues.push(
      'Pump overrun required. Confirm if handled by boiler or external controls.'
    );
  }
}

/**
 * Helper to create a FieldValue
 */
function createFieldValue<T>(
  value: T,
  source: FieldSource,
  notes?: string
): FieldValue<T> {
  return {
    value,
    confidence: getConfidence(source),
    source,
    notes,
  };
}
