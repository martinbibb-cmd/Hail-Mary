/**
 * Entity Validator Service
 *
 * Rocky's Authority Layer - Validates LLM-extracted entities against catalogs.
 *
 * Architecture:
 * - LLM extracts entities (interpreter)
 * - Validator checks against domain knowledge (authority)
 * - Boosts confidence for exact matches
 * - Flags mismatches and suggests alternatives
 * - Final decision on what to trust
 *
 * Key Principle: This is where Rocky decides. LLM proposes, validator disposes.
 */

import type {
  Entity,
  BoilerEntity,
  ControlSystemEntity,
  ComponentEntity,
  FaultCodeEntity,
  MeasurementEntity,
  MaterialEntity,
  ValidationResult,
  ExtractionMethod,
  Validated,
  ValidatedEntity,
  ValidationMeta,
} from '@hail-mary/shared/atlas-voice';

import {
  BOILER_MAKE_ALIASES,
  COMMON_BOILER_MODELS,
  BOILER_MODEL_PATTERNS,
  CONTROL_SYSTEMS,
  CONTROL_SYSTEM_PATTERNS,
  COMPONENT_ALIASES,
  DIAGNOSTIC_PATTERNS,
  DIAGNOSTIC_TEXT_PATTERNS,
  FAULT_CODES,
  JARGON_NORMALIZATION,
  getConfidenceLevel,
  needsConfirmation,
  type BoilerModel,
  type ControlSystemDefinition,
  type DiagnosticPattern,
  type FaultCode,
} from '@hail-mary/shared/atlas-voice';

// ============================================
// Types
// ============================================

export interface EntityValidationContext {
  /** Boiler catalog */
  boilerCatalog: {
    aliases: Record<string, string>;
    models: Record<string, BoilerModel>;
  };

  /** Control systems catalog */
  controlSystems: Record<string, ControlSystemDefinition>;

  /** Diagnostic patterns catalog */
  diagnosticPatterns: Record<string, DiagnosticPattern>;

  /** Fault codes catalog */
  faultCodes: Record<string, FaultCode>;

  /** Component aliases */
  componentAliases: Record<string, string>;
}

// ValidatedEntity and ValidationMeta are now imported from shared schema
// No need to redeclare here - using the generic Validated<T> wrapper pattern

// ============================================
// Default Validation Context
// ============================================

/**
 * Get default validation context from domain catalogs
 */
export function getDefaultValidationContext(): EntityValidationContext {
  return {
    boilerCatalog: {
      aliases: BOILER_MAKE_ALIASES,
      models: COMMON_BOILER_MODELS,
    },
    controlSystems: CONTROL_SYSTEMS,
    diagnosticPatterns: DIAGNOSTIC_PATTERNS,
    faultCodes: FAULT_CODES,
    componentAliases: COMPONENT_ALIASES,
  };
}

// ============================================
// Boiler Entity Validation
// ============================================

/**
 * Validate a boiler entity against the catalog
 */
