/**
 * Rocky v2 Logic Engine Service
 *
 * Enhanced version of Rocky that uses LLM entity extraction + deterministic validation.
 *
 * Architecture:
 * 1. Normalize text (deterministic - v1)
 * 2. LLM entity extraction (NEW - interpreter)
 * 3. Validate against catalogs (NEW - authority)
 * 4. Build RockyFacts from entities (enhanced)
 * 5. Generate outputs (same as v1)
 *
 * Architectural Rule: Rocky decides. Sarah explains.
 */

import crypto from 'crypto';
import type {
  RockyProcessRequest,
  RockyProcessResult,
  RockyFactsV1,
  AutomaticNotes,
  EngineerBasics,
} from '@hail-mary/shared';

import type {
  Entity,
  Event,
  BoilerEntity,
  ControlSystemEntity,
  ComponentEntity,
  FaultCodeEntity,
  MeasurementEntity,
  MaterialEntity,
  EntityEventExtraction,
} from '@hail-mary/shared/atlas-voice';

import { JARGON_NORMALIZATION } from '@hail-mary/shared/atlas-voice';

import { llmEntityExtractorService } from './llm-entity-extractor.service';
import { entityValidatorService, type ValidatedEntity } from './entity-validator.service';

// ============================================
// Text Normalization (deterministic)
// ============================================

/**
 * Normalize text using Rocky's rules (deterministic)
 * Same as Rocky v1 - this is our foundation
 */
function normalizeText(text: string): string {
  let normalized = text;

  // Apply jargon normalization from catalog
  for (const rule of JARGON_NORMALIZATION) {
    normalized = normalized.replace(rule.pattern, rule.replacement);
  }

  return normalized;
}

/**
 * Calculate hash of natural notes for auditability
 */
function calculateNotesHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ============================================
// Entity → RockyFacts Conversion
// ============================================

/**
 * Build RockyFactsV1 from validated entities
 *
 * This converts the new entity/event structure back to the v1 RockyFacts format
 * for backward compatibility.
 */
function buildRockyFactsFromEntities(
  sessionId: number,
  naturalNotes: string,
  entities: ValidatedEntity[]
): RockyFactsV1['facts'] {
  const facts: RockyFactsV1['facts'] = {
    customer: {},
    property: {},
    existingSystem: {},
    measurements: {},
    materials: [],
    hazards: [],
  };

  // Extract boiler information
  const boilerEntities = entities.filter(e => (e as Entity).type === 'boiler') as unknown as BoilerEntity[];
  if (boilerEntities.length > 0) {
    const boiler = boilerEntities[0]; // Take first boiler
    facts.existingSystem = {
      boilerMake: boiler.make,
      boilerModel: boiler.model,
      boilerAge: boiler.age,
      systemType: boiler.boiler_type,
      fuelType: boiler.fuel_type,
      condition: boiler.condition,
    };
  }

  // Extract control system information
  const controlEntities = entities.filter(e => (e as Entity).type === 'control_system') as unknown as ControlSystemEntity[];
  if (controlEntities.length > 0) {
    const control = controlEntities[0];
    // Add to facts (no direct field in v1, but we can note it)
    if (!facts.existingSystem) facts.existingSystem = {};
    // Store in a comment or note field if needed
  }

  // Extract measurements
  const measurementEntities = entities.filter(e => (e as Entity).type === 'measurement') as unknown as MeasurementEntity[];
  measurementEntities.forEach(measurement => {
    switch (measurement.measurement_type) {
      case 'pressure':
        // System pressure - not in v1 schema but could be added
        break;

      case 'pipe_size':
        facts.measurements!.pipeSize = `${measurement.value}${measurement.unit}`;
        break;

      case 'temperature':
        // Temperature readings - could add to measurements
        break;

      case 'current':
        if (measurement.context?.toLowerCase().includes('fuse')) {
          facts.measurements!.mainFuseRating = measurement.value;
        }
        break;
    }
  });

  // Extract materials
  const materialEntities = entities.filter(e => (e as Entity).type === 'material') as unknown as MaterialEntity[];
  facts.materials = materialEntities.map(material => ({
    name: material.name,
    quantity: material.quantity,
    unit: material.unit,
  }));

  // Extract components that might be hazards
  const componentEntities = entities.filter(e => (e as Entity).type === 'component') as unknown as ComponentEntity[];
  componentEntities.forEach(component => {
    // Check for hazardous states
    if (
      component.state === 'faulty' ||
      component.state === 'leaking' ||
      component.state === 'discharging'
    ) {
      facts.hazards = facts.hazards || [];
      facts.hazards.push({
        type: `${component.name} ${component.state}`,
        location: component.location || 'See notes',
        severity: 'medium',
      });
    }
  });

  return facts;
}

