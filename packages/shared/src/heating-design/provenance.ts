/**
 * Calculation Provenance - Audit Trail for Heating Calculations
 *
 * Every calculation result includes provenance so surveyors can:
 * - Understand what assumptions were made
 * - Trust the output
 * - Regenerate with updated inputs
 * - Explain results to customers/regulators
 *
 * This is what transforms Atlas from "clever software" to "professional instrument"
 */

import type { ConfidenceLevel } from '../core/systemRecommendation';

// ============================================================================
// Core Provenance Type
// ============================================================================

export interface CalculationProvenance {
  // What methodology was used
  method: string; // e.g., "EN12831-simplified", "MCS-approximation"
  methodVersion: string; // e.g., "2026.01"

  // Exact inputs used (not references - actual values at time of calculation)
  inputsSnapshot: Record<string, unknown>;

  // What was assumed vs what was known
  assumptions: Assumption[];
  defaultsApplied: DefaultApplied[];
  overrides: Override[];

  // Issues found during calculation
  warnings: Warning[];

  // When and why this was calculated
  calculatedAt: Date;
  calculatedBy?: string; // user ID if manual trigger
  reason?: CalculationReason;
}

export type CalculationReason =
  | 'initial_calculation'
  | 'user_override'
  | 'recalc_after_edit'
  | 'methodology_update'
  | 'data_correction';

// ============================================================================
// Assumption Tracking
// ============================================================================

/**
 * Assumption: Something we guessed because we didn't have data
 * Impact: How much uncertainty this introduces
 */
export interface Assumption {
  code: string; // e.g., "ACH_UNKNOWN", "WALL_CONSTRUCTION_INFERRED"
  field: string; // e.g., "airChangesPerHour", "wallConstruction"
  description: string; // Human-readable: "Air change rate assumed as 1.0 ACH (no airtightness test)"
  impact: AssumptionImpact;
  value: unknown; // What value we assumed
  alternatives?: {
    value: unknown;
    label: string;
  }[]; // Other reasonable values surveyor could try
}

export type AssumptionImpact =
  | 'low'      // <5% effect on result
  | 'medium'   // 5-15% effect
  | 'high';    // >15% effect

// ============================================================================
// Default Application Tracking
// ============================================================================

/**
 * Default: A value we used because it's standard practice
 * Not an assumption - this is policy/lookup, not guesswork
 */
export interface DefaultApplied {
  field: string; // e.g., "outsideDesignTemp", "targetTemperature"
  value: unknown; // What value was used
  source: DefaultSource;
  description: string; // e.g., "From postcode SW1A: -3°C"
}

export type DefaultSource =
  | 'postcode_lookup'        // Climate data from postcode
  | 'room_type_default'      // Standard temp for room type
  | 'era_typical'            // Typical for construction year
  | 'company_policy'         // Organization default
  | 'industry_standard';     // MCS/CIBSE/etc standard

// ============================================================================
// Override Tracking
// ============================================================================

/**
 * Override: User explicitly changed a calculated/inferred value
 */
export interface Override {
  field: string;
  originalValue: unknown;
  overriddenValue: unknown;
  reason?: string; // Optional user explanation
  timestamp: Date;
  userId?: string;
}

// ============================================================================
// Warning System
// ============================================================================

/**
 * Warning: Potential issue with inputs or results
 * Helps surveyors catch mistakes before they ship
 */
export interface Warning {
  code: string; // e.g., "HEAT_LOSS_PER_M2_HIGH", "FABRIC_RATIO_LOW"
  severity: WarningSeverity;
  category: WarningCategory;
  message: string; // User-facing message
  suggestedFix?: string; // Actionable guidance
  affectedFields?: string[]; // Which inputs to review
  context?: Record<string, unknown>; // Additional data for debugging
}

export type WarningSeverity =
  | 'info'      // FYI, might be fine
  | 'warning'   // Should probably check this
  | 'error';    // Likely incorrect, needs fixing

export type WarningCategory =
  | 'data_quality'       // Missing/suspicious input data
  | 'calculation'        // Math result seems wrong
  | 'compliance'         // Doesn't meet standards
  | 'performance';       // Undersized/oversized

