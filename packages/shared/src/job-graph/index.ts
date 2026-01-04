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
export * from './types';

// Milestone Management
export * from './milestones';
export { MilestoneTracker } from './milestoneTracker';

// Conflict Detection
export { ConflictEngine, RuleComparator } from './conflictEngine';

// Decision Recording
export {
  DecisionRecorder,
  DecisionBuilder,
  CommonDecisionPatterns,
} from './decisionRecorder';

// Validators
export * from './validators';

// Main Orchestrator
export {
  JobGraphOrchestrator,
  createJobGraph,
} from './jobGraph';

export type { JobGraphState } from './jobGraph';

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
} from './types';
