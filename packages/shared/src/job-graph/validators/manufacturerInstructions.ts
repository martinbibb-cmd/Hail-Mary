/**
 * Manufacturer Instructions Validator
 *
 * CRITICAL: Manufacturer Instructions ALWAYS take precedence over Building Regulations
 * when more restrictive.
 *
 * This validator checks MI compliance and flags conflicts with Building Regs
 */

import {
  Validator,
  ValidationResult,
  Fact,
  Decision,
  Conflict,
} from '../types';

/**
 * Manufacturer Instructions Validator
 */
export class ManufacturerInstructionsValidator implements Validator {
  name = 'Manufacturer Instructions';
  standard = 'Various (Product-specific)';

  validate(facts: Fact[], decisions: Decision[]): ValidationResult {
    const conflicts: Conflict[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check if MI is documented
    this.checkMIDocumentation(facts, warnings, recommendations);

    // Validate clearances against MI
    this.validateClearances(facts, conflicts, warnings);

    // Validate flue requirements against MI
    this.validateFlueRequirements(facts, conflicts, warnings);

    // Validate system-specific requirements
    this.validateSystemRequirements(facts, decisions, conflicts, warnings);

    // Check for MI vs Building Regs conflicts
    this.checkMIvsBuildingRegs(facts, decisions, conflicts, recommendations);

    return {
      valid: conflicts.filter((c) => c.severity === 'critical').length === 0,
      conflicts,
      warnings,
      recommendations,
    };
  }

  /**
   * Check that MI is documented and available
   */
  private checkMIDocumentation(
    facts: Fact[],
    warnings: string[],
    recommendations: string[]
  ): void {
    const selectedBoilerMake = facts.find(
      (f) => f.category === 'existing_system' && f.key === 'selected_boiler_make'
    );
    const selectedBoilerModel = facts.find(
      (f) => f.category === 'existing_system' && f.key === 'selected_boiler_model'
    );
    const miDocumented = facts.find(
      (f) => f.category === 'regulatory' && f.key === 'mi_documented'
    );

    if (selectedBoilerMake && selectedBoilerModel) {
      if (!miDocumented || miDocumented.value !== true) {
        warnings.push(
          `Manufacturer Instructions for ${selectedBoilerMake.value} ${selectedBoilerModel.value} not documented - CRITICAL for compliance`
        );
        recommendations.push(
          'Download and review MI before finalizing specification'
        );
      }
    } else {
      warnings.push('Selected boiler make/model not documented - required to check MI');
    }
  }

  /**
   * Validate clearances against MI
   * MI clearances override Building Regs if more restrictive
   */
  private validateClearances(
    facts: Fact[],
    conflicts: Conflict[],
    _warnings: string[]
  ): void {
    const miClearanceTop = facts.find(
      (f) => f.category === 'regulatory' && f.key === 'mi_clearance_top_mm'
    );
    const miClearanceSides = facts.find(
      (f) => f.category === 'regulatory' && f.key === 'mi_clearance_sides_mm'
    );
    const miClearanceFront = facts.find(
      (f) => f.category === 'regulatory' && f.key === 'mi_clearance_front_mm'
    );

    const actualClearanceTop = facts.find(
      (f) => f.category === 'measurements' && f.key === 'boiler_clearance_top'
    );
    const actualClearanceSides = facts.find(
      (f) => f.category === 'measurements' && f.key === 'boiler_clearance_sides'
    );
    const actualClearanceFront = facts.find(
      (f) => f.category === 'measurements' && f.key === 'boiler_clearance_front'
    );

    // Check top clearance
    if (miClearanceTop && actualClearanceTop) {
      const required = Number(miClearanceTop.value) || 0;
      const actual = Number(actualClearanceTop.value) || 0;

      if (actual < required) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'validation_failure',
          severity: 'critical',
          description: `Top clearance (${actual}mm) insufficient. MI requires ${required}mm minimum.`,
          rule1: {
            source: 'manufacturer_instructions',
            standard: 'Manufacturer Instructions',
            description: `Minimum ${required}mm top clearance required`,
            restrictiveness: 'more',
          },
          affectedFactIds: [miClearanceTop.id, actualClearanceTop.id],
          affectedDecisionIds: [],
          createdAt: new Date(),
        });
      }
    }

    // Check side clearances
    if (miClearanceSides && actualClearanceSides) {
      const required = Number(miClearanceSides.value) || 0;
      const actual = Number(actualClearanceSides.value) || 0;

      if (actual < required) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'validation_failure',
          severity: 'critical',
          description: `Side clearance (${actual}mm) insufficient. MI requires ${required}mm minimum.`,
          rule1: {
            source: 'manufacturer_instructions',
            standard: 'Manufacturer Instructions',
            description: `Minimum ${required}mm side clearance required`,
            restrictiveness: 'more',
          },
          affectedFactIds: [miClearanceSides.id, actualClearanceSides.id],
          affectedDecisionIds: [],
          createdAt: new Date(),
        });
      }
    }

    // Check front clearance (for servicing)
    if (miClearanceFront && actualClearanceFront) {
      const required = Number(miClearanceFront.value) || 0;
      const actual = Number(actualClearanceFront.value) || 0;

      if (actual < required) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'validation_failure',
          severity: 'critical',
          description: `Front clearance (${actual}mm) insufficient for servicing. MI requires ${required}mm minimum.`,
          rule1: {
            source: 'manufacturer_instructions',
            standard: 'Manufacturer Instructions',
            description: `Minimum ${required}mm front clearance required for servicing access`,
            restrictiveness: 'more',
          },
          affectedFactIds: [miClearanceFront.id, actualClearanceFront.id],
          affectedDecisionIds: [],
          createdAt: new Date(),
        });
      }
    }
  }

  /**
   * Validate flue requirements from MI
   */
  private validateFlueRequirements(
    facts: Fact[],
    conflicts: Conflict[],
    _warnings: string[]
  ): void {
    const miFlueLength = facts.find(
      (f) => f.category === 'regulatory' && f.key === 'mi_max_flue_length_m'
    );
    const actualFlueLength = facts.find(
      (f) => f.category === 'measurements' && f.key === 'proposed_flue_length_m'
    );

    if (miFlueLength && actualFlueLength) {
      const maxLength = Number(miFlueLength.value) || 0;
      const actual = Number(actualFlueLength.value) || 0;

      if (actual > maxLength) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'validation_failure',
          severity: 'critical',
          description: `Proposed flue length (${actual}m) exceeds MI maximum (${maxLength}m).`,
          rule1: {
            source: 'manufacturer_instructions',
            standard: 'Manufacturer Instructions',
            description: `Maximum flue length ${maxLength}m`,
            restrictiveness: 'more',
          },
          affectedFactIds: [miFlueLength.id, actualFlueLength.id],
          affectedDecisionIds: [],
          createdAt: new Date(),
        });
      }
    }

    // Check flue termination clearances from MI
    const miFlueTerminationClearance = facts.find(
      (f) => f.category === 'regulatory' && f.key === 'mi_flue_termination_clearance_mm'
    );
    const actualFlueTerminationClearance = facts.find(
      (f) => f.category === 'measurements' && f.key === 'flue_clearance_to_window'
    );

    if (miFlueTerminationClearance && actualFlueTerminationClearance) {
      const required = Number(miFlueTerminationClearance.value) || 0;
      const actual = Number(actualFlueTerminationClearance.value) || 0;

      if (actual < required) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'mi_vs_regs',
          severity: 'critical',
          description: `Flue termination clearance (${actual}mm) insufficient. MI requires ${required}mm (more restrictive than BS 5440).`,
          rule1: {
            source: 'manufacturer_instructions',
            standard: 'Manufacturer Instructions',
            description: `Minimum ${required}mm flue termination clearance`,
            restrictiveness: 'more',
          },
          rule2: {
            source: 'bs_standard',
            standard: 'BS 5440-1:2008',
            description: 'Minimum 300mm flue termination clearance',
            restrictiveness: 'less',
          },
          resolution: `Follow MI requirement: ${required}mm clearance`,
          affectedFactIds: [miFlueTerminationClearance.id, actualFlueTerminationClearance.id],
          affectedDecisionIds: [],
          createdAt: new Date(),
        });
      }
    }
  }

  /**
   * Validate system-specific requirements from MI
   */
  private validateSystemRequirements(
    facts: Fact[],
    decisions: Decision[],
    conflicts: Conflict[],
    warnings: string[]
  ): void {
    // Check water pressure requirements
    const miMinWaterPressure = facts.find(
      (f) => f.category === 'regulatory' && f.key === 'mi_min_water_pressure_bar'
    );
    const actualWaterPressure = facts.find(
      (f) => f.category === 'water' && f.key === 'mains_pressure_bar'
    );

    if (miMinWaterPressure && actualWaterPressure) {
      const required = Number(miMinWaterPressure.value) || 0;
      const actual = Number(actualWaterPressure.value) || 0;

      if (actual < required) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'incompatibility',
          severity: 'critical',
          description: `Water pressure (${actual} bar) insufficient for selected boiler. MI requires minimum ${required} bar.`,
          rule1: {
            source: 'manufacturer_instructions',
            standard: 'Manufacturer Instructions',
            description: `Minimum ${required} bar water pressure required`,
          },
          affectedFactIds: [miMinWaterPressure.id, actualWaterPressure.id],
          affectedDecisionIds: [],
          createdAt: new Date(),
        });
      }
    }

    // Check system filter requirement
    const miFilterRequired = facts.find(
      (f) => f.category === 'regulatory' && f.key === 'mi_filter_required'
    );

    if (miFilterRequired && miFilterRequired.value === true) {
      const filterSpecified = decisions.find(
        (d) =>
          d.decisionType === 'specification' &&
          typeof d.decision === 'string' &&
          d.decision.toLowerCase().includes('filter')
      );

      if (!filterSpecified) {
        warnings.push(
          'MI requires system filter - ensure specification includes magnetic filter'
        );
      }
    }
  }

  /**
   * Check for MI vs Building Regs conflicts
   * Document when MI is more restrictive (and therefore takes precedence)
   */
  private checkMIvsBuildingRegs(
    facts: Fact[],
    _decisions: Decision[],
    _conflicts: Conflict[],
    recommendations: string[]
  ): void {
    // This is informational - showing when MI overrides Building Regs
    const miClearances = facts.filter(
      (f) => f.category === 'regulatory' && f.key.startsWith('mi_clearance')
    );

    if (miClearances.length > 0) {
      recommendations.push(
        'Manufacturer Instructions specify clearances - these override Building Regs if more restrictive'
      );
    }

    // Check for decisions that cite MI taking precedence
    const miPrecedenceDecisions = _decisions.filter(
      (d: Decision) =>
        d.ruleApplied?.source === 'manufacturer_instructions' &&
        d.ruleApplied.restrictiveness === 'more'
    );

    if (miPrecedenceDecisions.length > 0) {
      recommendations.push(
        `${miPrecedenceDecisions.length} decision(s) based on MI taking precedence over Building Regs`
      );
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `conflict_mi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
