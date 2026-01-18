/**
 * BS 5440 Validator
 *
 * BS 5440-1:2008 - Flueing and ventilation for gas appliances of rated input not exceeding 70 kW net
 * BS 5440-2:2009 - Ventilation for gas appliances of rated input not exceeding 70 kW net
 *
 * Critical for flue termination, clearances, and ventilation requirements
 */

import {
  Validator,
  ValidationResult,
  Fact,
  Decision,
  Conflict,
} from '../types.js';

/**
 * BS 5440 Validator
 */
export class BS5440Validator implements Validator {
  name = 'BS 5440 - Flues and Ventilation';
  standard = 'BS 5440-1:2008 & BS 5440-2:2009';

  validate(facts: Fact[], _decisions: Decision[]): ValidationResult {
    const conflicts: Conflict[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check flue termination requirements
    this.validateFlueTermination(facts, conflicts, warnings);

    // Check ventilation requirements
    this.validateVentilation(facts, conflicts, warnings);

    // Check clearances
    this.validateClearances(facts, conflicts, warnings);

    return {
      valid: conflicts.filter((c) => c.severity === 'critical').length === 0,
      conflicts,
      warnings,
      recommendations,
    };
  }

  /**
   * Validate flue termination position and clearances
   */
  private validateFlueTermination(
    facts: Fact[],
    conflicts: Conflict[],
    warnings: string[]
  ): void {
    const flueType = facts.find((f) => f.category === 'existing_system' && f.key === 'flue_type');
    const flueRoute = facts.find((f) => f.category === 'existing_system' && f.key === 'flue_route');

    if (!flueType) {
      warnings.push('Flue type not documented');
      return;
    }

    // Check horizontal flue clearances (BS 5440-1 Table A.2)
    const horizontalFlueTypes = ['fanned_round', 'fanned_square', 'balanced'];
    if (
      typeof flueType.value === 'string' &&
      horizontalFlueTypes.includes(flueType.value)
    ) {
      this.validateHorizontalFlueClearances(facts, conflicts, warnings);
    }

    // Check vertical flue requirements (BS 5440-1 Section 4.3)
    if (
      flueRoute &&
      typeof flueRoute.value === 'string' &&
      (flueRoute.value.includes('vertical') || flueRoute.value.includes('ridge'))
    ) {
      this.validateVerticalFlueRequirements(facts, conflicts, warnings);
    }
  }

  /**
   * Validate horizontal flue clearances (BS 5440-1 Table A.2)
   */
  private validateHorizontalFlueClearances(
    facts: Fact[],
    conflicts: Conflict[],
    _warnings: string[]
  ): void {
    const clearanceToWindow = facts.find(
      (f) => f.category === 'measurements' && f.key === 'flue_clearance_to_window'
    );
    const clearanceToOpening = facts.find(
      (f) => f.category === 'measurements' && f.key === 'flue_clearance_to_opening'
    );

    // Minimum 300mm from opening windows (BS 5440-1 Table A.2)
    if (clearanceToWindow) {
      const clearance = Number(clearanceToWindow.value) || 0;
      if (clearance < 300) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'validation_failure',
          severity: 'critical',
          description: `Flue termination too close to window: ${clearance}mm. Minimum 300mm required.`,
          rule1: {
            source: 'bs_standard',
            standard: 'BS 5440-1:2008',
            section: 'Table A.2',
            description: 'Minimum 300mm clearance from opening windows',
          },
          affectedFactIds: [clearanceToWindow.id],
          affectedDecisionIds: [],
          createdAt: new Date(),
        });
      }
    }

    // Minimum 600mm from openings into buildings (BS 5440-1 Table A.2)
    if (clearanceToOpening) {
      const clearance = Number(clearanceToOpening.value) || 0;
      if (clearance < 600) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'validation_failure',
          severity: 'critical',
          description: `Flue termination too close to building opening: ${clearance}mm. Minimum 600mm required.`,
          rule1: {
            source: 'bs_standard',
            standard: 'BS 5440-1:2008',
            section: 'Table A.2',
            description: 'Minimum 600mm clearance from openings into buildings',
          },
          affectedFactIds: [clearanceToOpening.id],
          affectedDecisionIds: [],
          createdAt: new Date(),
        });
      }
    }
  }

  /**
   * Validate vertical flue requirements (BS 5440-1 Section 4.3)
   */
  private validateVerticalFlueRequirements(
    facts: Fact[],
    conflicts: Conflict[],
    _warnings: string[]
  ): void {
    const flueHeight = facts.find(
      (f) => f.category === 'measurements' && f.key === 'flue_height_above_roof'
    );

    // Minimum 600mm above roof penetration (BS 5440-1 Section 4.3)
    if (flueHeight) {
      const height = Number(flueHeight.value) || 0;
      if (height < 600) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'validation_failure',
          severity: 'critical',
          description: `Vertical flue height insufficient: ${height}mm. Minimum 600mm above roof required.`,
          rule1: {
            source: 'bs_standard',
            standard: 'BS 5440-1:2008',
            section: 'Section 4.3',
            description: 'Minimum 600mm flue height above roof penetration',
          },
          affectedFactIds: [flueHeight.id],
          affectedDecisionIds: [],
          createdAt: new Date(),
        });
      }
    }
  }

  /**
   * Validate ventilation requirements (BS 5440-2:2009)
   */
  private validateVentilation(
    facts: Fact[],
    conflicts: Conflict[],
    _warnings: string[]
  ): void {
    const boilerLocation = facts.find(
      (f) => f.category === 'existing_system' && f.key === 'boiler_location'
    );
    const ventilationProvided = facts.find(
      (f) => f.category === 'structure' && f.key === 'permanent_ventilation'
    );

    // Check if ventilation is required based on location and kW rating
    if (boilerLocation && typeof boilerLocation.value === 'string') {
      const location = boilerLocation.value.toLowerCase();

      // Cupboards and compartments require ventilation (BS 5440-2 Section 5)
      if (location.includes('cupboard') || location.includes('compartment')) {
        if (!ventilationProvided || ventilationProvided.value === false) {
          conflicts.push({
            id: this.generateId(),
            jobGraphId: '',
            conflictType: 'validation_failure',
            severity: 'critical',
            description: 'Boiler in cupboard/compartment requires permanent ventilation',
            rule1: {
              source: 'bs_standard',
              standard: 'BS 5440-2:2009',
              section: 'Section 5',
              description: 'Permanent ventilation required for appliances in cupboards',
            },
            affectedFactIds: [boilerLocation.id],
            affectedDecisionIds: [],
            createdAt: new Date(),
          });
        }
      }
    }
  }

  /**
   * Validate appliance clearances
   */
  private validateClearances(
    facts: Fact[],
    _conflicts: Conflict[],
    warnings: string[]
  ): void {
    const clearanceTop = facts.find(
      (f) => f.category === 'measurements' && f.key === 'boiler_clearance_top'
    );
    const clearanceSides = facts.find(
      (f) => f.category === 'measurements' && f.key === 'boiler_clearance_sides'
    );
    const clearanceFront = facts.find(
      (f) => f.category === 'measurements' && f.key === 'boiler_clearance_front'
    );

    // Note: Actual clearances come from MI, but warn if no clearances documented
    if (!clearanceTop && !clearanceSides && !clearanceFront) {
      warnings.push('Boiler clearances not documented - check Manufacturer Instructions');
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `conflict_bs5440_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
