/**
 * Heat Loss Calculation Engine
 *
 * Pure functions for calculating heat loss based on EN 12831 methodology
 * and MCS Heat Pump Calculator standards.
 */

import {
  HeatLossInputs,
  HeatLossResult,
  HeatLossBreakdown,
  WallLoss,
  WindowLoss,
  DoorLoss,
  Room,
  BuildingData,
  ClimateData,
  DesignConditions,
} from '@hail-mary/shared';

import {
  getWallUValue,
  getRoofUValue,
  getFloorUValue,
  getGlazingUValue,
  getTargetTemperature,
} from '@hail-mary/shared';

/**
 * Calculate heat loss for a single room
 *
 * Q = Q_fabric + Q_ventilation
 * Q_fabric = Σ(U × A × ΔT) for all building elements
 * Q_ventilation = 0.33 × n × V × ΔT
 *
 * @param inputs - Complete heat loss calculation inputs
 * @returns Heat loss result with breakdown
 */
export function calculateRoomHeatLoss(inputs: HeatLossInputs): HeatLossResult {
  const { room, building, climate, designConditions } = inputs;

  // Determine target temperature for this room
  const targetTemp = room.targetTemperature || getTargetTemperature(room.type);
  const deltaT = targetTemp - climate.outsideDesignTemp;

  // Calculate fabric losses
  const wallLosses = calculateWallLosses(room, building, deltaT, designConditions);
  const windowLosses = calculateWindowLosses(room, deltaT);
  const doorLosses = calculateDoorLosses(room, deltaT);
  const floorLoss = calculateFloorLoss(room, building, deltaT);
  const ceilingLoss = calculateCeilingLoss(room, building, deltaT);
  const thermalBridgingLoss = calculateThermalBridging(room, building, deltaT, designConditions);

  const totalFabricLoss =
    wallLosses.reduce((sum, w) => sum + w.loss, 0) +
    windowLosses.reduce((sum, w) => sum + w.loss, 0) +
    doorLosses.reduce((sum, d) => sum + d.loss, 0) +
    floorLoss +
    ceilingLoss +
    thermalBridgingLoss;

  // Calculate ventilation/infiltration loss
  // Q = 0.33 × n × V × ΔT
  // where n = air changes per hour, V = volume in m³
  const infiltrationLoss = 0.33 * building.airChangesPerHour * room.volume * deltaT;

  const totalLoss = totalFabricLoss + infiltrationLoss;

  // Apply safety margin
  const safetyMarginMultiplier = 1 + (designConditions.safetyMargin / 100);
  const requiredOutput = totalLoss * safetyMarginMultiplier;

  const breakdown: HeatLossBreakdown = {
    walls: wallLosses,
    windows: windowLosses,
    doors: doorLosses,
    floor: floorLoss,
    ceiling: ceilingLoss,
    thermalBridging: thermalBridgingLoss,
    infiltration: infiltrationLoss,
  };

  return {
    roomId: room.id,
    fabricLoss: totalFabricLoss,
    ventilationLoss: infiltrationLoss,
    totalLoss,
    breakdown,
    requiredOutput,
    calculatedAt: new Date(),
    overridden: false,
  };
}

/**
 * Calculate heat loss through walls
 * Only external walls contribute to heat loss
 */
function calculateWallLosses(
  room: Room,
  building: BuildingData,
  deltaT: number,
  designConditions: DesignConditions
): WallLoss[] {
  const losses: WallLoss[] = [];

  for (const wall of room.walls) {
    if (!wall.isExternal) {
      continue; // Internal walls don't contribute to heat loss
    }

    // Get U-value (use wall-specific override or building default)
    const uValue = wall.uValue ||
                   building.wallUValue ||
                   getWallUValue(building.wallConstruction);

    // Calculate wall area (accounting for windows and doors on this wall)
    const windowArea = room.windows
      .filter(w => w.wallId === wall.id)
      .reduce((sum, w) => sum + (w.width * w.height), 0);

    const doorArea = room.doors
      .filter(d => d.wallId === wall.id)
      .reduce((sum, d) => sum + (d.width * d.height), 0);

    const netWallArea = (wall.length * wall.height) - windowArea - doorArea;

    if (netWallArea <= 0) {
      continue; // No wall area after accounting for openings
    }

    // Q = U × A × ΔT
    const loss = uValue * netWallArea * deltaT;

    losses.push({
      wallId: wall.id,
      area: netWallArea,
      uValue,
      deltaT,
      loss,
    });
  }

  return losses;
}

/**
 * Calculate heat loss through windows
 */
function calculateWindowLosses(room: Room, deltaT: number): WindowLoss[] {
  const losses: WindowLoss[] = [];

  for (const window of room.windows) {
    const area = window.width * window.height;
    const uValue = window.uValue || getGlazingUValue(window.glazingType);

    // Q = U × A × ΔT
    const loss = uValue * area * deltaT;

    losses.push({
      windowId: window.id,
      area,
      uValue,
      deltaT,
      loss,
    });
  }

  return losses;
}

/**
 * Calculate heat loss through doors
 */
function calculateDoorLosses(room: Room, deltaT: number): DoorLoss[] {
  const losses: DoorLoss[] = [];

  for (const door of room.doors) {
    if (!door.isExternal) {
      continue; // Only external doors contribute to heat loss
    }

    const area = door.width * door.height;
    const uValue = door.uValue; // Must be provided for each door

    // Q = U × A × ΔT
    const loss = uValue * area * deltaT;

    losses.push({
      doorId: door.id,
      area,
      uValue,
      deltaT,
      loss,
    });
  }

  return losses;
}

