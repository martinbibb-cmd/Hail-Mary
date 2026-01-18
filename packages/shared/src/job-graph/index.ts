/**
 * Job Graph Module
 *
 * The orchestration spine that turns captured data into defensible outputs.
 *
 * Architecture:
 * - Milestones: Track progress with status/confidence/blockers
 * - Facts: Information extracted from timeline events
 * - Decisions: Choices made with evidence and reasoning
 * - Conflicts: Detected issues (MI vs Regs, contradictions, etc.)
 * - Validators: Regulatory compliance (BS 5440, BS 7671, HSG264, MI)
 *
 * Key Principle: "Manufacturer Instructions > Building Regs when more restrictive"
 */

// Core Types
export * from './types.js';

// Milestone Management
export * from './milestones.js';
export { MilestoneTracker } from './milestoneTracker.js';

// Conflict Detection
export { ConflictEngine, RuleComparator } from './conflictEngine.js';

// Decision Recording
export {
  DecisionRecorder,
  DecisionBuilder,
  CommonDecisionPatterns,
} from './decisionRecorder.js';

// Validators
export * from './validators/index.js';

// Main Orchestrator
export {
  JobGraphOrchestrator,
  createJobGraph,
} from './jobGraph.js';

export type { JobGraphState } from './jobGraph.js';

// Re-export commonly used types for convenience
export type {
  JobGraph,
  Milestone,
  Fact,
  Decision,
  Conflict,
  RuleReference,
  ValidationResult,
  CompletenessAssessment,
  JobGraphSummary,
  EvidenceTrail,
  RuleSource,
} from './types.js';
