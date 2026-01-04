/**
 * Job Graph Types
 *
 * Core types for the orchestration spine that turns captured data into defensible outputs.
 * Philosophy: "on-site decisions, human-first, AI assists."
 */

// ============================================
// Core Entities
// ============================================

/**
 * Job Graph Status
 */
export type JobGraphStatus =
  | 'in_progress'   // Actively capturing and processing data
  | 'ready_for_outputs' // All critical milestones complete, can generate outputs
  | 'complete'      // Outputs generated, job closed
  | 'blocked';      // Cannot proceed due to critical blockers

/**
 * Milestone Status
 */
export type MilestoneStatus =
  | 'pending'       // Not started
  | 'in_progress'   // Actively working on
  | 'complete'      // Successfully completed
  | 'blocked';      // Cannot complete due to missing data or conflicts

/**
 * Confidence Level (0-100)
 * - 0-30: Low confidence, needs verification
 * - 31-70: Medium confidence, AI-extracted or estimated
 * - 71-100: High confidence, engineer-verified or measured
 */
export type Confidence = number;

/**
 * Job Graph - The main orchestration state for a visit
 */
export interface JobGraph {
  id: string;
  visitId: string;
  propertyId: string;
  status: JobGraphStatus;
  overallConfidence: Confidence;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Milestone - A key progress checkpoint in the survey/specification process
 * Examples: "Heating system specified", "Electrical capacity confirmed", "Flue route validated"
 */
export interface Milestone {
  id: string;
  jobGraphId: string;
  key: string; // Unique identifier like "heating_system_spec"
  label: string; // Human-readable: "Heating System Specification"
  status: MilestoneStatus;
  confidence: Confidence;
  blockers: string[]; // Human-readable blocker descriptions
  metadata?: Record<string, unknown>;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fact Category - Logical grouping of facts
 */
export type FactCategory =
  | 'property'      // Building characteristics
  | 'existing_system' // Current heating/electrical/gas setup
  | 'electrical'    // Electrical infrastructure
  | 'gas'          // Gas supply and pipework
  | 'water'        // Water supply and pressure
  | 'structure'    // Structural elements (walls, roof, etc.)
  | 'access'       // Access routes and constraints
  | 'measurements' // Physical measurements
  | 'regulatory'   // Regulatory requirements
  | 'customer'     // Customer requirements and preferences
  | 'hazards'      // Safety hazards and risks
  | 'other';

/**
 * Fact Extraction Source
 */
export type FactSource =
  | 'ai'           // AI-extracted from voice/images
  | 'manual'       // Engineer manually entered
  | 'measurement'  // From measurement tools (LiDAR, thermal, etc.)
  | 'calculation'  // Calculated from other facts
  | 'lookup';      // From external data source

/**
 * Fact - A piece of information extracted from captured data
 */
export interface Fact {
  id: string;
  jobGraphId: string;
  sourceEventId?: string; // Reference to timeline event it came from
  category: FactCategory;
  key: string; // e.g., "boiler_age", "main_fuse_rating"
  value: unknown; // The actual data (string, number, boolean, object)
  unit?: string; // For measurements: "A", "mm", "kW", etc.
  confidence: Confidence;
  extractedBy: FactSource;
  notes?: string;
  createdAt: Date;
}

/**
 * Decision Type
 */
export type DecisionType =
  | 'system_selection'     // Which system/equipment to install
  | 'compliance'           // Regulatory compliance decision
  | 'upgrade_path'         // Upgrade or modification required
  | 'specification'        // Technical specification choice
  | 'risk_mitigation'      // How to handle identified risks
  | 'customer_option';     // Customer choice between options

/**
 * Decision - A choice made with evidence and reasoning
 */
export interface Decision {
  id: string;
  jobGraphId: string;
  milestoneId?: string; // Which milestone this supports
  decisionType: DecisionType;
  decision: string; // The actual decision made
  reasoning: string; // Why this decision was made
  ruleApplied?: RuleReference; // Which rule/standard applied
  evidenceFactIds: string[]; // Links to supporting facts
  confidence: Confidence;
  risks: string[]; // Known risks/assumptions
  createdAt: Date;
  createdBy: 'ai' | 'engineer' | 'system';
}

/**
 * Rule Reference - Points to a specific regulation or manufacturer instruction
 */
export interface RuleReference {
  source: RuleSource;
  standard: string; // e.g., "BS 5440-1:2008", "Worcester Bosch Greenstar 8000"
  section?: string; // e.g., "Section 4.3", "Page 12"
  description: string; // Human-readable rule description
  restrictiveness?: 'more' | 'less' | 'equal'; // Compared to Building Regs
}

/**
 * Rule Source - Where the rule comes from
 */
export type RuleSource =
  | 'manufacturer_instructions' // MI - ALWAYS takes precedence when more restrictive
  | 'building_regulations'      // UK Building Regs
  | 'bs_standard'               // British Standard
  | 'hsg_guidance'              // HSE Guidance
  | 'industry_best_practice'    // Industry standards
  | 'local_authority';          // Local planning/building control

/**
 * Conflict Type
 */
export type ConflictType =
  | 'mi_vs_regs'           // Manufacturer Instructions conflict with Building Regs
  | 'fact_contradiction'   // Two facts contradict each other
  | 'validation_failure'   // Fails regulatory validation
  | 'incompatibility'      // Components/systems incompatible
  | 'missing_data'         // Critical data missing
  | 'risk_unmitigated';    // Identified risk without mitigation

/**
 * Conflict Severity
 */
export type ConflictSeverity =
  | 'critical'  // Blocks progress, must be resolved
  | 'warning'   // Should be addressed, but can proceed
  | 'info';     // Informational, no action required

/**
 * Conflict - A detected issue that needs resolution
 */
export interface Conflict {
  id: string;
  jobGraphId: string;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  description: string; // Human-readable explanation
  rule1?: RuleReference; // First conflicting rule
  rule2?: RuleReference; // Second conflicting rule
  resolution?: string; // How to resolve (populated when resolved)
  affectedFactIds: string[];
  affectedDecisionIds: string[];
  resolvedAt?: Date;
  createdAt: Date;
}

// ============================================
// Validator Types
// ============================================

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  conflicts: Conflict[];
  warnings: string[];
  recommendations: string[];
}

/**
 * Validator Interface
 * Each regulatory standard implements this
 */
export interface Validator {
  name: string;
  standard: string;
  validate: (facts: Fact[], decisions: Decision[]) => ValidationResult;
}

// ============================================
// Milestone Definitions
// ============================================

/**
 * Standard Milestones
 * These are the common milestones tracked across most jobs
 */
export enum StandardMilestone {
  // Property Assessment
  PROPERTY_SURVEYED = 'property_surveyed',
  EXISTING_SYSTEM_ASSESSED = 'existing_system_assessed',

