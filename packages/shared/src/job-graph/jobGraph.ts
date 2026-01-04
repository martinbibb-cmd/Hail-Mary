/**
 * Job Graph Orchestrator
 *
 * Main orchestration layer that:
 * - Manages the lifecycle of a job from data capture to outputs
 * - Coordinates milestones, facts, decisions, and conflicts
 * - Runs validation and conflict detection
 * - Determines readiness for outputs
 */

import {
  JobGraph,
  JobGraphStatus,
  JobGraphSummary,
  Milestone,
  Fact,
  Decision,
  Conflict,
  Confidence,
  CompletenessAssessment,
  FactCategory,
} from './types';
import { MilestoneTracker } from './milestoneTracker';
import { ConflictEngine } from './conflictEngine';
import { DecisionRecorder } from './decisionRecorder';
import { MILESTONE_DEFINITIONS, StandardMilestone } from './milestones';
import { getAllValidators } from './validators';

/**
 * Job Graph State - Complete state of a job
 */
export interface JobGraphState {
  graph: JobGraph;
  milestones: Milestone[];
  facts: Fact[];
  decisions: Decision[];
  conflicts: Conflict[];
}

/**
 * Job Graph Orchestrator
 * Main class that manages the complete job lifecycle
 */
export class JobGraphOrchestrator {
  private jobGraphId: string;
  private visitId: string;
  private propertyId: string;

  private milestoneTracker: MilestoneTracker;
  private conflictEngine: ConflictEngine;
  private decisionRecorder: DecisionRecorder;

  constructor(jobGraphId: string, visitId: string, propertyId: string) {
    this.jobGraphId = jobGraphId;
    this.visitId = visitId;
    this.propertyId = propertyId;

    this.milestoneTracker = new MilestoneTracker(jobGraphId);
    this.conflictEngine = new ConflictEngine(jobGraphId);
    this.decisionRecorder = new DecisionRecorder(jobGraphId);
  }

