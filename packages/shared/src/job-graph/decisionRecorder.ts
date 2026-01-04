/**
 * Decision Recorder
 *
 * Records decisions with complete evidence trails
 * Links decisions back to facts and timeline events
 */

import {
  Decision,
  DecisionType,
  Fact,
  RuleReference,
  Confidence,
  EvidenceTrail,
} from './types';

/**
 * Decision Builder - Fluent API for creating decisions
 */
export class DecisionBuilder {
  private decision: Partial<Decision>;

  constructor(jobGraphId: string) {
    this.decision = {
      id: this.generateId(),
      jobGraphId,
      evidenceFactIds: [],
      risks: [],
      createdAt: new Date(),
      createdBy: 'system',
    };
  }

  /**
   * Set decision type
   */
  type(decisionType: DecisionType): this {
    this.decision.decisionType = decisionType;
    return this;
  }

  /**
   * Set the decision text
   */
  decide(decision: string): this {
    this.decision.decision = decision;
    return this;
  }

  /**
   * Set reasoning
   */
  because(reasoning: string): this {
    this.decision.reasoning = reasoning;
    return this;
  }

  /**
   * Link to milestone
   */
  forMilestone(milestoneId: string): this {
    this.decision.milestoneId = milestoneId;
    return this;
  }

  /**
   * Set rule applied
   */
  applyingRule(rule: RuleReference): this {
    this.decision.ruleApplied = rule;
    return this;
  }

  /**
   * Add evidence facts
   */
  basedOn(...factIds: string[]): this {
    this.decision.evidenceFactIds = [
      ...(this.decision.evidenceFactIds || []),
      ...factIds,
    ];
    return this;
  }

  /**
   * Set confidence
   */
  withConfidence(confidence: Confidence): this {
    this.decision.confidence = confidence;
    return this;
  }

  /**
   * Add risk/assumption
   */
  withRisk(risk: string): this {
    this.decision.risks = [...(this.decision.risks || []), risk];
    return this;
  }

  /**
   * Set who created the decision
   */
  by(creator: 'ai' | 'engineer' | 'system'): this {
    this.decision.createdBy = creator;
    return this;
  }

  /**
   * Build the decision
   */
  build(): Decision {
    // Validate required fields
    if (!this.decision.decisionType) {
      throw new Error('Decision type is required');
    }
    if (!this.decision.decision) {
      throw new Error('Decision text is required');
    }
    if (!this.decision.reasoning) {
      throw new Error('Reasoning is required');
    }
    if (this.decision.confidence === undefined) {
      throw new Error('Confidence is required');
    }

    return this.decision as Decision;
  }

  /**
   * Generate unique ID (placeholder - should use UUID in production)
   */
  private generateId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Decision Recorder - Manages decision lifecycle
 */
export class DecisionRecorder {
  private jobGraphId: string;

  constructor(jobGraphId: string) {
    this.jobGraphId = jobGraphId;
  }

  /**
   * Create a new decision builder
   */
  createDecision(): DecisionBuilder {
    return new DecisionBuilder(this.jobGraphId);
  }

  /**
   * Record a decision
   */
  record(decision: Decision): Decision {
    // In a real implementation, this would save to database
    return {
      ...decision,
      createdAt: new Date(),
    };
  }

  /**
   * Build evidence trail for a decision
   */
  buildEvidenceTrail(
    decision: Decision,
    facts: Fact[],
    timelineEvents: Array<{ eventId: string; type: string; timestamp: Date }>
  ): EvidenceTrail {
    // Get all facts referenced in decision
    const evidenceFacts = facts.filter((f) =>
      decision.evidenceFactIds.includes(f.id)
    );

    // Get timeline events that sourced those facts
    const evidenceFactEventIds = new Set(
      evidenceFacts.map((f) => f.sourceEventId).filter(Boolean) as string[]
    );

    const sourceEvents = timelineEvents.filter((e) =>
      evidenceFactEventIds.has(e.eventId)
    );

    return {
      decision,
      facts: evidenceFacts,
      sourceEvents,
    };
  }