function validateBoilerEntity(
  entity: BoilerEntity,
  context: EntityValidationContext
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let confidence_adjustment = 0;
  let suggested_alternative: any = undefined;

  // Check boiler make against aliases
  const normalizedMake = entity.make.toLowerCase();
  let catalogMake: string | undefined;

  // Try exact match first
  if (context.boilerCatalog.aliases[normalizedMake]) {
    catalogMake = context.boilerCatalog.aliases[normalizedMake];
    confidence_adjustment += 0.05; // Boost for catalog match
  } else {
    // Try fuzzy match
    const aliases = Object.keys(context.boilerCatalog.aliases);
    const fuzzyMatch = aliases.find(alias =>
      alias.includes(normalizedMake) || normalizedMake.includes(alias)
    );

    if (fuzzyMatch) {
      catalogMake = context.boilerCatalog.aliases[fuzzyMatch];
      warnings.push(`Boiler make "${entity.make}" matched "${catalogMake}" via fuzzy search`);
    } else {
      warnings.push(`Boiler make "${entity.make}" not found in catalog - may be uncommon or misspelled`);
      confidence_adjustment -= 0.1; // Penalty for no match
    }
  }

  // Check boiler model if provided
  if (entity.model) {
    const modelKey = Object.keys(context.boilerCatalog.models).find(key => {
      const model = context.boilerCatalog.models[key];
      return (
        model.make === catalogMake &&
        model.model.toLowerCase().includes(entity.model!.toLowerCase())
      );
    });

    if (modelKey) {
      const matchedModel = context.boilerCatalog.models[modelKey];
      confidence_adjustment += 0.05; // Boost for model match

      // Validate consistency
      if (entity.boiler_type && entity.boiler_type !== matchedModel.type) {
        warnings.push(
          `Boiler type mismatch: extracted "${entity.boiler_type}" but catalog says "${matchedModel.type}"`
        );
      }

      if (entity.output_kw && Math.abs(entity.output_kw - matchedModel.output_kw) > 5) {
        warnings.push(
          `Boiler output mismatch: extracted ${entity.output_kw}kW but catalog says ${matchedModel.output_kw}kW`
        );
      }

      suggested_alternative = matchedModel;
    } else {
      warnings.push(`Boiler model "${entity.model}" not found in catalog for make "${catalogMake}"`);
    }
  }

  // Validate age is reasonable
  if (entity.age !== undefined) {
    if (entity.age < 0 || entity.age > 50) {
      errors.push(`Boiler age ${entity.age} years is unrealistic`);
      confidence_adjustment -= 0.2;
    } else if (entity.age > 30) {
      warnings.push(`Boiler age ${entity.age} years is very old - verify accuracy`);
    }
  }

  return {
    valid: errors.length === 0,
    confidence_adjustment,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
    suggested_alternative,
  };
}

// ============================================
// Control System Entity Validation
// ============================================

/**
 * Validate a control system entity against the catalog
 */
function validateControlSystemEntity(
  entity: ControlSystemEntity,
  context: EntityValidationContext
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let confidence_adjustment = 0;

  // Check if system type exists in catalog
  const catalogSystem = context.controlSystems[entity.system_type];

  if (catalogSystem) {
    confidence_adjustment += 0.1; // Boost for catalog match

    // Verify name matches
    if (entity.name !== catalogSystem.name) {
      warnings.push(
        `Control system name "${entity.name}" doesn't match catalog name "${catalogSystem.name}"`
      );
    }

    // Verify components are consistent
    if (entity.components && entity.components.length > 0) {
      const unexpectedComponents = entity.components.filter(
        (comp: string) => !catalogSystem.typical_components.includes(comp)
      );

      if (unexpectedComponents.length > 0) {
        warnings.push(
          `Unexpected components for ${catalogSystem.name}: ${unexpectedComponents.join(', ')}`
        );
      }
    }
  } else {
    errors.push(`Control system type "${entity.system_type}" not found in catalog`);
    confidence_adjustment -= 0.15;
  }

  return {
    valid: errors.length === 0,
    confidence_adjustment,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
    suggested_alternative: catalogSystem,
  };
}

// ============================================
// Component Entity Validation
// ============================================

/**
 * Validate a component entity
 */