// ============================================================================
// Confidence Summary
// ============================================================================

/**
 * Coarse confidence rollup - computed from provenance
 * Makes it easy to show UI indicators without exposing complexity
 */
export interface ConfidenceSummary {
  overall: ConfidenceLevel;
  geometry: ConfidenceLevel;    // From room data source
  fabric: ConfidenceLevel;      // From U-values, construction data
  ventilation: ConfidenceLevel; // From ACH, infiltration
  emitters: ConfidenceLevel;    // From radiator placement
}

/**
 * Compute confidence from provenance
 * Simple heuristic: more assumptions/warnings = lower confidence
 */
export function computeConfidence(provenance: CalculationProvenance): ConfidenceSummary {
  // Count high-impact assumptions
  const highImpactAssumptions = provenance.assumptions.filter(a => a.impact === 'high').length;
  const medImpactAssumptions = provenance.assumptions.filter(a => a.impact === 'medium').length;
  const errors = provenance.warnings.filter(w => w.severity === 'error').length;
  const warnings = provenance.warnings.filter(w => w.severity === 'warning').length;

  // Simple scoring (can be refined later)
  let score = 100;
  score -= highImpactAssumptions * 20;
  score -= medImpactAssumptions * 10;
  score -= errors * 30;
  score -= warnings * 5;

  const overall: ConfidenceLevel =
    score >= 80 ? 'high' :
    score >= 50 ? 'medium' : 'low';

  // Category-specific confidence (stubbed for now)
  // TODO: Compute from specific assumption categories
  return {
    overall,
    geometry: overall, // Simplified
    fabric: overall,
    ventilation: overall,
    emitters: overall,
  };
}

// ============================================================================
// Standard Warning Codes
// ============================================================================

export const WarningCodes = {
  // Data quality
  MISSING_CEILING_HEIGHT: 'MISSING_CEILING_HEIGHT',
  MISSING_WINDOW_SIZES: 'MISSING_WINDOW_SIZES',
  EXTERNAL_WALLS_UNCERTAIN: 'EXTERNAL_WALLS_UNCERTAIN',
  CONSTRUCTION_UNKNOWN: 'CONSTRUCTION_UNKNOWN',

  // Calculation results
  HEAT_LOSS_PER_M2_HIGH: 'HEAT_LOSS_PER_M2_HIGH',
  HEAT_LOSS_PER_M2_LOW: 'HEAT_LOSS_PER_M2_LOW',
  FABRIC_RATIO_HIGH: 'FABRIC_RATIO_HIGH',
  FABRIC_RATIO_LOW: 'FABRIC_RATIO_LOW',
  VENTILATION_LOSS_HIGH: 'VENTILATION_LOSS_HIGH',

  // Compliance
  TARGET_TEMP_UNUSUAL: 'TARGET_TEMP_UNUSUAL',
  OUTSIDE_TEMP_UNUSUAL: 'OUTSIDE_TEMP_UNUSUAL',

  // Performance
  RADIATOR_UNDERSIZED: 'RADIATOR_UNDERSIZED',
  RADIATOR_OVERSIZED: 'RADIATOR_OVERSIZED',
} as const;

// ============================================================================
// Standard Assumption Codes
// ============================================================================

export const AssumptionCodes = {
  ACH_UNKNOWN: 'ACH_UNKNOWN',
  WALL_CONSTRUCTION_INFERRED: 'WALL_CONSTRUCTION_INFERRED',
  ROOF_CONSTRUCTION_INFERRED: 'ROOF_CONSTRUCTION_INFERRED',
  FLOOR_CONSTRUCTION_INFERRED: 'FLOOR_CONSTRUCTION_INFERRED',
  WINDOW_UVALUE_ASSUMED: 'WINDOW_UVALUE_ASSUMED',
  CEILING_HEIGHT_ASSUMED: 'CEILING_HEIGHT_ASSUMED',
  THERMAL_BRIDGING_TYPICAL: 'THERMAL_BRIDGING_TYPICAL',
} as const;
