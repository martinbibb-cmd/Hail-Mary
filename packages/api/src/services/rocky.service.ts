/**
 * Rocky Logic Engine Service
 * 
 * Deterministic, auditable logic engine for processing voice notes.
 * NO LLM usage - pure rule-based extraction and derivation.
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
  RockyConfig,
} from '@hail-mary/shared';

// ============================================
// Rocky Configuration
// ============================================

const ROCKY_CONFIG: RockyConfig = {
  engineVersion: '1.0.0',
  
  extractionRules: {
    // Patterns to extract customer info
    customerInfoPatterns: [
      /(?:customer|client|homeowner).*?(?:name|called).*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /(?:mr|mrs|ms|miss)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /\b([A-Z][a-z]+)\s+(?:at|on)\s+\d+/i, // Name before address
    ],
    
    // Patterns to extract measurements
    measurementPatterns: [
      /(\d+)\s*(?:mm|millimeter)/gi,
      /(\d+)\s*(?:amp|amps|A)\b/gi,
      /(\d+)\s*(?:litre|liter|L)\b/gi,
      /(\d+)\s*(?:kW|kilowatt)/gi,
    ],
    
    // Keywords for materials
    materialKeywords: [
      'boiler', 'cylinder', 'radiator', 'pipe', 'filter', 'valve',
      'thermostat', 'programmer', 'inhibitor', 'cleaner', 'flue',
      'trv', 'lockshield', 'isolate', 'filling loop', 'expansion vessel',
    ],
    
    // Keywords for hazards
    hazardKeywords: [
      'asbestos', 'monkey muck', 'lead', 'unsafe', 'dangerous',
      'condemned', 'risk', 'hazard', 'warning', 'caution',
    ],
  },
  
  validationRules: {
    requiredFields: [
      'property.type',
      'existingSystem.systemType',
      'measurements.pipeSize',
    ],
    criticalMeasurements: [
      'pipeSize',
      'mainFuseRating',
    ],
  },
  
  normalizationRules: {
    pipeSizes: [
      { pattern: /(\d+)\s*mm/gi, normalized: '$1mm' },
      { pattern: /fifteen\s*mm/gi, normalized: '15mm' },
      { pattern: /twenty[- ]?two\s*mm/gi, normalized: '22mm' },
      { pattern: /twenty[- ]?eight\s*mm/gi, normalized: '28mm' },
    ],
    boilerTypes: [
      { pattern: /combination\s+boiler/gi, normalized: 'combi' },
      { pattern: /system\s+boiler/gi, normalized: 'system' },
      { pattern: /regular\s+boiler/gi, normalized: 'regular' },
      { pattern: /back\s+boiler/gi, normalized: 'other' },
    ],
  },
};

// ============================================
// Rocky Core Engine
// ============================================

/**
 * Calculate hash of natural notes for auditability
 */
function calculateNotesHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Normalize text using Rocky's rules (deterministic)
 */
function normalizeText(text: string): string {
  let normalized = text;
  
  // Apply pipe size normalization
  for (const rule of ROCKY_CONFIG.normalizationRules.pipeSizes) {
    normalized = normalized.replace(rule.pattern, rule.normalized);
  }
  
  // Apply boiler type normalization
  for (const rule of ROCKY_CONFIG.normalizationRules.boilerTypes) {
    normalized = normalized.replace(rule.pattern, rule.normalized);
  }
  
  // Fix common transcription errors (deterministic)
  // Note: "monkey mock" → "monkey muck" is heating industry jargon for asbestos-based pipe lagging
  // "TRB" → "TRV" is Thermostatic Radiator Valve (common speech-to-text error)
  normalized = normalized
    .replace(/monkey\s+mock/gi, 'monkey muck')
    .replace(/TRB/g, 'TRV')
    .replace(/tear[- ]?away\s+valve/gi, 'TRV')
    .replace(/micro[- ]?bore/gi, 'microbore');
  
  return normalized;
}

