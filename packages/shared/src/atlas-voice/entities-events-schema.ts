/**
 * Atlas Voice - Entities & Events Schema
 *
 * This defines the core data structures for Rocky v2's entity + event extraction.
 *
 * Architecture:
 * - Entities: Things (boilers, controls, components, measurements, codes)
 * - Events: Observations and actions (diagnostics, faults, measurements)
 * - Confidence: 0.0-1.0 score for each extraction
 * - Validation: Deterministic rules applied after LLM extraction
 */

// ============================================
// Base Types
// ============================================

/**
 * Confidence level for extracted information
 */
export type ConfidenceLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

/**
 * Extraction method used
 */
export type ExtractionMethod =
  | 'exact_match'        // Direct catalog match
  | 'fuzzy_match'        // Alias or close match
  | 'inferred'           // Derived from context
  | 'llm_extracted'      // LLM interpretation
  | 'user_confirmed';    // Engineer manually confirmed

/**
 * Base extraction metadata
 */
export interface ExtractionMetadata {
  /** Original text from transcript */
  raw_text: string;

  /** Confidence score (0.0 - 1.0) */
  confidence: number;

  /** Confidence level category */
  confidence_level: ConfidenceLevel;

  /** Whether this needs engineer confirmation */
  needs_confirmation: boolean;

  /** How this was extracted */
  extraction_method: ExtractionMethod;

  /** Timestamp of extraction */
  extracted_at: Date;

  /** Alternative interpretations if ambiguous */
  alternatives?: Array<{
    value: any;
    confidence: number;
    reason: string;
  }>;

  /** Notes about the extraction */
  notes?: string;
}

// ============================================
// Entity Types
// ============================================

/**
 * Boiler entity
 */
export interface BoilerEntity {
  type: 'boiler';

  /** Manufacturer name (normalized) */
  make: string;

  /** Model name/number */
  model?: string;

  /** Boiler type */
  boiler_type?: 'combi' | 'system' | 'regular' | 'back_boiler' | 'other';

  /** Age in years */
  age?: number;

  /** Current condition */
  condition?: 'working' | 'faulty' | 'condemned' | 'unknown';

  /** Output in kW */
  output_kw?: number;

  /** Fuel type */
  fuel_type?: 'gas' | 'oil' | 'electric' | 'lpg' | 'other';

  /** Link to GC product catalog */
  gc_product_id?: number;

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Control system entity
 */
export interface ControlSystemEntity {
  type: 'control_system';

  /** System type (normalized) */
  system_type:
    | 's_plan'           // S-Plan (zone valves)
    | 'y_plan'           // Y-Plan (3-port valve)
    | 'c_plan'           // C-Plan (gravity HW)
    | 'w_plan'           // W-Plan (combi to existing system)
    | 'combination'      // Multiple systems
    | 'unknown';

  /** Human-readable name */
  name: string;

  /** Key components in this system */
  components: string[];

  /** Wiring configuration notes */
  wiring_notes?: string;

  /** Link to wiring diagram */
  wiring_diagram_url?: string;

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Component entity (valves, cylinders, pumps, etc.)
 */
export interface ComponentEntity {
  type: 'component';

  /** Component type */
  component_type:
    | 'cylinder'
    | 'prv'                    // Pressure Relief Valve
    | 'expansion_vessel'
    | 'zone_valve'
    | '3_port_valve'
    | '2_port_valve'
    | 'pump'
    | 'thermostat'
    | 'cylinder_stat'
    | 'room_stat'
    | 'programmer'
    | 'radiator'
    | 'trv'                    // Thermostatic Radiator Valve
    | 'filling_loop'
    | 'filter'
    | 'other';

  /** Human-readable name */
  name: string;

  /** Location in system */
  location?: string;

  /** Current state/condition */
  state?:
    | 'working'
    | 'faulty'
    | 'leaking'
    | 'discharging'
    | 'stuck_open'
    | 'stuck_closed'
    | 'calling'              // For stats
    | 'satisfied'            // For stats
    | 'unknown';

  /** Make/brand if known */
  make?: string;

  /** Model if known */
  model?: string;

  /** Capacity (for cylinders, expansion vessels) */
  capacity?: {
    value: number;
    unit: 'litres' | 'gallons';
  };

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Fault code entity
 */
export interface FaultCodeEntity {
  type: 'fault_code';

  /** Fault code identifier */
  code: string;

  /** Human-readable description */
  description?: string;

