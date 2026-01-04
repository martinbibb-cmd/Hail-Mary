/**
 * Conflict Engine
 *
 * Detects and resolves conflicts between:
 * - Manufacturer Instructions vs Building Regulations (MI always wins when more restrictive)
 * - Contradictory facts
 * - Validation failures
 * - Incompatibilities
 *
 * Key Principle: "No hidden conflicts" - detect, record, explain all
 */

import {
  Conflict,
  ConflictType,
  ConflictSeverity,
  Decision,
  Fact,
  RuleReference,
  RuleSource,
} from './types';

/**
 * Conflict Detection Result
 */
export interface ConflictDetectionResult {
  conflicts: Conflict[];
  resolvedConflicts: Conflict[];
  summary: {
    critical: number;
    warnings: number;
    info: number;
    autoResolved: number;
  };
}

/**
 * Conflict Engine - Detects and resolves conflicts
 */
export class ConflictEngine {
  private jobGraphId: string;

  constructor(jobGraphId: string) {
    this.jobGraphId = jobGraphId;
  }

  /**
   * Run full conflict detection
   */
  detectConflicts(facts: Fact[], decisions: Decision[]): ConflictDetectionResult {
    const conflicts: Conflict[] = [];
    const resolvedConflicts: Conflict[] = [];

    // 1. Check for MI vs Building Regs conflicts
    const miConflicts = this.detectMIvsRegsConflicts(decisions);
    conflicts.push(...miConflicts.unresolved);
    resolvedConflicts.push(...miConflicts.resolved);

    // 2. Check for fact contradictions
    const factConflicts = this.detectFactContradictions(facts);
    conflicts.push(...factConflicts);

    // 3. Check for missing critical data
    const missingDataConflicts = this.detectMissingCriticalData(facts);
    conflicts.push(...missingDataConflicts);

    // 4. Check for incompatibilities
    const incompatibilities = this.detectIncompatibilities(facts, decisions);
    conflicts.push(...incompatibilities);

    // Generate summary
    const summary = {
      critical: conflicts.filter((c) => c.severity === 'critical').length,
      warnings: conflicts.filter((c) => c.severity === 'warning').length,
      info: conflicts.filter((c) => c.severity === 'info').length,
      autoResolved: resolvedConflicts.length,
    };

    return { conflicts, resolvedConflicts, summary };
  }

  /**
   * Detect MI vs Building Regs conflicts
   * RULE: Manufacturer Instructions ALWAYS take precedence when more restrictive
   */
  private detectMIvsRegsConflicts(decisions: Decision[]): {
    unresolved: Conflict[];
    resolved: Conflict[];
  } {
    const unresolved: Conflict[] = [];
    const resolved: Conflict[] = [];

    // Group decisions by topic
    const decisionsByType = new Map<string, Decision[]>();
    decisions.forEach((d) => {
      const existing = decisionsByType.get(d.decisionType) || [];
      existing.push(d);
      decisionsByType.set(d.decisionType, existing);
    });

    // Look for decisions with conflicting rules
    decisionsByType.forEach((typeDecisions) => {
      for (let i = 0; i < typeDecisions.length; i++) {
        for (let j = i + 1; j < typeDecisions.length; j++) {
          const d1 = typeDecisions[i];
          const d2 = typeDecisions[j];

          if (!d1.ruleApplied || !d2.ruleApplied) continue;

          // Check if one is MI and one is Building Regs
          const isMIvsRegs =
            (d1.ruleApplied.source === 'manufacturer_instructions' &&
              d2.ruleApplied.source === 'building_regulations') ||
            (d2.ruleApplied.source === 'manufacturer_instructions' &&
              d1.ruleApplied.source === 'building_regulations');

          if (isMIvsRegs) {
            const miDecision =
              d1.ruleApplied.source === 'manufacturer_instructions' ? d1 : d2;
            const regsDecision =
              d1.ruleApplied.source === 'manufacturer_instructions' ? d2 : d1;

            // Auto-resolve: MI takes precedence
            const conflict = this.createConflict({
              conflictType: 'mi_vs_regs',
              severity: 'info',
              description: `Manufacturer Instructions are more restrictive than Building Regulations. MI takes precedence.`,
              rule1: miDecision.ruleApplied,
              rule2: regsDecision.ruleApplied,
              resolution: `Following Manufacturer Instructions: ${miDecision.decision}`,
              affectedDecisionIds: [d1.id, d2.id],
              resolvedAt: new Date(),
            });

            resolved.push(conflict);
          }
        }
      }
    });

    return { unresolved, resolved };
  }