function validateComponentEntity(
  entity: ComponentEntity,
  context: EntityValidationContext
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let confidence_adjustment = 0;

  // Check if component type has an alias
  const normalizedType = entity.component_type.toLowerCase();
  const aliasMatch = Object.entries(context.componentAliases).find(
    ([alias, normalized]) => alias.toLowerCase() === normalizedType || normalized === entity.component_type
  );

  if (aliasMatch) {
    confidence_adjustment += 0.05; // Boost for recognized component
  } else {
    warnings.push(`Component type "${entity.component_type}" not in standard catalog`);
  }

  // Validate state is reasonable
  const validStates = [
    'working',
    'faulty',
    'leaking',
    'discharging',
    'stuck_open',
    'stuck_closed',
    'calling',
    'satisfied',
    'unknown',
  ];

  if (entity.state && !validStates.includes(entity.state)) {
    warnings.push(`Component state "${entity.state}" is non-standard`);
  }

  // Validate capacity if present
  if (entity.capacity) {
    if (entity.capacity.value <= 0) {
      errors.push(`Component capacity ${entity.capacity.value} is invalid`);
      confidence_adjustment -= 0.1;
    }

    // Typical cylinder capacities
    if (entity.component_type === 'cylinder') {
      const typicalCapacities = [120, 150, 180, 210, 250, 300];
      const isTypical = typicalCapacities.some(
        cap => Math.abs(entity.capacity!.value - cap) < 20
      );

      if (!isTypical) {
        warnings.push(`Cylinder capacity ${entity.capacity.value}L is unusual - verify accuracy`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    confidence_adjustment,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================
// Fault Code Entity Validation
// ============================================

/**
 * Validate a fault code entity against the catalog
 */
function validateFaultCodeEntity(
  entity: FaultCodeEntity,
  context: EntityValidationContext
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let confidence_adjustment = 0;
  let suggested_alternative: any = undefined;

  // Try to find fault code in catalog
  const codeKey = Object.keys(context.faultCodes).find(key => {
    const catalogCode = context.faultCodes[key];
    return catalogCode.code.toLowerCase() === entity.code.toLowerCase();
  });

  if (codeKey) {
    const catalogCode = context.faultCodes[codeKey];
    confidence_adjustment += 0.15; // Strong boost for exact code match

    // Verify boiler make matches if provided
    if (entity.boiler?.make) {
      const normalizedMake = entity.boiler.make.toLowerCase();
      const catalogMake = catalogCode.make.toLowerCase();

      if (!catalogMake.includes(normalizedMake) && !normalizedMake.includes(catalogMake)) {
        warnings.push(
          `Fault code ${entity.code} is for ${catalogCode.make}, but extracted boiler is ${entity.boiler.make}`
        );
      }
    }

    // Verify description matches if provided
    if (entity.description && entity.description !== catalogCode.description) {
      warnings.push(
        `Fault code description mismatch: extracted "${entity.description}" but catalog says "${catalogCode.description}"`
      );
    }

    suggested_alternative = catalogCode;
  } else {
    warnings.push(
      `Fault code "${entity.code}" not found in catalog - may be manufacturer-specific or uncommon`
    );
    confidence_adjustment -= 0.05; // Small penalty for unknown code
  }

  return {
    valid: errors.length === 0,
    confidence_adjustment,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
    suggested_alternative,
  };
}

// ============================================
// Measurement Entity Validation
// ============================================

/**
 * Validate a measurement entity
 */
function validateMeasurementEntity(
  entity: MeasurementEntity,
  context: EntityValidationContext
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let confidence_adjustment = 0;

  // Validate value is reasonable
  if (isNaN(entity.value)) {
    errors.push(`Measurement value "${entity.value}" is not a number`);
    confidence_adjustment -= 0.2;
    return {
      valid: false,
      confidence_adjustment,
      errors,
    };
  }

  // Validate based on measurement type
  switch (entity.measurement_type) {
    case 'pressure':
      // Typical system pressure is 1-1.5 bar
      if (entity.value < 0 || entity.value > 10) {
        errors.push(`Pressure ${entity.value}${entity.unit} is out of realistic range`);
        confidence_adjustment -= 0.15;
      } else if (entity.value > 3) {
        warnings.push(`Pressure ${entity.value}${entity.unit} is high - verify accuracy`);
      }
      break;

    case 'temperature':
      // Heating temperatures typically 50-90°C
      if (entity.value < -50 || entity.value > 150) {
        errors.push(`Temperature ${entity.value}${entity.unit} is unrealistic`);
        confidence_adjustment -= 0.15;
      }
      break;

    case 'pipe_size':
      // Common pipe sizes: 8mm, 10mm, 15mm, 22mm, 28mm
      const commonSizes = [8, 10, 15, 22, 28];
      if (!commonSizes.includes(entity.value)) {
        warnings.push(`Pipe size ${entity.value}mm is uncommon - verify accuracy`);
      }
      break;

    case 'voltage':
      // UK mains: 230V, low voltage controls: 12V, 24V
      const commonVoltages = [12, 24, 230];
      if (!commonVoltages.some(v => Math.abs(entity.value - v) < 10)) {
        warnings.push(`Voltage ${entity.value}V is unusual for UK heating systems`);
      }
      break;

    case 'current':
      // Typical boiler: 3-5A, larger appliances up to 13A
      if (entity.value < 0 || entity.value > 50) {
        warnings.push(`Current ${entity.value}A is unusual - verify accuracy`);
      }
      break;
  }

  // Check if value is within expected range
  if (entity.expected_range) {
    const { min, max } = entity.expected_range;
    const isNormal = entity.value >= min && entity.value <= max;

    if (entity.is_normal !== undefined && entity.is_normal !== isNormal) {
      warnings.push(
        `Measurement marked as ${entity.is_normal ? 'normal' : 'abnormal'} but value ${entity.value} is ${isNormal ? 'within' : 'outside'} expected range ${min}-${max}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    confidence_adjustment,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================
// Material Entity Validation
// ============================================

/**
 * Validate a material entity
 */
function validateMaterialEntity(
  entity: MaterialEntity,
  context: EntityValidationContext
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let confidence_adjustment = 0;

  // Validate quantity is reasonable
  if (entity.quantity !== undefined) {
    if (entity.quantity <= 0) {
      errors.push(`Material quantity ${entity.quantity} is invalid`);
      confidence_adjustment -= 0.1;
    } else if (entity.quantity > 100) {
      warnings.push(`Material quantity ${entity.quantity} is very high - verify accuracy`);
    }
  }

  // Validate specification makes sense for category
  if (entity.specification && entity.category === 'pipe') {
    // Pipe sizes should be in mm
    const sizeMatch = entity.specification.match(/(\d+)mm/);
    if (sizeMatch) {
      const size = parseInt(sizeMatch[1]);
      const commonSizes = [8, 10, 15, 22, 28, 35];
      if (!commonSizes.includes(size)) {
        warnings.push(`Pipe size ${size}mm is uncommon`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    confidence_adjustment,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================
// Main Validation Function
// ============================================

/**
 * Validate an entity against domain catalogs
 *
 * This is Rocky's authority - the final decision on what to trust.
 */
function validateEntity(
  entity: Entity,
  context: EntityValidationContext
): ValidatedEntity {
  let validationResult: ValidationResult;

  // Validate based on entity type
  switch (entity.type) {
    case 'boiler':
      validationResult = validateBoilerEntity(entity as BoilerEntity, context);
      break;

    case 'control_system':
      validationResult = validateControlSystemEntity(entity as ControlSystemEntity, context);
      break;

    case 'component':
      validationResult = validateComponentEntity(entity as ComponentEntity, context);
      break;

    case 'fault_code':
      validationResult = validateFaultCodeEntity(entity as FaultCodeEntity, context);
      break;

    case 'measurement':
      validationResult = validateMeasurementEntity(entity as MeasurementEntity, context);
      break;

    case 'material':
      validationResult = validateMaterialEntity(entity as MaterialEntity, context);
      break;

    default:
      validationResult = {
        valid: true,
        confidence_adjustment: 0,
        warnings: [`Unknown entity type: ${(entity as any).type}`],
      };
  }

  // Adjust confidence based on validation
  const adjustedConfidence = Math.max(
    0,
    Math.min(1, entity.metadata.confidence + (validationResult.confidence_adjustment || 0))
  );

  // Recalculate confidence level and needs_confirmation
  const adjustedConfidenceLevel = getConfidenceLevel(adjustedConfidence);
  const adjustedNeedsConfirmation = needsConfirmation(
    adjustedConfidence,
    entity.metadata.extraction_method
  );

  // Build catalog match info
  const catalog_match = validationResult.suggested_alternative
    ? {
        matched: true,
        match_type: (validationResult.confidence_adjustment || 0) > 0.1 ? 'exact' as const : 'fuzzy' as const,
        matched_value: validationResult.suggested_alternative,
      }
    : {
        matched: false,
        match_type: 'none' as const,
      };

  // Build ValidationMeta using the new schema
  const validationMeta: ValidationMeta = {
    passed: validationResult.valid,
    confidence_adjustment: validationResult.confidence_adjustment || 0,
    final_confidence: adjustedConfidence,
    warnings: validationResult.warnings || [],
    errors: validationResult.errors || [],
    catalog_match,
    validated_at: new Date(),
    schema_version: '1.0',
  };

  // Return validated entity using generic wrapper pattern
  return {
    ...entity,
    metadata: {
      ...entity.metadata,
      confidence: adjustedConfidence,
      confidence_level: adjustedConfidenceLevel,
      needs_confirmation: adjustedNeedsConfirmation,
    },
    validation: validationMeta,
  } as ValidatedEntity;
}

/**
 * Validate multiple entities
 */
export function validateEntities(
  entities: Entity[],
  context?: EntityValidationContext
): ValidatedEntity[] {
  const validationContext = context || getDefaultValidationContext();

  return entities.map(entity => validateEntity(entity, validationContext));
}

// ============================================
// Export
// ============================================

export const entityValidatorService = {
  validateEntity,
  validateEntities,
  getDefaultValidationContext,
};
