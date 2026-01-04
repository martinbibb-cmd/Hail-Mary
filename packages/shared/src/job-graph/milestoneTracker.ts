/**
 * Milestone Tracker
 *
 * Manages milestone status, confidence, and blockers
 * Tracks progress toward job completion
 */

import {
  Milestone,
  MilestoneStatus,
  Confidence,
  Fact,
  Decision,
  Conflict,
  FactCategory,
} from './types';
import { MILESTONE_DEFINITIONS, canStartMilestone } from './milestones';

/**
 * Milestone Progress
 */
export interface MilestoneProgress {
  milestone: Milestone;
  canStart: boolean;
  canComplete: boolean;
  missingRequirements: string[];
  blockingConflicts: Conflict[];
  confidenceFactors: Array<{
    factor: string;
    impact: number; // -100 to +100
    reason: string;
  }>;
}

/**
 * Milestone Tracker - Manages milestone lifecycle
 */
export class MilestoneTracker {
  private jobGraphId: string;

  constructor(jobGraphId: string) {
    this.jobGraphId = jobGraphId;
  }

  /**
   * Create a new milestone
   */
  createMilestone(key: string): Milestone {
    const definition = MILESTONE_DEFINITIONS[key];
    if (!definition) {
      throw new Error(`Unknown milestone: ${key}`);
    }

    return {
      id: this.generateId(),
      jobGraphId: this.jobGraphId,
      key: definition.key,
      label: definition.label,
      status: 'pending',
      confidence: 0,
      blockers: [],
      metadata: {
        description: definition.description,
        criticalityLevel: definition.criticalityLevel,
        requiredFactCategories: definition.requiredFactCategories,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Update milestone status
   */
  updateMilestoneStatus(
    milestone: Milestone,
    status: MilestoneStatus,
    confidence?: Confidence
  ): Milestone {
    return {
      ...milestone,
      status,
      confidence: confidence ?? milestone.confidence,
      completedAt: status === 'complete' ? new Date() : milestone.completedAt,
      updatedAt: new Date(),
    };
  }

  /**
   * Add blocker to milestone
   */
  addBlocker(milestone: Milestone, blocker: string): Milestone {
    const blockers = [...new Set([...milestone.blockers, blocker])];
    return {
      ...milestone,
      blockers,
      status: blockers.length > 0 ? 'blocked' : milestone.status,
      updatedAt: new Date(),
    };
  }

  /**
   * Remove blocker from milestone
   */
  removeBlocker(milestone: Milestone, blocker: string): Milestone {
    const blockers = milestone.blockers.filter((b) => b !== blocker);
    return {
      ...milestone,
      blockers,
      status: blockers.length > 0 ? 'blocked' : 'in_progress',
      updatedAt: new Date(),
    };
  }

  /**
   * Calculate milestone progress
   */
  calculateProgress(
    milestone: Milestone,
    allMilestones: Milestone[],
    facts: Fact[],
    decisions: Decision[],
    conflicts: Conflict[]
  ): MilestoneProgress {
    const definition = MILESTONE_DEFINITIONS[milestone.key];
    if (!definition) {
      throw new Error(`Unknown milestone: ${milestone.key}`);
    }

    // Check if can start (dependencies complete)
    const completedMilestoneKeys = new Set(
      allMilestones.filter((m) => m.status === 'complete').map((m) => m.key)
    );
    const canStart = canStartMilestone(milestone.key, completedMilestoneKeys);

    // Check if can complete (all requirements met)
    const missingRequirements = this.getMissingRequirements(
      definition.requiredFactCategories,
      facts
    );
    const blockingConflicts = conflicts.filter(
      (c) => c.severity === 'critical' && !c.resolvedAt
    );
    const canComplete =
      canStart && missingRequirements.length === 0 && blockingConflicts.length === 0;

    // Calculate confidence factors
    const confidenceFactors = this.calculateConfidenceFactors(
      milestone,
      facts,
      decisions,
      conflicts
    );

    return {
      milestone,
      canStart,
      canComplete,
      missingRequirements,
      blockingConflicts,
      confidenceFactors,
    };
  }

  /**
   * Get missing requirements for milestone
   */
  private getMissingRequirements(
    requiredCategories: FactCategory[],
    facts: Fact[]
  ): string[] {
    const missing: string[] = [];
    const existingCategories = new Set(facts.map((f) => f.category));

    requiredCategories.forEach((category) => {
      if (!existingCategories.has(category)) {
        missing.push(`Missing facts for category: ${category}`);
      }
    });

    return missing;
  }

  /**
   * Calculate confidence factors
   * Factors that increase/decrease confidence in milestone completion
   */
  private calculateConfidenceFactors(
    milestone: Milestone,
    facts: Fact[],
    decisions: Decision[],
    conflicts: Conflict[]
  ): Array<{ factor: string; impact: number; reason: string }> {
    const factors: Array<{ factor: string; impact: number; reason: string }> = [];

    // Factor: Number of high-confidence facts
    const highConfidenceFacts = facts.filter((f) => f.confidence >= 70);
    const lowConfidenceFacts = facts.filter((f) => f.confidence < 40);

    if (highConfidenceFacts.length > 0) {
      factors.push({
        factor: 'High-confidence facts',
        impact: Math.min(30, highConfidenceFacts.length * 5),
        reason: `${highConfidenceFacts.length} facts verified by engineer or measurement`,
      });
    }

    if (lowConfidenceFacts.length > 0) {
      factors.push({
        factor: 'Low-confidence facts',
        impact: -Math.min(30, lowConfidenceFacts.length * 5),
        reason: `${lowConfidenceFacts.length} facts need verification`,
      });
    }

    // Factor: Engineer-verified decisions
    const engineerDecisions = decisions.filter((d) => d.createdBy === 'engineer');
    if (engineerDecisions.length > 0) {
      factors.push({
        factor: 'Engineer decisions',
        impact: 20,
        reason: `${engineerDecisions.length} decisions made by engineer`,
      });
    }

    // Factor: Unresolved conflicts
    const unresolvedConflicts = conflicts.filter((c) => !c.resolvedAt);
    if (unresolvedConflicts.length > 0) {
      const criticalConflicts = unresolvedConflicts.filter((c) => c.severity === 'critical');
      factors.push({
        factor: 'Unresolved conflicts',
        impact: -(criticalConflicts.length * 20 + (unresolvedConflicts.length - criticalConflicts.length) * 5),
        reason: `${criticalConflicts.length} critical, ${unresolvedConflicts.length - criticalConflicts.length} warnings`,
      });
    }

    // Factor: Blockers
    if (milestone.blockers.length > 0) {
      factors.push({
        factor: 'Active blockers',
        impact: -50,
        reason: `${milestone.blockers.length} blockers preventing completion`,
      });
    }

    // Factor: All requirements met
    const definition = MILESTONE_DEFINITIONS[milestone.key];
    if (definition) {
      const existingCategories = new Set(facts.map((f) => f.category));
      const allRequirementsMet = definition.requiredFactCategories.every((cat) =>
        existingCategories.has(cat)
      );

      if (allRequirementsMet) {
        factors.push({
          factor: 'All requirements met',
          impact: 20,
          reason: 'All required fact categories present',
        });
      }
    }

    return factors;
  }

  /**
   * Recalculate milestone confidence based on factors
   */
  recalculateConfidence(
    milestone: Milestone,
    facts: Fact[],
    decisions: Decision[],
    conflicts: Conflict[]
  ): Milestone {
    const factors = this.calculateConfidenceFactors(milestone, facts, decisions, conflicts);

    // Base confidence starts at 50
    let confidence = 50;

    // Apply all factors
    factors.forEach((f) => {
      confidence += f.impact;
    });

    // Clamp to 0-100
    confidence = Math.max(0, Math.min(100, confidence));

    return {
      ...milestone,
      confidence,
      updatedAt: new Date(),
    };
  }

  /**
   * Auto-update milestone status based on progress
   */
  autoUpdateStatus(
    milestone: Milestone,
    progress: MilestoneProgress
  ): Milestone {
    // If blocked, set to blocked
    if (milestone.blockers.length > 0 || progress.blockingConflicts.length > 0) {
      return this.updateMilestoneStatus(milestone, 'blocked');
    }

    // If can't start yet, keep pending
    if (!progress.canStart) {
      return this.updateMilestoneStatus(milestone, 'pending');
    }

    // If can complete and confidence is high, mark complete
    if (progress.canComplete && milestone.confidence >= 80) {
      return this.updateMilestoneStatus(milestone, 'complete');
    }

    // If working on it, mark in_progress
    if (progress.canStart && milestone.status === 'pending') {
      return this.updateMilestoneStatus(milestone, 'in_progress');
    }

    return milestone;
  }

  /**
   * Get overall job completion percentage
   */
  calculateOverallCompletion(milestones: Milestone[]): number {
    if (milestones.length === 0) return 0;

    const completedCount = milestones.filter((m) => m.status === 'complete').length;
    return Math.round((completedCount / milestones.length) * 100);
  }

  /**
   * Get overall confidence across all milestones
   */
  calculateOverallConfidence(milestones: Milestone[]): Confidence {
    if (milestones.length === 0) return 0;

    // Weight by criticality
    const criticalMilestones = milestones.filter(
      (m) => m.metadata?.criticalityLevel === 'critical'
    );
    const importantMilestones = milestones.filter(
      (m) => m.metadata?.criticalityLevel === 'important'
    );

    const criticalConfidence =
      criticalMilestones.length > 0
        ? criticalMilestones.reduce((sum, m) => sum + m.confidence, 0) /
          criticalMilestones.length
        : 100;

    const importantConfidence =
      importantMilestones.length > 0
        ? importantMilestones.reduce((sum, m) => sum + m.confidence, 0) /
          importantMilestones.length
        : 100;

    // Weight critical 70%, important 30%
    const overall = criticalConfidence * 0.7 + importantConfidence * 0.3;

    return Math.round(overall);
  }

  /**
   * Check if ready for outputs
   */
  isReadyForOutputs(milestones: Milestone[]): boolean {
    const criticalMilestones = milestones.filter(
      (m) => m.metadata?.criticalityLevel === 'critical'
    );

    // All critical milestones must be complete with high confidence
    return criticalMilestones.every(
      (m) => m.status === 'complete' && m.confidence >= 70
    );
  }

  /**
   * Generate unique ID (placeholder - should use UUID in production)
   */
  private generateId(): string {
    return `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