  /**
   * Detect contradictory facts
   */
  private detectFactContradictions(facts: Fact[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const factsByKey = new Map<string, Fact[]>();

    // Group facts by key
    facts.forEach((f) => {
      const key = `${f.category}:${f.key}`;
      const existing = factsByKey.get(key) || [];
      existing.push(f);
      factsByKey.set(key, existing);
    });

    // Check for contradictions
    factsByKey.forEach((keyFacts, key) => {
      if (keyFacts.length < 2) return;

      // Check if values differ significantly
      const values = keyFacts.map((f) => f.value);
      const uniqueValues = new Set(values.map((v) => JSON.stringify(v)));

      if (uniqueValues.size > 1) {
        // Contradiction detected
        const highestConfidence = Math.max(...keyFacts.map((f) => f.confidence));
        const severity: ConflictSeverity =
          highestConfidence < 50 ? 'warning' : 'critical';

        conflicts.push(
          this.createConflict({
            conflictType: 'fact_contradiction',
            severity,
            description: `Contradictory values for ${key}: ${Array.from(uniqueValues).join(', ')}`,
            affectedFactIds: keyFacts.map((f) => f.id),
          })
        );
      }
    });

    return conflicts;
  }

  /**
   * Detect missing critical data
   */
  private detectMissingCriticalData(facts: Fact[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Define critical facts that must be present
    const criticalFacts = [
      { category: 'property', key: 'property_type', label: 'Property Type' },
      { category: 'existing_system', key: 'boiler_type', label: 'Existing Boiler Type' },
      { category: 'electrical', key: 'main_fuse_rating', label: 'Main Fuse Rating' },
      { category: 'gas', key: 'meter_location', label: 'Gas Meter Location' },
    ];

    const existingFacts = new Set(facts.map((f) => `${f.category}:${f.key}`));

    criticalFacts.forEach(({ category, key, label }) => {
      const factKey = `${category}:${key}`;
      if (!existingFacts.has(factKey)) {
        conflicts.push(
          this.createConflict({
            conflictType: 'missing_data',
            severity: 'critical',
            description: `Missing critical data: ${label}`,
            affectedFactIds: [],
          })
        );
      }
    });

    return conflicts;
  }

  /**
   * Detect incompatibilities between components/systems
   */
  private detectIncompatibilities(facts: Fact[], decisions: Decision[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Example: Check if electrical capacity is sufficient for selected system
    const electricalCapacity = facts.find(
      (f) => f.category === 'electrical' && f.key === 'main_fuse_rating'
    );
    const systemSelection = decisions.find((d) => d.decisionType === 'system_selection');

    if (electricalCapacity && systemSelection) {
      const fuseRating = Number(electricalCapacity.value) || 0;

      // Example: Heat pump needs minimum 80A
      if (
        systemSelection.decision.toLowerCase().includes('heat pump') &&
        fuseRating < 80
      ) {
        conflicts.push(
          this.createConflict({
            conflictType: 'incompatibility',
            severity: 'critical',
            description: `Main fuse (${fuseRating}A) insufficient for heat pump installation. Minimum 80A required.`,
            affectedFactIds: [electricalCapacity.id],
            affectedDecisionIds: [systemSelection.id],
          })
        );
      }
    }

    return conflicts;
  }

  /**
   * Create a conflict object
   */
  private createConflict(params: {
    conflictType: ConflictType;
    severity: ConflictSeverity;
    description: string;
    rule1?: RuleReference;
    rule2?: RuleReference;
    resolution?: string;
    affectedFactIds?: string[];
    affectedDecisionIds?: string[];
    resolvedAt?: Date;
  }): Conflict {
    return {
      id: this.generateId(),
      jobGraphId: this.jobGraphId,
      conflictType: params.conflictType,
      severity: params.severity,
      description: params.description,
      rule1: params.rule1,
      rule2: params.rule2,
      resolution: params.resolution,
      affectedFactIds: params.affectedFactIds || [],
      affectedDecisionIds: params.affectedDecisionIds || [],
      resolvedAt: params.resolvedAt,
      createdAt: new Date(),
    };
  }

  /**
   * Resolve a conflict
   */
  resolveConflict(conflict: Conflict, resolution: string): Conflict {
    return {
      ...conflict,
      resolution,
      resolvedAt: new Date(),
    };
  }

  /**
   * Check if conflict is blocking
   */
  isBlockingConflict(conflict: Conflict): boolean {
    return conflict.severity === 'critical' && !conflict.resolvedAt;
  }

  /**
   * Get conflicts that block progress
   */
  getBlockingConflicts(conflicts: Conflict[]): Conflict[] {
    return conflicts.filter((c) => this.isBlockingConflict(c));
  }

  /**
   * Generate unique ID (placeholder - should use UUID in production)
   */
  private generateId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Rule Comparison Helper
 * Determines which rule is more restrictive
 */
export class RuleComparator {
  /**
   * Compare two rules and determine which is more restrictive
   * Returns: 'rule1' | 'rule2' | 'equal' | 'unknown'
   */
  static compareRestrictiveness(
    rule1: RuleReference,
    rule2: RuleReference,
    context: { metric: string; value1: unknown; value2: unknown }
  ): 'rule1' | 'rule2' | 'equal' | 'unknown' {
    // For numeric comparisons (e.g., clearances, ratings)
    if (typeof context.value1 === 'number' && typeof context.value2 === 'number') {
      // For clearances, minimums, etc. - higher is more restrictive
      if (context.metric.includes('clearance') || context.metric.includes('minimum')) {
        if (context.value1 > context.value2) return 'rule1';
        if (context.value2 > context.value1) return 'rule2';
        return 'equal';
      }

      // For maximums, capacity limits - lower is more restrictive
      if (context.metric.includes('maximum') || context.metric.includes('limit')) {
        if (context.value1 < context.value2) return 'rule1';
        if (context.value2 < context.value1) return 'rule2';
        return 'equal';
      }
    }

    return 'unknown';
  }

  /**
   * Apply MI precedence rule
   * If MI is more restrictive, it always wins
   */
  static applyMIPrecedence(
    rule1: RuleReference,
    rule2: RuleReference,
    context: { metric: string; value1: unknown; value2: unknown }
  ): { winner: RuleReference; reason: string } {
    const comparison = this.compareRestrictiveness(rule1, rule2, context);

    // Identify which is MI
    const isMI1 = rule1.source === 'manufacturer_instructions';
    const isMI2 = rule2.source === 'manufacturer_instructions';

    if (isMI1 && !isMI2) {
      if (comparison === 'rule1' || comparison === 'equal') {
        return {
          winner: rule1,
          reason: 'Manufacturer Instructions are more restrictive and take precedence',
        };
      } else if (comparison === 'rule2') {
        return {
          winner: rule2,
          reason: 'Building Regulations are more restrictive in this case',
        };
      }
    }

    if (isMI2 && !isMI1) {
      if (comparison === 'rule2' || comparison === 'equal') {
        return {
          winner: rule2,
          reason: 'Manufacturer Instructions are more restrictive and take precedence',
        };
      } else if (comparison === 'rule1') {
        return {
          winner: rule1,
          reason: 'Building Regulations are more restrictive in this case',
        };
      }
    }

    // Both are same source or neither is MI
    return {
      winner: comparison === 'rule1' ? rule1 : rule2,
      reason: 'More restrictive requirement applies',
    };
  }
}