  // Technical Specifications
  HEATING_SYSTEM_SPEC = 'heating_system_spec',
  ELECTRICAL_CAPACITY_CONFIRMED = 'electrical_capacity_confirmed',
  GAS_SUPPLY_ASSESSED = 'gas_supply_assessed',
  WATER_SUPPLY_ASSESSED = 'water_supply_assessed',
  FLUE_ROUTE_VALIDATED = 'flue_route_validated',

  // Customer Requirements
  CUSTOMER_REQUIREMENTS_CAPTURED = 'customer_requirements_captured',
  BUDGET_DISCUSSED = 'budget_discussed',

  // Compliance
  BUILDING_REGS_CHECKED = 'building_regs_checked',
  MANUFACTURER_INSTRUCTIONS_CHECKED = 'manufacturer_instructions_checked',
  HAZARDS_IDENTIFIED = 'hazards_identified',

  // Outputs
  QUOTE_OPTIONS_GENERATED = 'quote_options_generated',
  PDF_REPORT_READY = 'pdf_report_ready',
  CUSTOMER_PORTAL_READY = 'customer_portal_ready'
}

/**
 * Milestone Definition - Template for creating milestones
 */
export interface MilestoneDefinition {
  key: string;
  label: string;
  description: string;
  requiredFactCategories: FactCategory[];
  criticalityLevel: 'critical' | 'important' | 'optional';
  dependencies: string[]; // Other milestone keys that must complete first
}

// ============================================
// Utility Types
// ============================================

/**
 * Job Graph Summary - Lightweight view for dashboards
 */
export interface JobGraphSummary {
  id: string;
  visitId: string;
  propertyId: string;
  status: JobGraphStatus;
  overallConfidence: Confidence;
  completedMilestones: number;
  totalMilestones: number;
  criticalConflicts: number;
  warningConflicts: number;
  updatedAt: Date;
}

/**
 * Evidence Trail - Links decision back to source data
 */
export interface EvidenceTrail {
  decision: Decision;
  facts: Fact[];
  sourceEvents: Array<{
    eventId: string;
    type: string;
    timestamp: Date;
  }>;
}

/**
 * Completeness Assessment
 */
export interface CompletenessAssessment {
  overallPercentage: number;
  readyForQuote: boolean;
  readyForPDF: boolean;
  readyForPortal: boolean;
  missingCriticalFacts: Array<{
    category: FactCategory;
    key: string;
    description: string;
  }>;
  unresolvedConflicts: Conflict[];
}
