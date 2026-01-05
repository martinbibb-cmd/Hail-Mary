/**
 * Provenance Builder for Heat Loss Calculations
 *
 * Constructs the audit trail that makes calculations defensible
 */

import {
  CalculationProvenance,
  Assumption,
  DefaultApplied,
  Warning,
  AssumptionCodes,
  WarningCodes,
  type CalculationReason,
} from '@hail-mary/shared';

import type {
  HDRoom,
  HeatingBuildingData,
  HeatingClimateData,
  HeatingDesignConditions,
  HeatLossResult,
} from '@hail-mary/shared';

const METHOD = 'EN12831-simplified';
const METHOD_VERSION = '2026.01';

/**
 * Build complete provenance for a heat loss calculation
 */
export function buildHeatLossProvenance(
  room: HDRoom,
  building: HeatingBuildingData,
  climate: HeatingClimateData,
  designConditions: HeatingDesignConditions,
  result: HeatLossResult,
  reason: CalculationReason = 'initial_calculation'
): CalculationProvenance {
  const targetTemp = room.targetTemperature || designConditions.targetTemperatures[room.type];
  const deltaT = targetTemp - climate.outsideDesignTemp;

  return {
    method: METHOD,
    methodVersion: METHOD_VERSION,

    inputsSnapshot: buildInputsSnapshot(room, building, climate, designConditions, targetTemp, deltaT),
    assumptions: buildAssumptions(room, building, climate, designConditions),
    defaultsApplied: buildDefaults(room, building, climate, designConditions, targetTemp),
    overrides: [], // Will be populated by API when user overrides

    warnings: buildWarnings(result, room, building),

    calculatedAt: new Date(),
    reason,
  };
}

/**
 * Capture exact values used in calculation
 */
function buildInputsSnapshot(
  room: HDRoom,
  building: HeatingBuildingData,
  climate: HeatingClimateData,
  designConditions: HeatingDesignConditions,
  targetTemp: number,
  deltaT: number
): Record<string, unknown> {
  return {
    // Room geometry
    roomId: room.id,
    roomName: room.name,
    roomType: room.type,
    area: room.area,
    volume: room.volume,
    ceilingHeight: room.ceilingHeight,
    perimeter: room.perimeter,

    // Temperatures
    targetTemp,
    outsideDesignTemp: climate.outsideDesignTemp,
    deltaT,

    // U-values
    wallUValue: building.wallUValue,
    roofUValue: building.roofUValue,
    floorUValue: building.floorUValue,
    wallConstruction: building.wallConstruction,
    roofConstruction: building.roofConstruction,
    floorConstruction: building.floorConstruction,

    // Ventilation
    airChangesPerHour: building.airChangesPerHour,
    infiltrationRate: designConditions.infiltrationRate,

    // Other
    thermalBridging: designConditions.thermalBridging,
    safetyMargin: designConditions.safetyMargin,
    flowTemperature: designConditions.flowTemperature,

    // Climate
    postcode: climate.postcode,
    region: climate.region,
    windSpeed: climate.windSpeed,
    altitude: climate.altitude,

    // Construction year (if known)
    constructionYear: building.constructionYear,
  };
}

/**
 * Identify what we assumed because we didn't have data
 */
function buildAssumptions(
  room: HDRoom,
  building: HeatingBuildingData,
  climate: HeatingClimateData,
  designConditions: HeatingDesignConditions
): Assumption[] {
  const assumptions: Assumption[] = [];

  // Air change rate
  if (!building.airChangesPerHour || building.airChangesPerHour === 1.0) {
    assumptions.push({
      code: AssumptionCodes.ACH_UNKNOWN,
      field: 'airChangesPerHour',
      description: 'Air change rate assumed as 1.0 ACH (no airtightness test performed)',
      impact: 'medium',
      value: building.airChangesPerHour || 1.0,
      alternatives: [
        { value: 0.5, label: 'Modern airtight (0.5 ACH)' },
        { value: 1.5, label: 'Older renovated (1.5 ACH)' },
        { value: 2.5, label: 'Older drafty (2.5 ACH)' },
      ],
    });
  }

  // Wall construction inferred
  if (!building.wallUValue && building.wallConstruction) {
    assumptions.push({
      code: AssumptionCodes.WALL_CONSTRUCTION_INFERRED,
      field: 'wallConstruction',
      description: `Wall construction assumed as "${building.wallConstruction}" based on property age/type`,
      impact: 'high',
      value: building.wallConstruction,
    });
  }

  // Ceiling height assumed
  if (!room.ceilingHeight || room.ceilingHeight === 2.4) {
    assumptions.push({
      code: AssumptionCodes.CEILING_HEIGHT_ASSUMED,
      field: 'ceilingHeight',
      description: 'Ceiling height assumed as 2.4m (typical UK residential)',
      impact: 'low',
      value: room.ceilingHeight || 2.4,
    });
  }

  // Thermal bridging typical value
  if (designConditions.thermalBridging === 0.15) {
    assumptions.push({
      code: AssumptionCodes.THERMAL_BRIDGING_TYPICAL,
      field: 'thermalBridging',
      description: 'Thermal bridging Y-value assumed as 0.15 W/m²K (typical mixed construction)',
      impact: 'low',
      value: 0.15,
      alternatives: [
        { value: 0.08, label: 'Well-designed details' },
        { value: 0.25, label: 'Older building, significant bridging' },
      ],
    });
  }

  // Window U-values
  if (room.windows.length > 0) {
    const windowsWithAssumedU = room.windows.filter(w => !w.uValue);
    if (windowsWithAssumedU.length > 0) {
      assumptions.push({
        code: AssumptionCodes.WINDOW_UVALUE_ASSUMED,
        field: 'windows.uValue',
        description: `${windowsWithAssumedU.length} window(s) have assumed U-values based on glazing type`,
        impact: 'medium',
        value: 'various',
      });
    }
  }

  return assumptions;
}