/**
 * Extract measurements from text (deterministic)
 */
function extractMeasurements(text: string): RockyFactsV1['facts']['measurements'] {
  const measurements: RockyFactsV1['facts']['measurements'] = {};
  
  // Extract pipe sizes
  const pipeSizeMatch = text.match(/(\d+)\s*mm/i);
  if (pipeSizeMatch) {
    measurements.pipeSize = `${pipeSizeMatch[1]}mm`;
  }
  
  // Extract radiator count
  const radiatorMatch = text.match(/(\d+)\s*(?:radiator|rad)/i);
  if (radiatorMatch) {
    measurements.radiatorCount = parseInt(radiatorMatch[1]);
  }
  
  // Extract cylinder capacity
  const cylinderMatch = text.match(/(\d+)\s*(?:litre|liter|L)\s*(?:cylinder|tank)/i);
  if (cylinderMatch) {
    measurements.cylinderCapacity = parseInt(cylinderMatch[1]);
  }
  
  // Extract main fuse rating
  const fuseMatch = text.match(/(\d+)\s*(?:amp|A)\s*(?:main\s+)?(?:fuse|supply)/i);
  if (fuseMatch) {
    measurements.mainFuseRating = parseInt(fuseMatch[1]);
  }
  
  return measurements;
}

/**
 * Extract materials from text (deterministic)
 */
function extractMaterials(text: string): Array<{ name: string; quantity?: number; unit?: string }> {
  const materials: Array<{ name: string; quantity?: number; unit?: string }> = [];
  const lowerText = text.toLowerCase();
  
  // Look for each material keyword
  for (const keyword of ROCKY_CONFIG.extractionRules.materialKeywords) {
    if (lowerText.includes(keyword)) {
      // Try to find quantity before the keyword
      const regex = new RegExp(`(\\d+)\\s*(?:x\\s*)?${keyword}`, 'gi');
      const matches = text.matchAll(regex);
      
      let found = false;
      for (const match of matches) {
        materials.push({
          name: keyword,
          quantity: parseInt(match[1]),
        });
        found = true;
      }
      
      // Add without quantity if not found with quantity
      if (!found) {
        materials.push({ name: keyword });
      }
    }
  }
  
  // Deduplicate by name (keep first occurrence)
  const seen = new Set<string>();
  return materials.filter(m => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });
}

/**
 * Extract hazards from text (deterministic)
 */
function extractHazards(text: string): Array<{ type: string; location: string; severity: 'low' | 'medium' | 'high' }> {
  const hazards: Array<{ type: string; location: string; severity: 'low' | 'medium' | 'high' }> = [];
  const lowerText = text.toLowerCase();
  
  for (const keyword of ROCKY_CONFIG.extractionRules.hazardKeywords) {
    if (lowerText.includes(keyword)) {
      // Determine severity based on keyword
      let severity: 'low' | 'medium' | 'high' = 'medium';
      if (['asbestos', 'condemned', 'dangerous'].includes(keyword)) {
        severity = 'high';
      } else if (['warning', 'caution'].includes(keyword)) {
        severity = 'low';
      }
      
      hazards.push({
        type: keyword,
        location: 'See notes', // Deterministic - we don't interpret location
        severity,
      });
    }
  }
  
  return hazards;
}

/**
 * Calculate completeness scores (deterministic)
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
 * Detect missing data (deterministic)
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
 * Generate Automatic Notes from RockyFacts (deterministic)
 */