  /** Associated boiler (if known) */
  boiler?: {
    make: string;
    model?: string;
  };

  /** Severity */
  severity?: 'info' | 'warning' | 'error' | 'critical';

  /** Common causes */
  common_causes?: string[];

  /** Recommended checks */
  recommended_checks?: string[];

  /** Link to documentation */
  documentation_url?: string;

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Measurement entity
 */
export interface MeasurementEntity {
  type: 'measurement';

  /** What was measured */
  measurement_type:
    | 'pressure'
    | 'temperature'
    | 'flow_rate'
    | 'pipe_size'
    | 'voltage'
    | 'current'
    | 'resistance'
    | 'dimension'
    | 'other';

  /** Measured value */
  value: number;

  /** Unit of measurement */
  unit: string;

  /** Location of measurement */
  location?: string;

  /** Context (e.g., "system pressure", "flow temperature") */
  context?: string;

  /** Expected range for comparison */
  expected_range?: {
    min: number;
    max: number;
    unit: string;
  };

  /** Whether value is within expected range */
  is_normal?: boolean;

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Material/Part entity
 */
export interface MaterialEntity {
  type: 'material';

  /** Material/part name */
  name: string;

  /** Category */
  category?: 'pipe' | 'fitting' | 'valve' | 'electrical' | 'chemical' | 'consumable' | 'other';

  /** Quantity needed */
  quantity?: number;

  /** Unit */
  unit?: string;

  /** Size/specification */
  specification?: string;

  /** Link to GC catalog */
  gc_product_id?: number;

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Union type of all entities
 */
export type Entity =
  | BoilerEntity
  | ControlSystemEntity
  | ComponentEntity
  | FaultCodeEntity
  | MeasurementEntity
  | MaterialEntity;

// ============================================
// Event Types
// ============================================

/**
 * Diagnostic observation event
 */
export interface DiagnosticObservationEvent {
  type: 'diagnostic_observation';

  /** What was observed */
  observation: string;

  /** Severity of the observation */
  severity: 'info' | 'minor' | 'moderate' | 'serious' | 'critical';

  /** Components involved */
  components_involved: string[];

  /** What this might indicate */
  possible_causes?: string[];

  /** Suggested diagnostic checks */
  suggested_checks?: string[];

  /** Whether this requires immediate action */
  requires_immediate_action: boolean;

  /** Related fault codes if any */
  related_fault_codes?: string[];

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Fault reported event
 */
export interface FaultReportedEvent {
  type: 'fault_reported';

  /** Description of the fault */
  description: string;

  /** Fault category */
  category:
    | 'no_heat'
    | 'no_hot_water'
    | 'intermittent'
    | 'noise'
    | 'leak'
    | 'overheat'
    | 'pressure_loss'
    | 'electrical'
    | 'other';

  /** When it occurs */
  occurs_when?: string;

  /** How long it's been happening */
  duration?: string;

  /** Severity */
  severity: 'minor' | 'moderate' | 'serious' | 'critical';

  /** Customer impact */
  customer_impact: 'none' | 'inconvenience' | 'no_heat' | 'no_hw' | 'both' | 'safety_issue';

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Measurement taken event
 */
export interface MeasurementTakenEvent {
  type: 'measurement_taken';

  /** What was measured */
  measurement: string;

  /** Value and unit */
  value: number;
  unit: string;

  /** Location */
  location?: string;

  /** Whether this is normal */
  is_normal: boolean;

  /** Expected range */
  expected_range?: {
    min: number;
    max: number;
  };

  /** Implications if abnormal */
  implications?: string;

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Action taken event
 */
export interface ActionTakenEvent {
  type: 'action_taken';

  /** What action was taken */
  action: string;

  /** Why it was taken */
  reason?: string;

  /** Result/outcome */
  outcome?: 'successful' | 'unsuccessful' | 'partial' | 'pending';

  /** Components affected */
  components_affected?: string[];

  /** Follow-up required */
  follow_up_required: boolean;

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Control logic observation event
 */
export interface ControlLogicEvent {
  type: 'control_logic';

  /** What's happening */
  observation: string;

  /** Expected behavior */
  expected_behavior: string;

  /** Actual behavior */
  actual_behavior: string;

  /** Mismatch type */
  mismatch_type:
    | 'stat_calling_no_heat'
    | 'demand_but_no_ignition'
    | 'valve_not_operating'
    | 'pump_not_running'
    | 'wiring_issue'
    | 'other';

  /** Components to check */
  components_to_check: string[];