/**
 * Track what defaults were applied (not assumptions - these are policy)
 */
function buildDefaults(
  room: HDRoom,
  building: HeatingBuildingData,
  climate: HeatingClimateData,
  designConditions: HeatingDesignConditions,
  targetTemp: number
): DefaultApplied[] {
  const defaults: DefaultApplied[] = [];

  // Target temperature from room type
  if (!room.targetTemperature) {
    defaults.push({
      field: 'targetTemperature',
      value: targetTemp,
      source: 'room_type_default',
      description: `Target temperature for ${room.type}: ${targetTemp}°C (industry standard)`,
    });
  }

  // Outside design temperature from postcode
  if (climate.postcode && climate.outsideDesignTemp) {
    defaults.push({
      field: 'outsideDesignTemp',
      value: climate.outsideDesignTemp,
      source: 'postcode_lookup',
      description: `Design external temperature from ${climate.region}: ${climate.outsideDesignTemp}°C`,
    });
  }

  // Safety margin
  if (designConditions.safetyMargin) {
    defaults.push({
      field: 'safetyMargin',
      value: designConditions.safetyMargin,
      source: 'industry_standard',
      description: `Safety margin: ${designConditions.safetyMargin}% (typical for UK installations)`,
    });
  }

  return defaults;
}

/**
 * Analyze results for potential issues
 */
function buildWarnings(
  result: HeatLossResult,
  room: HDRoom,
  building: HeatingBuildingData
): Warning[] {
  const warnings: Warning[] = [];

  // Heat loss per m² sanity checks
  const lossPerM2 = result.totalLoss / room.area;

  if (lossPerM2 > 150) {
    warnings.push({
      code: WarningCodes.HEAT_LOSS_PER_M2_HIGH,
      severity: 'warning',
      category: 'calculation',
      message: `Very high heat loss: ${lossPerM2.toFixed(1)} W/m² (typical: 40-120 W/m²)`,
      suggestedFix: 'Check U-values, air change rate, and temperature difference',
      affectedFields: ['wallUValue', 'airChangesPerHour', 'targetTemperature'],
      context: { lossPerM2, typical_min: 40, typical_max: 120 },
    });
  }

  if (lossPerM2 < 30) {
    warnings.push({
      code: WarningCodes.HEAT_LOSS_PER_M2_LOW,
      severity: 'warning',
      category: 'calculation',
      message: `Very low heat loss: ${lossPerM2.toFixed(1)} W/m² (typical: 40-120 W/m²)`,
      suggestedFix: 'Verify insulation values and temperature settings',
      affectedFields: ['wallUValue', 'targetTemperature'],
      context: { lossPerM2, typical_min: 40, typical_max: 120 },
    });
  }

  // Fabric vs ventilation ratio
  const fabricRatio = result.fabricLoss / result.totalLoss;

  if (fabricRatio < 0.4) {
    warnings.push({
      code: WarningCodes.FABRIC_RATIO_LOW,
      severity: 'warning',
      category: 'calculation',
      message: 'Ventilation loss unusually high compared to fabric loss',
      suggestedFix: 'Check air change rate - may be set too high',
      affectedFields: ['airChangesPerHour'],
      context: { fabricRatio, ventilationRatio: 1 - fabricRatio },
    });
  }

  if (fabricRatio > 0.9) {
    warnings.push({
      code: WarningCodes.FABRIC_RATIO_HIGH,
      severity: 'info',
      category: 'calculation',
      message: 'Fabric loss very high compared to ventilation',
      suggestedFix: 'This may indicate very good airtightness or high ventilation loss could be underestimated',
      affectedFields: ['airChangesPerHour'],
      context: { fabricRatio, ventilationRatio: 1 - fabricRatio },
    });
  }

  // Target temperature sanity check
  const targetTemp = room.targetTemperature || 21;
  if (targetTemp > 25) {
    warnings.push({
      code: WarningCodes.TARGET_TEMP_UNUSUAL,
      severity: 'warning',
      category: 'data_quality',
      message: `Target temperature ${targetTemp}°C seems unusually high`,
      suggestedFix: 'Verify temperature setting is correct',
      affectedFields: ['targetTemperature'],
    });
  }

  return warnings;
}