/**
 * Calculate completeness scores from facts
 * Same as v1
 */
function calculateCompleteness(facts: RockyFactsV1['facts']): RockyFactsV1['completeness'] {
  const scores = {
    customerInfo: 0,
    propertyDetails: 0,
    existingSystem: 0,
    measurements: 0,
    overall: 0,
  };

  // Customer info (4 fields)
  const customerFields = [
    facts.customer?.firstName,
    facts.customer?.lastName,
    facts.customer?.address,
    facts.customer?.contactPreference,
  ];
  scores.customerInfo = Math.round((customerFields.filter(f => f).length / 4) * 100);

  // Property details (5 fields)
  const propertyFields = [
    facts.property?.type,
    facts.property?.bedrooms,
    facts.property?.yearBuilt,
    facts.property?.wallConstruction,
    facts.property?.roofType,
  ];
  scores.propertyDetails = Math.round((propertyFields.filter(f => f !== undefined).length / 5) * 100);

  // Existing system (6 fields)
  const systemFields = [
    facts.existingSystem?.boilerMake,
    facts.existingSystem?.boilerModel,
    facts.existingSystem?.boilerAge,
    facts.existingSystem?.systemType,
    facts.existingSystem?.fuelType,
    facts.existingSystem?.condition,
  ];
  scores.existingSystem = Math.round((systemFields.filter(f => f !== undefined).length / 6) * 100);

  // Measurements (4 fields)
  const measurementFields = [
    facts.measurements?.pipeSize,
    facts.measurements?.radiatorCount,
    facts.measurements?.cylinderCapacity,
    facts.measurements?.mainFuseRating,
  ];
  scores.measurements = Math.round((measurementFields.filter(f => f !== undefined).length / 4) * 100);

  // Overall (average)
  scores.overall = Math.round(
    (scores.customerInfo + scores.propertyDetails + scores.existingSystem + scores.measurements) / 4
  );

  return scores;
}

/**
 * Detect missing data from facts
 * Same as v1
 */
function detectMissingData(facts: RockyFactsV1['facts']): RockyFactsV1['missingData'] {
  const missing: RockyFactsV1['missingData'] = [];

  // Required fields
  if (!facts.property?.type) {
    missing.push({ category: 'property', field: 'type', required: true });
  }
  if (!facts.existingSystem?.systemType) {
    missing.push({ category: 'existingSystem', field: 'systemType', required: true });
  }
  if (!facts.measurements?.pipeSize) {
    missing.push({ category: 'measurements', field: 'pipeSize', required: true });
  }

  // Important but not required
  if (!facts.existingSystem?.boilerAge) {
    missing.push({ category: 'existingSystem', field: 'boilerAge', required: false });
  }
  if (!facts.measurements?.mainFuseRating) {
    missing.push({ category: 'measurements', field: 'mainFuseRating', required: false });
  }

  return missing;
}

/**
 * Generate Automatic Notes from RockyFacts
 * Same as v1
 */