  /** Terminal checks needed */
  terminal_checks?: Array<{
    terminal: string;
    expected_state: string;
    location: string;
  }>;

  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Union type of all events
 */
export type Event =
  | DiagnosticObservationEvent
  | FaultReportedEvent
  | MeasurementTakenEvent
  | ActionTakenEvent
  | ControlLogicEvent;

// ============================================
// Extraction Result
// ============================================

/**
 * Complete extraction result from Rocky v2
 */
export interface EntityEventExtraction {
  /** Unique extraction ID */
  id: string;

  /** Session ID this belongs to */
  session_id: number;

  /** Timestamp */
  extracted_at: Date;

  /** Input transcript */
  raw_transcript: string;

  /** Normalized transcript */
  normalized_transcript: string;

  /** Extracted entities */
  entities: Entity[];

  /** Extracted events */
  events: Event[];

  /** Overall extraction confidence */
  overall_confidence: number;

  /** Number of items needing confirmation */
  items_needing_confirmation: number;

  /** Extraction metadata */
  extraction_metadata: {
    /** LLM provider used */
    llm_provider?: string;

    /** LLM model */
    llm_model?: string;

    /** Processing time in ms */
    processing_time_ms: number;

    /** Validation results */
    validation_results: {
      entities_validated: number;
      entities_rejected: number;
      events_validated: number;
      events_rejected: number;
      warnings: string[];
    };
  };
}

// ============================================
// Confidence Calculation Helpers
// ============================================

/**
 * Convert numeric confidence (0.0-1.0) to confidence level
 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.9) return 'very_high';
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.5) return 'medium';
  if (confidence >= 0.25) return 'low';
  return 'very_low';
}

/**
 * Determine if an extraction needs confirmation
 */
export function needsConfirmation(
  confidence: number,
  extraction_method: ExtractionMethod
): boolean {
  // User-confirmed items never need confirmation again
  if (extraction_method === 'user_confirmed') return false;

  // Exact matches with high confidence don't need confirmation
  if (extraction_method === 'exact_match' && confidence >= 0.95) return false;

  // Everything else with confidence < 0.9 needs confirmation
  return confidence < 0.9;
}

/**
 * Calculate overall confidence for an extraction result
 */
export function calculateOverallConfidence(
  entities: Entity[],
  events: Event[]
): number {
  const allItems = [...entities, ...events];
  if (allItems.length === 0) return 0;

  const totalConfidence = allItems.reduce(
    (sum, item) => sum + item.metadata.confidence,
    0
  );

  return totalConfidence / allItems.length;
}

// ============================================
// Validation Types
// ============================================

/**
 * Validation metadata attached to entities after validation
 */
export interface ValidationMeta {
  /** Whether validation passed */
  passed: boolean;

  /** Confidence boost/penalty from validation */
  confidence_adjustment: number;

  /** Final adjusted confidence after validation */
  final_confidence: number;

  /** Validation warnings */
  warnings: string[];

  /** Validation errors */
  errors: string[];

  /** Catalog match info */
  catalog_match?: {
    matched: boolean;
    match_type: 'exact' | 'alias' | 'fuzzy' | 'none';
    matched_value?: any;
  };

  /** When validation occurred */
  validated_at: Date;

  /** Schema version used for validation */
  schema_version: string;
}

/**
 * Generic wrapper type for validated entities
 * Avoids TypeScript error from extending union types
 */
export type Validated<T extends Entity> = T & { validation: ValidationMeta };

/**
 * Validated entity union type
 */
export type ValidatedEntity = Validated<Entity>;

/**
 * Validation result for an entity or event
 */
export interface ValidationResult {
  valid: boolean;
  confidence_adjustment?: number; // Adjust confidence up or down
  warnings?: string[];
  errors?: string[];
  suggested_alternative?: any;
}

/**
 * Entity validator interface
 */
export interface EntityValidator {
  /** Validate against product catalog */
  validateAgainstCatalog(entity: Entity): ValidationResult;

  /** Validate internal consistency */
  validateConsistency(entity: Entity, context: any): ValidationResult;

  /** Suggest alternatives if validation fails */
  suggestAlternatives(entity: Entity): any[];
}

/**
 * Event validator interface
 */
export interface EventValidator {
  /** Validate event logic */
  validateLogic(event: Event, entities: Entity[]): ValidationResult;

  /** Check if event makes sense given extracted entities */
  validateContextConsistency(event: Event, context: any): ValidationResult;
}
