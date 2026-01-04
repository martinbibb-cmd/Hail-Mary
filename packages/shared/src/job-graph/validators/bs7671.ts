/**
 * BS 7671 Validator
 *
 * BS 7671:2018+A2:2022 - Requirements for Electrical Installations (IET Wiring Regulations 18th Edition)
 *
 * Critical for electrical safety, earthing, and capacity requirements
 */

import {
  Validator,
  ValidationResult,
  Fact,
  Decision,
  Conflict,
} from '../types';

/**
 * BS 7671 Validator
 */
export class BS7671Validator implements Validator {
  name = 'BS 7671 - Electrical Safety';
  standard = 'BS 7671:2018+A2:2022';

  validate(facts: Fact[], decisions: Decision[]): ValidationResult {
    const conflicts: Conflict[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check main fuse capacity
    this.validateMainFuseCapacity(facts, decisions, conflicts, warnings);

    // Check earthing system
    this.validateEarthingSystem(facts, conflicts, warnings);

    // Check RCD protection
    this.validateRCDProtection(facts, conflicts, warnings);

    // Check bonding
    this.validateBonding(facts, conflicts, warnings);

    return {
      valid: conflicts.filter((c) => c.severity === 'critical').length === 0,
      conflicts,
      warnings,
      recommendations,
    };
  }

  /**
   * Validate main fuse capacity for proposed system
   */
  private validateMainFuseCapacity(
    facts: Fact[],
    decisions: Decision[],
    conflicts: Conflict[],
    warnings: string[]
  ): void {
    const mainFuseRating = facts.find(
      (f) => f.category === 'electrical' && f.key === 'main_fuse_rating'
    );

    if (!mainFuseRating) {
      warnings.push('Main fuse rating not documented');
      return;
    }

    const fuseRating = Number(mainFuseRating.value) || 0;

    // Check if heat pump is being installed
    const heatPumpDecision = decisions.find(
      (d) =>
        d.decisionType === 'system_selection' &&
        typeof d.decision === 'string' &&
        d.decision.toLowerCase().includes('heat pump')
    );

    if (heatPumpDecision) {
      // Heat pumps typically need 80-100A (BS 7671 Section 331)
      if (fuseRating < 80) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'incompatibility',
          severity: 'critical',
          description: `Main fuse (${fuseRating}A) insufficient for heat pump. Minimum 80A required.`,
          rule1: {
            source: 'bs_standard',
            standard: 'BS 7671:2018',
            section: 'Section 331',
            description: 'Adequate supply capacity required for heat pumps',
          },
          affectedFactIds: [mainFuseRating.id],
          affectedDecisionIds: [heatPumpDecision.id],
          createdAt: new Date(),
        });
      } else if (fuseRating < 100) {
        warnings.push(
          `Main fuse (${fuseRating}A) may be marginal for heat pump. Consider 100A upgrade.`
        );
      }
    }

    // Check if EV charger is being installed
    const evChargerDecision = decisions.find(
      (d) =>
        d.decisionType === 'system_selection' &&
        typeof d.decision === 'string' &&
        d.decision.toLowerCase().includes('ev charger')
    );

    if (evChargerDecision) {
      // 7kW EV charger needs 32A circuit, check available capacity
      if (fuseRating < 80) {
        warnings.push(
          `Main fuse (${fuseRating}A) may be insufficient for EV charger with other loads.`
        );
      }
    }

    // General capacity check for modern heating systems
    if (fuseRating < 60) {
      warnings.push(
        `Main fuse (${fuseRating}A) is low for modern heating systems. Consider 80-100A upgrade.`
      );
    }
  }

  /**
   * Validate earthing system (BS 7671 Section 411)
   */
  private validateEarthingSystem(
    facts: Fact[],
    conflicts: Conflict[],
    warnings: string[]
  ): void {
    const earthingType = facts.find(
      (f) => f.category === 'electrical' && f.key === 'earthing_type'
    );

    if (!earthingType) {
      warnings.push('Earthing system type not documented - critical for EV chargers');
      return;
    }

    const earthing = String(earthingType.value).toLowerCase();

    // TN-C-S (PME) requires special considerations for EV chargers (BS 7671 Section 722)
    if (earthing.includes('tn-c-s') || earthing.includes('pme')) {
      warnings.push(
        'TN-C-S (PME) earthing: EV charger requires additional earthing electrode per BS 7671 Section 722'
      );
    }

    // TT earthing requires RCD protection (BS 7671 Section 411.5)
    if (earthing.includes('tt')) {
      warnings.push('TT earthing system: Ensure RCD protection in place per BS 7671 Section 411.5');
    }
  }

  /**
   * Validate RCD protection (BS 7671 Section 415)
   */
  private validateRCDProtection(
    facts: Fact[],
    conflicts: Conflict[],
    warnings: string[]
  ): void {
    const rcdProtection = facts.find(
      (f) => f.category === 'electrical' && f.key === 'rcd_protection'
    );

    const boilerLocation = facts.find(
      (f) => f.category === 'existing_system' && f.key === 'boiler_location'
    );

    // Check if boiler is in bathroom/wet room
    if (
      boilerLocation &&
      typeof boilerLocation.value === 'string' &&
      (boilerLocation.value.toLowerCase().includes('bathroom') ||
        boilerLocation.value.toLowerCase().includes('wet room'))
    ) {
      if (!rcdProtection || rcdProtection.value !== true) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'validation_failure',
          severity: 'critical',
          description: 'Appliance in bathroom/wet room requires RCD protection',
          rule1: {
            source: 'bs_standard',
            standard: 'BS 7671:2018',
            section: 'Section 701 (Locations containing bath or shower)',
            description: 'RCD protection required for electrical equipment in bathrooms',
          },
          affectedFactIds: [boilerLocation.id],
          affectedDecisionIds: [],
          createdAt: new Date(),
        });
      }
    }
  }

  /**
   * Validate main protective bonding (BS 7671 Section 411.3.1.2)
   */
  private validateBonding(
    facts: Fact[],
    conflicts: Conflict[],
    warnings: string[]
  ): void {
    const gasBonding = facts.find(
      (f) => f.category === 'electrical' && f.key === 'gas_bonding_present'
    );
    const waterBonding = facts.find(
      (f) => f.category === 'electrical' && f.key === 'water_bonding_present'
    );

    if (!gasBonding || gasBonding.value !== true) {
      warnings.push('Gas supply bonding not documented - required per BS 7671 Section 411.3.1.2');
    }

    if (!waterBonding || waterBonding.value !== true) {
      warnings.push('Water supply bonding not documented - required per BS 7671 Section 411.3.1.2');
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `conflict_bs7671_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