function generateAutomaticNotes(sessionId: number, rockyFacts: RockyFactsV1): AutomaticNotes {
  const facts = rockyFacts.facts;

  // Build sections from facts (no interpretation, just formatting)
  const customerSummary =
    facts.customer
      ? `Customer: ${facts.customer.firstName || ''} ${facts.customer.lastName || ''}\n` +
        `Address: ${facts.customer.address || 'Not recorded'}\n` +
        `Contact: ${facts.customer.contactPreference || 'Not specified'}`
      : 'No customer information recorded';

  const propertyOverview =
    facts.property
      ? `Property Type: ${facts.property.type || 'Unknown'}\n` +
        `Bedrooms: ${facts.property.bedrooms || 'Not recorded'}\n` +
        `Year Built: ${facts.property.yearBuilt || 'Not recorded'}\n` +
        `Construction: ${facts.property.wallConstruction || 'Not recorded'}\n` +
        `Roof: ${facts.property.roofType || 'Not recorded'}`
      : 'No property details recorded';

  const systemDetails =
    facts.existingSystem
      ? `Boiler: ${facts.existingSystem.boilerMake || ''} ${facts.existingSystem.boilerModel || ''}\n` +
        `Age: ${facts.existingSystem.boilerAge ? `${facts.existingSystem.boilerAge} years` : 'Unknown'}\n` +
        `Type: ${facts.existingSystem.systemType || 'Unknown'}\n` +
        `Fuel: ${facts.existingSystem.fuelType || 'Unknown'}\n` +
        `Condition: ${facts.existingSystem.condition || 'Unknown'}`
      : 'No existing system details recorded';

  const measurementsAndSizes =
    facts.measurements
      ? `Pipe Size: ${facts.measurements.pipeSize || 'Not recorded'}\n` +
        `Radiator Count: ${facts.measurements.radiatorCount || 'Not recorded'}\n` +
        `Cylinder Capacity: ${facts.measurements.cylinderCapacity ? `${facts.measurements.cylinderCapacity}L` : 'Not recorded'}\n` +
        `Main Fuse: ${facts.measurements.mainFuseRating ? `${facts.measurements.mainFuseRating}A` : 'Not recorded'}`
      : 'No measurements recorded';

  const materialsRequired =
    facts.materials && facts.materials.length > 0
      ? facts.materials.map(m => `- ${m.name}${m.quantity ? ` (${m.quantity}${m.unit || ''})` : ''}`).join('\n')
      : 'No materials mentioned';

  const hazardsIdentified =
    facts.hazards && facts.hazards.length > 0
      ? facts.hazards.map(h => `- ${h.type} (${h.severity}): ${h.location}`).join('\n')
      : 'No hazards identified';

  const nextSteps =
    facts.requiredActions && facts.requiredActions.length > 0
      ? facts.requiredActions.map(a => `- ${a.action} (${a.priority}): ${a.reason}`).join('\n')
      : 'No specific actions required';

  return {
    sessionId,
    rockyFactsVersion: rockyFacts.version,
    sections: {
      customerSummary,
      propertyOverview,
      systemDetails,
      measurementsAndSizes,
      materialsRequired,
      hazardsIdentified,
      nextSteps,
    },
    generatedAt: new Date(),
  };
}

/**
 * Generate Engineer Basics from RockyFacts
 * Same as v1
 */
function generateEngineerBasics(sessionId: number, rockyFacts: RockyFactsV1): EngineerBasics {
  const facts = rockyFacts.facts;

  return {
    sessionId,
    rockyFactsVersion: rockyFacts.version,
    basics: {
      propertyType: facts.property?.type,
      bedrooms: facts.property?.bedrooms?.toString(),
      boilerMakeModel:
        facts.existingSystem?.boilerMake && facts.existingSystem?.boilerModel
          ? `${facts.existingSystem.boilerMake} ${facts.existingSystem.boilerModel}`
          : undefined,
      boilerAge: facts.existingSystem?.boilerAge?.toString(),
      systemType: facts.existingSystem?.systemType,
      pipeSize: facts.measurements?.pipeSize,
      mainFuse: facts.measurements?.mainFuseRating?.toString(),
      materials: facts.materials?.map(m => `${m.name}${m.quantity ? ` (${m.quantity})` : ''}`) || [],
      hazards: facts.hazards?.map(h => `${h.type} (${h.severity})`) || [],
      actions: facts.requiredActions?.map(a => `${a.action} (${a.priority})`) || [],
    },
    generatedAt: new Date(),
  };
}