  /**
   * Calculate decision confidence based on evidence
   */
  calculateConfidence(decision: Decision, facts: Fact[]): Confidence {
    if (decision.evidenceFactIds.length === 0) {
      return 20; // Low confidence - no evidence
    }

    // Get evidence facts
    const evidenceFacts = facts.filter((f) =>
      decision.evidenceFactIds.includes(f.id)
    );

    if (evidenceFacts.length === 0) {
      return 30; // Low confidence - referenced facts not found
    }

    // Average confidence of evidence facts
    const avgFactConfidence =
      evidenceFacts.reduce((sum, f) => sum + f.confidence, 0) /
      evidenceFacts.length;

    // Boost if created by engineer
    const creatorBoost = decision.createdBy === 'engineer' ? 20 : 0;

    // Boost if rule is from MI
    const ruleBoost =
      decision.ruleApplied?.source === 'manufacturer_instructions' ? 10 : 0;

    // Penalty for risks
    const riskPenalty = decision.risks.length * 5;

    const confidence = Math.round(
      avgFactConfidence + creatorBoost + ruleBoost - riskPenalty
    );

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Validate decision has sufficient evidence
   */
  validateEvidence(decision: Decision, facts: Fact[]): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check has evidence
    if (decision.evidenceFactIds.length === 0) {
      issues.push('Decision has no supporting evidence');
    }

    // Check evidence facts exist
    const evidenceFacts = facts.filter((f) =>
      decision.evidenceFactIds.includes(f.id)
    );

    if (evidenceFacts.length < decision.evidenceFactIds.length) {
      issues.push('Some referenced evidence facts not found');
    }

    // Check evidence confidence
    const lowConfidenceFacts = evidenceFacts.filter((f) => f.confidence < 40);
    if (lowConfidenceFacts.length > 0) {
      issues.push(
        `${lowConfidenceFacts.length} evidence facts have low confidence`
      );
    }

    // Check for contradictory evidence
    const factsByKey = new Map<string, Fact[]>();
    evidenceFacts.forEach((f) => {
      const key = `${f.category}:${f.key}`;
      const existing = factsByKey.get(key) || [];
      existing.push(f);
      factsByKey.set(key, existing);
    });

    factsByKey.forEach((keyFacts) => {
      if (keyFacts.length > 1) {
        const values = new Set(keyFacts.map((f) => JSON.stringify(f.value)));
        if (values.size > 1) {
          issues.push(`Contradictory evidence for ${keyFacts[0].category}:${keyFacts[0].key}`);
        }
      }
    });

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Find decisions that depend on a fact
   */
  findDependentDecisions(factId: string, decisions: Decision[]): Decision[] {
    return decisions.filter((d) => d.evidenceFactIds.includes(factId));
  }

  /**
   * Update decision confidence when evidence changes
   */
  recalculateConfidence(decision: Decision, facts: Fact[]): Decision {
    const newConfidence = this.calculateConfidence(decision, facts);
    return {
      ...decision,
      confidence: newConfidence,
    };
  }

  /**
   * Add risk to decision
   */
  addRisk(decision: Decision, risk: string): Decision {
    return {
      ...decision,
      risks: [...new Set([...decision.risks, risk])],
    };
  }

  /**
   * Remove risk from decision
   */
  removeRisk(decision: Decision, risk: string): Decision {
    return {
      ...decision,
      risks: decision.risks.filter((r) => r !== risk),
    };
  }
}

/**
 * Common Decision Patterns
 * Pre-built decision templates for common scenarios
 */
export class CommonDecisionPatterns {
  /**
   * System Selection Decision
   */
  static systemSelection(
    jobGraphId: string,
    systemType: string,
    reasoning: string,
    evidenceFactIds: string[],
    confidence: Confidence
  ): Decision {
    return new DecisionBuilder(jobGraphId)
      .type('system_selection')
      .decide(`Install ${systemType}`)
      .because(reasoning)
      .basedOn(...evidenceFactIds)
      .withConfidence(confidence)
      .by('ai')
      .build();
  }

  /**
   * Compliance Decision
   */
  static compliance(
    jobGraphId: string,
    requirement: string,
    rule: RuleReference,
    evidenceFactIds: string[],
    confidence: Confidence
  ): Decision {
    return new DecisionBuilder(jobGraphId)
      .type('compliance')
      .decide(`Comply with ${requirement}`)
      .because(`Required by ${rule.standard}`)
      .applyingRule(rule)
      .basedOn(...evidenceFactIds)
      .withConfidence(confidence)
      .by('system')
      .build();
  }

  /**
   * Upgrade Required Decision
   */
  static upgradeRequired(
    jobGraphId: string,
    upgrade: string,
    reasoning: string,
    evidenceFactIds: string[],
    confidence: Confidence,
    risks: string[] = []
  ): Decision {
    const builder = new DecisionBuilder(jobGraphId)
      .type('upgrade_path')
      .decide(upgrade)
      .because(reasoning)
      .basedOn(...evidenceFactIds)
      .withConfidence(confidence)
      .by('ai');

    risks.forEach((risk) => builder.withRisk(risk));

    return builder.build();
  }

  /**
   * MI Precedence Decision
   * When MI is more restrictive than Building Regs
   */
  static miPrecedence(
    jobGraphId: string,
    requirement: string,
    miRule: RuleReference,
    buildingRegsRule: RuleReference,
    evidenceFactIds: string[],
    confidence: Confidence
  ): Decision {
    return new DecisionBuilder(jobGraphId)
      .type('compliance')
      .decide(requirement)
      .because(
        `Manufacturer Instructions are more restrictive than Building Regulations and take precedence`
      )
      .applyingRule(miRule)
      .basedOn(...evidenceFactIds)
      .withConfidence(confidence)
      .withRisk(
        `Building Regs (${buildingRegsRule.standard}) would allow less restrictive approach`
      )
      .by('system')
      .build();
  }
}