/**
 * Calculate heat loss through floor
 * Ground floors use P-factor method or simplified U-value approach
 */
function calculateFloorLoss(
  room: Room,
  building: BuildingData,
  deltaT: number
): number {
  // Simplified approach: use floor U-value × area × ΔT
  // More sophisticated: use P-factor based on perimeter/area ratio

  const uValue = building.floorUValue || getFloorUValue(building.floorConstruction);

  // For ground floors, reduce ΔT as ground temperature is higher than air
  // Typical ground temperature in UK is ~10°C
  // For simplicity, use 50% of air ΔT for ground floors
  const effectiveDeltaT = deltaT * 0.5;

  return uValue * room.area * effectiveDeltaT;
}

/**
 * Calculate heat loss through ceiling/roof
 * Only for top-floor rooms
 */
function calculateCeilingLoss(
  room: Room,
  building: BuildingData,
  deltaT: number
): number {
  // For now, simplified approach
  // In full implementation, would check if room is on top floor
  // For middle floors, no ceiling loss

  // TODO: Add floor level detection from room data
  // For now, assume if room has exposed roof, calculate loss

  const uValue = building.roofUValue || getRoofUValue(building.roofConstruction);

  // Only calculate if this is likely a top floor room
  // This is a simplification - should be determined from floor plan data
  return 0; // Will be implemented when floor plan parsing is complete
}

/**
 * Calculate thermal bridging losses
 * Y-value approach: add to overall U-value
 */
function calculateThermalBridging(
  room: Room,
  building: BuildingData,
  deltaT: number,
  designConditions: DesignConditions
): number {
  // Thermal bridging is calculated as:
  // Q = Y × A × ΔT
  // where Y is the thermal bridging linear transmission coefficient
  // and A is the external wall area

  const externalWallArea = room.walls
    .filter(w => w.isExternal)
    .reduce((sum, w) => sum + (w.length * w.height), 0);

  const yValue = designConditions.thermalBridging;

  return yValue * externalWallArea * deltaT;
}

/**
 * Calculate heat loss for entire building (all rooms)
 */
export function calculateBuildingHeatLoss(
  rooms: Room[],
  building: BuildingData,
  climate: ClimateData,
  designConditions: DesignConditions
): HeatLossResult[] {
  return rooms.map(room => calculateRoomHeatLoss({
    room,
    building,
    climate,
    designConditions,
  }));
}

/**
 * Calculate total heat load for the building
 */
export function calculateTotalHeatLoad(results: HeatLossResult[]): number {
  return results.reduce((sum, result) => sum + result.requiredOutput, 0);
}

/**
 * Validate heat loss calculation inputs
 * Returns array of validation errors, empty if valid
 */
export function validateHeatLossInputs(inputs: HeatLossInputs): string[] {
  const errors: string[] = [];

  const { room, building, climate, designConditions } = inputs;

  // Validate room data
  if (room.area <= 0) {
    errors.push(`Room ${room.name}: Area must be greater than 0`);
  }

  if (room.volume <= 0) {
    errors.push(`Room ${room.name}: Volume must be greater than 0`);
  }

  if (room.ceilingHeight <= 0) {
    errors.push(`Room ${room.name}: Ceiling height must be greater than 0`);
  }

  // Validate building data
  if (building.airChangesPerHour < 0.1 || building.airChangesPerHour > 10) {
    errors.push('Air changes per hour must be between 0.1 and 10');
  }

  // Validate climate data
  if (climate.outsideDesignTemp > 10) {
    errors.push('Outside design temperature seems too high (should be negative for UK)');
  }

  // Validate design conditions
  if (designConditions.safetyMargin < 0 || designConditions.safetyMargin > 50) {
    errors.push('Safety margin should be between 0% and 50%');
  }

  // Check for suspicious results
  const targetTemp = room.targetTemperature || getTargetTemperature(room.type);
  if (targetTemp > 30) {
    errors.push(`Room ${room.name}: Target temperature ${targetTemp}°C seems too high`);
  }

  return errors;
}

/**
 * Analyze heat loss result for potential issues
 * Returns warnings for suspicious values
 */
export function analyzeHeatLossResult(result: HeatLossResult, room: Room): string[] {
  const warnings: string[] = [];

  // Calculate heat loss per square meter
  const lossPerM2 = result.totalLoss / room.area;

  // Typical heat loss per m² in UK is 40-120 W/m²
  // Below 30 W/m² suggests very good insulation
  // Above 150 W/m² suggests poor insulation or calculation error

  if (lossPerM2 < 30) {
    warnings.push(`Very low heat loss (${lossPerM2.toFixed(1)} W/m²) - check insulation values`);
  }

  if (lossPerM2 > 150) {
    warnings.push(`Very high heat loss (${lossPerM2.toFixed(1)} W/m²) - check U-values and room data`);
  }

  // Check fabric vs ventilation ratio
  // Typically fabric loss should be 60-80% of total
  const fabricRatio = result.fabricLoss / result.totalLoss;

  if (fabricRatio < 0.4) {
    warnings.push('Ventilation loss is unusually high - check air change rate');
  }

  if (fabricRatio > 0.9) {
    warnings.push('Fabric loss is unusually high compared to ventilation - check air change rate');
  }

  return warnings;
}