// ============================================
// Main Rocky v2 Processing Function
// ============================================

/**
 * Process natural notes through Rocky v2
 *
 * Enhanced with LLM entity extraction + deterministic validation
 */
export async function processNaturalNotes(request: RockyProcessRequest): Promise<RockyProcessResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // ========================================
    // Step 1: Normalize Text (Deterministic - v1)
    // ========================================

    const normalizedText = normalizeText(request.naturalNotes);
    const notesHash = calculateNotesHash(request.naturalNotes);

    // ========================================
    // Step 2: LLM Entity Extraction (NEW - Interpreter)
    // ========================================

    let entities: ValidatedEntity[] = [];
    let events: Event[] = [];
    let extractionResult: any = null;

    try {
      extractionResult = await llmEntityExtractorService.extractEntitiesWithLLM({
        text: normalizedText,
        context: {
          surveyType: (request as any).surveyType,
          previousEntities: (request as any).sessionEntities,
        },
      });

      // ========================================
      // Step 3: Validate Entities (NEW - Authority)
      // ========================================

      const validatedEntities = entityValidatorService.validateEntities(extractionResult.entities);

      entities = validatedEntities;
      events = extractionResult.events;

      // Collect warnings from extraction
      if (extractionResult.warnings) {
        warnings.push(...extractionResult.warnings);
      }

      // Collect warnings from validation
      validatedEntities.forEach(entity => {
        if (entity.validation.warnings.length > 0) {
          warnings.push(...entity.validation.warnings);
        }
        if (entity.validation.errors.length > 0) {
          errors.push(...entity.validation.errors);
        }
      });
    } catch (llmError) {
      // LLM extraction failed - fall back to empty entities
      warnings.push(`LLM entity extraction failed: ${(llmError as Error).message}`);
      warnings.push('Falling back to empty entity extraction - only basic facts will be available');
    }

    // ========================================
    // Step 4: Build RockyFacts from Entities
    // ========================================

    const facts = buildRockyFactsFromEntities(request.sessionId, request.naturalNotes, entities);

    // Calculate completeness
    const completeness = calculateCompleteness(facts);

    // Detect missing data
    const missingData = detectMissingData(facts);

    // Build RockyFacts
    const rockyFacts: RockyFactsV1 = {
      version: '1.0.0',
      sessionId: request.sessionId,
      processedAt: new Date(),
      naturalNotesHash: notesHash,
      facts,
      completeness,
      missingData,
    };

    // ========================================
    // Step 5: Generate Outputs (same as v1)
    // ========================================

    const automaticNotes = generateAutomaticNotes(request.sessionId, rockyFacts);
    const engineerBasics = generateEngineerBasics(request.sessionId, rockyFacts);

    // Add warnings for low completeness
    if (completeness.overall < 50) {
      warnings.push('Low overall completeness - significant data missing');
    }
    if (missingData.some(m => m.required)) {
      warnings.push('Required fields are missing');
    }

    const processingTimeMs = Date.now() - startTime;

    // ========================================
    // Return Enhanced Result
    // ========================================

    return {
      success: true,
      rockyFacts,
      automaticNotes,
      engineerBasics,
      processingTimeMs,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      // NEW in v2 - include entity/event extraction
      ...(extractionResult && {
        entities,
        events,
        entityExtractionConfidence: extractionResult.overall_confidence,
        itemsNeedingConfirmation: extractionResult.items_needing_confirmation,
      }),
    };
  } catch (error) {
    errors.push(`Rocky v2 processing failed: ${(error as Error).message}`);
    throw new Error(`Rocky v2 processing failed: ${(error as Error).message}`);
  }
}

// ============================================
// Exports
// ============================================

export const rockyV2Service = {
  processNaturalNotes,
  normalizeText,
  calculateNotesHash,
};
