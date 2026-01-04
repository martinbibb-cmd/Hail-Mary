/**
 * HSG264 Validator
 *
 * HSG264 - Gas safety: Guidance for gas fitters and installers
 * HSE (Health and Safety Executive) guidance on gas installation safety
 *
 * Critical for gas safety, pipework, and installation procedures
 */

import {
  Validator,
  ValidationResult,
  Fact,
  Decision,
  Conflict,
} from '../types';

/**
 * HSG264 Validator
 */
export class HSG264Validator implements Validator {
  name = 'HSG264 - Gas Safety';
  standard = 'HSG264';

  validate(facts: Fact[], decisions: Decision[]): ValidationResult {
    const conflicts: Conflict[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check gas meter location and access
    this.validateGasMeterAccess(facts, conflicts, warnings);

    // Check pipework sizing and routing
    this.validatePipework(facts, conflicts, warnings);

    // Check gas supply pressure
    this.validateGasPressure(facts, conflicts, warnings);

    // Check ventilation and combustion air
    this.validateCombustionAir(facts, conflicts, warnings);

    return {
      valid: conflicts.filter((c) => c.severity === 'critical').length === 0,
      conflicts,
      warnings,
      recommendations,
    };
  }

  /**
   * Validate gas meter location and access
   */
  private validateGasMeterAccess(
    facts: Fact[],
    conflicts: Conflict[],
    warnings: string[]
  ): void {
    const meterLocation = facts.find(
      (f) => f.category === 'gas' && f.key === 'meter_location'
    );
    const meterAccessible = facts.find(
      (f) => f.category === 'gas' && f.key === 'meter_accessible'
    );

    if (!meterLocation) {
      warnings.push('Gas meter location not documented');
      return;
    }

    if (meterAccessible && meterAccessible.value === false) {
      conflicts.push({
        id: this.generateId(),
        jobGraphId: '',
        conflictType: 'validation_failure',
        severity: 'critical',
        description: 'Gas meter not accessible - requires accessible location for emergency isolation',
        rule1: {
          source: 'hsg_guidance',
          standard: 'HSG264',
          section: 'Emergency controls',
          description: 'Gas emergency control valve must be readily accessible',
        },
        affectedFactIds: [meterAccessible.id],
        affectedDecisionIds: [],
        createdAt: new Date(),
      });
    }
  }

  /**
   * Validate gas pipework sizing and routing
   */
  private validatePipework(
    facts: Fact[],
    conflicts: Conflict[],
    warnings: string[]
  ): void {
    const pipeworkSize = facts.find(
      (f) => f.category === 'gas' && f.key === 'supply_pipe_size'
    );
    const pipeworkLength = facts.find(
      (f) => f.category === 'gas' && f.key === 'supply_pipe_length'
    );
    const boilerKW = facts.find(
      (f) => f.category === 'existing_system' && f.key === 'boiler_kw_rating'
    );

    if (!pipeworkSize) {
      warnings.push('Gas supply pipe size not documented - required for capacity calculation');
      return;
    }

    if (!boilerKW) {
      warnings.push('Boiler kW rating not documented - required for pipe sizing validation');
      return;
    }

    const pipeSize = Number(pipeworkSize.value) || 0;
    const pipeLength = Number(pipeworkLength?.value) || 0;
    const kw = Number(boilerKW.value) || 0;

    // Basic pipe sizing check (simplified - real calculation more complex)
    // 22mm pipe: max 60kW for <20m, max 44kW for 20-30m
    // 28mm pipe: max 130kW for <20m, max 100kW for 20-30m
    if (pipeSize === 22 && kw > 60 && pipeLength < 20) {
      warnings.push(
        `22mm gas pipe may be undersized for ${kw}kW boiler. Consider 28mm pipe.`
      );
    }

    if (pipeSize === 22 && kw > 44 && pipeLength >= 20 && pipeLength <= 30) {
      conflicts.push({
        id: this.generateId(),
        jobGraphId: '',
        conflictType: 'validation_failure',
        severity: 'critical',
        description: `22mm gas pipe undersized for ${kw}kW boiler over ${pipeLength}m. Requires 28mm minimum.`,
        rule1: {
          source: 'hsg_guidance',
          standard: 'HSG264',
          section: 'Pipe sizing',
          description: 'Gas pipe must be adequately sized for appliance load and length',
        },
        affectedFactIds: [pipeworkSize.id, boilerKW.id],
        affectedDecisionIds: [],
        createdAt: new Date(),
      });
    }
  }

  /**
   * Validate gas supply pressure
   */
  private validateGasPressure(
    facts: Fact[],
    conflicts: Conflict[],
    warnings: string[]
  ): void {
    const supplyPressure = facts.find(
      (f) => f.category === 'gas' && f.key === 'supply_pressure_mbar'
    );

    if (!supplyPressure) {
      warnings.push('Gas supply pressure not measured - required for commissioning');
      return;
    }

    const pressure = Number(supplyPressure.value) || 0;

    // Normal mains gas pressure: 19-23 mbar
    if (pressure < 17) {
      conflicts.push({
        id: this.generateId(),
        jobGraphId: '',
        conflictType: 'validation_failure',
        severity: 'critical',
        description: `Gas supply pressure too low: ${pressure}mbar. Normal range 19-23 mbar.`,
        rule1: {
          source: 'hsg_guidance',
          standard: 'HSG264',
          section: 'Gas pressure',
          description: 'Adequate gas pressure required for appliance operation',
        },
        affectedFactIds: [supplyPressure.id],
        affectedDecisionIds: [],
        createdAt: new Date(),
      });
    } else if (pressure < 19) {
      warnings.push(
        `Gas supply pressure low: ${pressure}mbar. Normal range 19-23 mbar. May affect appliance performance.`
      );
    } else if (pressure > 25) {
      warnings.push(
        `Gas supply pressure high: ${pressure}mbar. Normal range 19-23 mbar. Check for issues.`
      );
    }
  }

  /**
   * Validate combustion air supply
   */
  private validateCombustionAir(
    facts: Fact[],
    conflicts: Conflict[],
    warnings: string[]
  ): void {
    const boilerLocation = facts.find(
      (f) => f.category === 'existing_system' && f.key === 'boiler_location'
    );
    const boilerType = facts.find(
      (f) => f.category === 'existing_system' && f.key === 'boiler_type'
    );
    const ventilation = facts.find(
      (f) => f.category === 'structure' && f.key === 'permanent_ventilation'
    );

    // Open flue appliances require adequate ventilation
    if (
      boilerType &&
      typeof boilerType.value === 'string' &&
      boilerType.value.toLowerCase().includes('open flue')
    ) {
      if (!ventilation || ventilation.value !== true) {
        conflicts.push({
          id: this.generateId(),
          jobGraphId: '',
          conflictType: 'validation_failure',
          severity: 'critical',
          description: 'Open flue appliance requires permanent ventilation for combustion air',
          rule1: {
            source: 'hsg_guidance',
            standard: 'HSG264',
            section: 'Ventilation',
            description: 'Open flue appliances require adequate ventilation',
          },
          affectedFactIds: [boilerType.id],
          affectedDecisionIds: [],
          createdAt: new Date(),
        });
      }
    }

    // Warn about small rooms
    const roomVolume = facts.find(
      (f) => f.category === 'structure' && f.key === 'boiler_room_volume_m3'
    );

    if (roomVolume) {
      const volume = Number(roomVolume.value) || 0;
      if (volume < 5) {
        warnings.push(
          `Small boiler room (${volume}m³). Ensure adequate ventilation per HSG264.`
        );
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `conflict_hsg264_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