function generateAutomaticNotes(sessionId: number, rockyFacts: RockyFactsV1): AutomaticNotes {
  const facts = rockyFacts.facts;
  
  // Build sections from facts (no interpretation, just formatting)
  const customerSummary = facts.customer
    ? `Customer: ${facts.customer.firstName || ''} ${facts.customer.lastName || ''}\n` +
      `Address: ${facts.customer.address || 'Not recorded'}\n` +
      `Contact: ${facts.customer.contactPreference || 'Not specified'}`
    : 'No customer information recorded';
  
  const propertyOverview = facts.property
    ? `Property Type: ${facts.property.type || 'Unknown'}\n` +
      `Bedrooms: ${facts.property.bedrooms || 'Not recorded'}\n` +
      `Year Built: ${facts.property.yearBuilt || 'Not recorded'}\n` +
      `Construction: ${facts.property.wallConstruction || 'Not recorded'}\n` +
      `Roof: ${facts.property.roofType || 'Not recorded'}`
    : 'No property details recorded';
  
  const systemDetails = facts.existingSystem
    ? `Boiler: ${facts.existingSystem.boilerMake || ''} ${facts.existingSystem.boilerModel || ''}\n` +
      `Age: ${facts.existingSystem.boilerAge ? `${facts.existingSystem.boilerAge} years` : 'Unknown'}\n` +
      `Type: ${facts.existingSystem.systemType || 'Unknown'}\n` +
      `Fuel: ${facts.existingSystem.fuelType || 'Unknown'}\n` +
      `Condition: ${facts.existingSystem.condition || 'Unknown'}`
    : 'No existing system details recorded';
  
  const measurementsAndSizes = facts.measurements
    ? `Pipe Size: ${facts.measurements.pipeSize || 'Not recorded'}\n` +
      `Radiator Count: ${facts.measurements.radiatorCount || 'Not recorded'}\n` +
      `Cylinder Capacity: ${facts.measurements.cylinderCapacity ? `${facts.measurements.cylinderCapacity}L` : 'Not recorded'}\n` +
      `Main Fuse: ${facts.measurements.mainFuseRating ? `${facts.measurements.mainFuseRating}A` : 'Not recorded'}`
    : 'No measurements recorded';
  
  const materialsRequired = facts.materials && facts.materials.length > 0
    ? facts.materials.map(m => `- ${m.name}${m.quantity ? ` (${m.quantity}${m.unit || ''})` : ''}`).join('\n')
    : 'No materials mentioned';
  
  const hazardsIdentified = facts.hazards && facts.hazards.length > 0
    ? facts.hazards.map(h => `- ${h.type} (${h.severity}): ${h.location}`).join('\n')
    : 'No hazards identified';
  
  const nextSteps = facts.requiredActions && facts.requiredActions.length > 0
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
 * Generate Engineer Basics from RockyFacts (deterministic, fixed format)
 */
function generateEngineerBasics(sessionId: number, rockyFacts: RockyFactsV1): EngineerBasics {
  const facts = rockyFacts.facts;
  
  return {
    sessionId,
    rockyFactsVersion: rockyFacts.version,
    basics: {
      propertyType: facts.property?.type,
      bedrooms: facts.property?.bedrooms?.toString(),
      boilerMakeModel: facts.existingSystem?.boilerMake && facts.existingSystem?.boilerModel
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
// Main Rocky Processing Function
// ============================================

/**
 * Process natural notes through Rocky engine
 * Pure deterministic processing - NO LLM calls
 */
export async function processNaturalNotes(request: RockyProcessRequest): Promise<RockyProcessResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Normalize the input text
    const normalizedText = normalizeText(request.naturalNotes);
    
    // Calculate hash for auditability
    const notesHash = calculateNotesHash(request.naturalNotes);
    
    // Extract facts using deterministic rules
    const facts: RockyFactsV1['facts'] = {
      measurements: extractMeasurements(normalizedText),
      materials: extractMaterials(normalizedText),
      hazards: extractHazards(normalizedText),
    };
    
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
    
    // Generate outputs
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
    
    return {
      success: true,
      rockyFacts,
      automaticNotes,
      engineerBasics,
      processingTimeMs,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    errors.push(`Rocky processing failed: ${(error as Error).message}`);
    throw new Error(`Rocky processing failed: ${(error as Error).message}`);
  }
}

// ============================================
// Exports
// ============================================

export const rockyService = {
  processNaturalNotes,
  config: ROCKY_CONFIG,
};