  /**
   * Initialize a new job graph
   */
  initializeJobGraph(): JobGraph {
    return {
      id: this.jobGraphId,
      visitId: this.visitId,
      propertyId: this.propertyId,
      status: 'in_progress',
      overallConfidence: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Create standard milestones for a job
   */
  createStandardMilestones(): Milestone[] {
    const standardMilestoneKeys = [
      StandardMilestone.PROPERTY_SURVEYED,
      StandardMilestone.EXISTING_SYSTEM_ASSESSED,
      StandardMilestone.CUSTOMER_REQUIREMENTS_CAPTURED,
      StandardMilestone.HEATING_SYSTEM_SPEC,
      StandardMilestone.ELECTRICAL_CAPACITY_CONFIRMED,
      StandardMilestone.GAS_SUPPLY_ASSESSED,
      StandardMilestone.WATER_SUPPLY_ASSESSED,
      StandardMilestone.FLUE_ROUTE_VALIDATED,
      StandardMilestone.BUILDING_REGS_CHECKED,
      StandardMilestone.MANUFACTURER_INSTRUCTIONS_CHECKED,
      StandardMilestone.HAZARDS_IDENTIFIED,
      StandardMilestone.QUOTE_OPTIONS_GENERATED,
    ];

    return standardMilestoneKeys.map((key) =>
      this.milestoneTracker.createMilestone(key)
    );
  }

  /**
   * Add a fact to the job graph
   */
  addFact(
    category: FactCategory,
    key: string,
    value: unknown,
    options: {
      sourceEventId?: string;
      unit?: string;
      confidence?: Confidence;
      extractedBy?: 'ai' | 'manual' | 'measurement' | 'calculation' | 'lookup';
      notes?: string;
    } = {}
  ): Fact {
    return {
      id: this.generateId('fact'),
      jobGraphId: this.jobGraphId,
      category,
      key,
      value,
      sourceEventId: options.sourceEventId,
      unit: options.unit,
      confidence: options.confidence ?? 50,
      extractedBy: options.extractedBy ?? 'ai',
      notes: options.notes,
      createdAt: new Date(),
    };
  }

  /**
   * Process the complete job graph state
   * This is the main orchestration method
   */
  processJobGraphState(state: JobGraphState): {
    updatedState: JobGraphState;
    summary: JobGraphSummary;
    completeness: CompletenessAssessment;
  } {
    let { graph, milestones, facts, decisions, conflicts } = state;

    // 1. Run conflict detection
    const conflictResult = this.conflictEngine.detectConflicts(facts, decisions);
    conflicts = [...conflictResult.conflicts, ...conflictResult.resolvedConflicts];

    // 2. Run regulatory validation
    const validators = getAllValidators();
    validators.forEach((validator) => {
      const validationResult = validator.validate(facts, decisions);
      conflicts.push(...validationResult.conflicts);
    });

    // 3. Update milestone progress and confidence
    milestones = milestones.map((milestone) => {
      // Recalculate confidence
      let updated = this.milestoneTracker.recalculateConfidence(
        milestone,
        facts,
        decisions,
        conflicts
      );

      // Calculate progress
      const progress = this.milestoneTracker.calculateProgress(
        updated,
        milestones,
        facts,
        decisions,
        conflicts
      );

      // Auto-update status
      updated = this.milestoneTracker.autoUpdateStatus(updated, progress);

      // Update blockers based on conflicts
      const blockingConflicts = conflicts.filter(
        (c) => c.severity === 'critical' && !c.resolvedAt
      );
      blockingConflicts.forEach((conflict) => {
        updated = this.milestoneTracker.addBlocker(updated, conflict.description);
      });

      return updated;
    });

    // 4. Recalculate decision confidence based on facts
    decisions = decisions.map((decision) =>
      this.decisionRecorder.recalculateConfidence(decision, facts)
    );

    // 5. Update overall job graph status and confidence
    const overallConfidence = this.milestoneTracker.calculateOverallConfidence(milestones);
    const isReadyForOutputs = this.milestoneTracker.isReadyForOutputs(milestones);
    const hasBlockingConflicts = this.conflictEngine.getBlockingConflicts(conflicts).length > 0;

    let status: JobGraphStatus = graph.status;
    if (hasBlockingConflicts) {
      status = 'blocked';
    } else if (isReadyForOutputs) {
      status = 'ready_for_outputs';
    } else {
      status = 'in_progress';
    }

    graph = {
      ...graph,
      status,
      overallConfidence,
      updatedAt: new Date(),
    };

    // 6. Generate summary
    const summary = this.generateSummary(graph, milestones, conflicts);

    // 7. Generate completeness assessment
    const completeness = this.assessCompleteness(milestones, facts, conflicts);

    return {
      updatedState: { graph, milestones, facts, decisions, conflicts },
      summary,
      completeness,
    };
  }

  /**
   * Generate job graph summary
   */
  private generateSummary(
    graph: JobGraph,
    milestones: Milestone[],
    conflicts: Conflict[]
  ): JobGraphSummary {
    const completedMilestones = milestones.filter((m) => m.status === 'complete').length;
    const totalMilestones = milestones.length;
    const criticalConflicts = conflicts.filter(
      (c) => c.severity === 'critical' && !c.resolvedAt
    ).length;
    const warningConflicts = conflicts.filter(
      (c) => c.severity === 'warning' && !c.resolvedAt
    ).length;

    return {
      id: graph.id,
      visitId: graph.visitId,
      propertyId: graph.propertyId,
      status: graph.status,
      overallConfidence: graph.overallConfidence,
      completedMilestones,
      totalMilestones,
      criticalConflicts,
      warningConflicts,
      updatedAt: graph.updatedAt,
    };
  }

  /**
   * Assess completeness for outputs
   */
  private assessCompleteness(
    milestones: Milestone[],
    facts: Fact[],
    conflicts: Conflict[]
  ): CompletenessAssessment {
    const criticalMilestones = milestones.filter(
      (m) => m.metadata?.criticalityLevel === 'critical'
    );

    const completedCritical = criticalMilestones.filter(
      (m) => m.status === 'complete' && m.confidence >= 70
    );

    const overallPercentage = this.milestoneTracker.calculateOverallCompletion(milestones);

    const readyForQuote = completedCritical.length === criticalMilestones.length;
    const readyForPDF = readyForQuote;
    const readyForPortal = readyForQuote;

    // Find missing critical facts
    const missingCriticalFacts: Array<{
      category: FactCategory;
      key: string;
      description: string;
    }> = [];

    const criticalFactChecks = [
      { category: 'property' as FactCategory, key: 'property_type', description: 'Property type' },
      { category: 'existing_system' as FactCategory, key: 'boiler_type', description: 'Existing boiler type' },
      { category: 'electrical' as FactCategory, key: 'main_fuse_rating', description: 'Main fuse rating' },
      { category: 'gas' as FactCategory, key: 'meter_location', description: 'Gas meter location' },
      { category: 'customer' as FactCategory, key: 'budget', description: 'Customer budget' },
    ];

    const existingFacts = new Set(facts.map((f) => `${f.category}:${f.key}`));

    criticalFactChecks.forEach((check) => {
      if (!existingFacts.has(`${check.category}:${check.key}`)) {
        missingCriticalFacts.push(check);
      }
    });

    const unresolvedConflicts = conflicts.filter((c) => !c.resolvedAt);

    return {
      overallPercentage,
      readyForQuote,
      readyForPDF,
      readyForPortal,
      missingCriticalFacts,
      unresolvedConflicts,
    };
  }

  /**
   * Extract facts from timeline events
   * This would integrate with AI/ML to extract facts from photos, voice, etc.
   */
  extractFactsFromEvent(
    event: {
      eventId: string;
      type: string;
      payload: Record<string, unknown>;
    },
    extractionMethod: 'ai' | 'manual' = 'ai'
  ): Fact[] {
    // Placeholder - in real implementation this would call AI services
    // to extract facts from photos, voice transcripts, etc.

    const extractedFacts: Fact[] = [];

    // Example: If event is a photo of a boiler nameplate
    if (event.type === 'photo' && event.payload.caption?.toString().toLowerCase().includes('boiler')) {
      // AI would extract: make, model, serial number, kW rating, etc.
      // For now, placeholder
    }

    // Example: If event is a voice transcript
    if (event.type === 'voice' && event.payload.text) {
      // AI would extract facts from spoken words
      // For now, placeholder
    }

    return extractedFacts;
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get milestone tracker
   */
  getMilestoneTracker(): MilestoneTracker {
    return this.milestoneTracker;
  }

  /**
   * Get conflict engine
   */
  getConflictEngine(): ConflictEngine {
    return this.conflictEngine;
  }

  /**
   * Get decision recorder
   */
  getDecisionRecorder(): DecisionRecorder {
    return this.decisionRecorder;
  }
}

/**
 * Factory function to create a new job graph
 */
export function createJobGraph(
  jobGraphId: string,
  visitId: string,
  propertyId: string
): {
  orchestrator: JobGraphOrchestrator;
  initialState: JobGraphState;
} {
  const orchestrator = new JobGraphOrchestrator(jobGraphId, visitId, propertyId);

  const graph = orchestrator.initializeJobGraph();
  const milestones = orchestrator.createStandardMilestones();

  const initialState: JobGraphState = {
    graph,
    milestones,
    facts: [],
    decisions: [],
    conflicts: [],
  };

  return { orchestrator, initialState };
}
