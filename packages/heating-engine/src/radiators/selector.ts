/**
 * Radiator Selection Module
 *
 * Algorithms for selecting and positioning radiators based on room requirements
 */

import {
  Radiator,
  RadiatorSelection,
  RadiatorPlacement,
  Room,
  Wall,
  FlowTemperature,
  PipeworkConfig,
  Point3D,
} from '@hail-mary/shared';

/**
 * Find the best radiator for a room from a database of available radiators
 *
 * @param requiredOutput - Required heat output in Watts
 * @param room - Room data including geometry
 * @param flowTemp - Flow/return temperature (affects radiator output)
 * @param radiatorDatabase - Available radiators to choose from
 * @returns Best radiator selection with placement, or null if no suitable radiator found
 */
export function selectRadiator(
  requiredOutput: number,
  room: Room,
  flowTemp: FlowTemperature,
  radiatorDatabase: Radiator[]
): RadiatorSelection | null {
  // 1. Filter radiators that meet output requirements
  const suitableRads = radiatorDatabase.filter(rad => {
    const output = rad.output[flowTemp];
    return output && output >= requiredOutput;
  });

  if (suitableRads.length === 0) {
    return null; // No radiators can meet the requirement
  }

  // 2. Find walls suitable for radiator installation
  const availableWalls = room.walls.filter(wall => {
    // Prefer external walls for better heat distribution
    // But internal walls are acceptable
    return true;
  });

  // 3. Try each radiator on each wall and score the combinations
  const candidates: Array<{
    radiator: Radiator;
    wall: Wall;
    placement: RadiatorPlacement;
    score: number;
  }> = [];

  for (const radiator of suitableRads) {
    for (const wall of availableWalls) {
      const placement = tryPlaceRadiator(radiator, wall, room);

      if (placement) {
        const score = scoreRadiatorPlacement(radiator, wall, room, requiredOutput, flowTemp);
        candidates.push({
          radiator,
          wall,
          placement,
          score,
        });
      }
    }
  }

  if (candidates.length === 0) {
    return null; // No radiators can physically fit
  }

  // 4. Select the best candidate
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  return {
    radiator: best.radiator,
    placement: best.placement,
    outputAtFlowTemp: best.radiator.output[flowTemp] || 0,
    score: best.score,
  };
}

/**
 * Try to place a radiator on a wall
 * Returns placement if successful, null if it doesn't fit
 */
function tryPlaceRadiator(
  radiator: Radiator,
  wall: Wall,
  room: Room
): RadiatorPlacement | null {
  // Convert radiator dimensions from mm to meters
  const radWidthM = radiator.width / 1000;
  const radHeightM = radiator.height / 1000;

  // Check if radiator fits on wall with clearances
  const clearance = 0.1; // 100mm clearance on each side
  const requiredSpace = radWidthM + (2 * clearance);

  if (wall.length < requiredSpace) {
    return null; // Wall too short
  }

  // Check for obstructions (windows, doors)
  const obstructions = [
    ...room.windows.filter(w => w.wallId === wall.id).map(w => ({
      start: w.position.x - (w.width / 2),
      end: w.position.x + (w.width / 2),
      type: 'window' as const,
      id: w.id,
    })),
    ...room.doors.filter(d => d.wallId === wall.id).map(d => ({
      start: d.position.x - (d.width / 2),
      end: d.position.x + (d.width / 2),
      type: 'door' as const,
      id: d.id,
    })),
  ];

  // Sort obstructions by position
  obstructions.sort((a, b) => a.start - b.start);

  // Try to position radiator
  let position: Point3D | null = null;

  // Priority 1: Under a window (best for comfort and condensation prevention)
  const windowOnWall = room.windows.find(w => w.wallId === wall.id);
  if (windowOnWall) {
    // Try to center radiator under window
    const windowCenter = windowOnWall.position.x;
    const radStart = windowCenter - (radWidthM / 2);
    const radEnd = windowCenter + (radWidthM / 2);

    if (radStart >= clearance && radEnd <= (wall.length - clearance)) {
      // Check if it conflicts with other obstructions
      const conflicts = obstructions.some(obs =>
        !(radEnd < obs.start || radStart > obs.end)
      );

      if (!conflicts) {
        position = {
          x: windowCenter,
          y: wall.start.y,
          z: wall.start.z + 0.1, // 100mm above floor
        };
      }
    }
  }

  // Priority 2: Find largest clear span on wall
  if (!position) {
    const clearSpans = findClearSpans(wall, obstructions);

    for (const span of clearSpans) {
      if (span.length >= requiredSpace) {
        // Center radiator in this span
        const spanCenter = span.start + (span.length / 2);
        position = {
          x: spanCenter,
          y: wall.start.y,
          z: wall.start.z + 0.1, // 100mm above floor
        };
        break;
      }
    }
  }

  if (!position) {
    return null; // No suitable position found
  }

  // Create pipework configuration
  const pipework: PipeworkConfig = {
    flowPosition: {
      x: position.x - (radWidthM / 4),
      y: position.y,
      z: position.z,
    },
    returnPosition: {
      x: position.x + (radWidthM / 4),
      y: position.y,
      z: position.z,
    },
    connectionType: radiator.connectionType,
    valveType: 'TRV', // Default to TRV
  };

  return {
    radiatorId: radiator.id,
    roomId: room.id,
    wallId: wall.id,
    position,
    heightAboveFloor: 100, // mm
    rotation: 0, // degrees
    pipework,
  };
}

/**
 * Find clear spans on a wall between obstructions
 */
interface ClearSpan {
  start: number;
  end: number;
  length: number;
}

function findClearSpans(
  wall: Wall,
  obstructions: Array<{ start: number; end: number; type: string; id: string }>
): ClearSpan[] {
  const spans: ClearSpan[] = [];

  let currentStart = 0;

  for (const obs of obstructions) {
    if (obs.start > currentStart) {
      // There's a clear span before this obstruction
      spans.push({
        start: currentStart,
        end: obs.start,
        length: obs.start - currentStart,
      });
    }
    currentStart = Math.max(currentStart, obs.end);
  }

  // Add final span after last obstruction
  if (currentStart < wall.length) {
    spans.push({
      start: currentStart,
      end: wall.length,
      length: wall.length - currentStart,
    });
  }

  // Sort by length descending (largest spans first)
  spans.sort((a, b) => b.length - a.length);

  return spans;
}

/**
 * Score a radiator placement
 * Higher score = better option
 */
function scoreRadiatorPlacement(
  radiator: Radiator,
  wall: Wall,
  room: Room,
  requiredOutput: number,
  flowTemp: FlowTemperature
): number {
  let score = 100; // Base score

  // 1. Output efficiency: prefer radiators that slightly exceed requirement
  //    but not massively oversized
  const output = radiator.output[flowTemp] || 0;
  const outputRatio = output / requiredOutput;

  if (outputRatio >= 1.0 && outputRatio <= 1.15) {
    score += 30; // Perfect size
  } else if (outputRatio > 1.15 && outputRatio <= 1.3) {
    score += 20; // Slightly oversized (acceptable)
  } else if (outputRatio > 1.3) {
    score += 5; // Too oversized (wasteful)
  } else {
    score -= 50; // Undersized (should have been filtered out)
  }

  // 2. Wall preference: external walls are better for heat distribution
  if (wall.isExternal) {
    score += 20;
  }

  // 3. Window proximity: under window is ideal
  const hasWindow = room.windows.some(w => w.wallId === wall.id);
  if (hasWindow) {
    score += 25;
  }

  // 4. Radiator type preference
  //    K2 (double panel double convector) is most efficient
  if (radiator.type === 'K2' || radiator.type === 'double') {
    score += 15;
  } else if (radiator.type === 'K1') {
    score += 10;
  } else if (radiator.type === 'single') {
    score += 5;
  }

  // 5. Size preference: smaller radiators that meet requirements are better
  const radArea = (radiator.width * radiator.height) / 1000000; // m²
  const roomArea = room.area;
  const sizeRatio = radArea / roomArea;

  if (sizeRatio < 0.05) {
    score += 10; // Compact radiator
  } else if (sizeRatio > 0.15) {
    score -= 10; // Very large radiator
  }

  // 6. Cost preference (if available)
  if (radiator.price) {
    // Prefer lower cost, but not at expense of quality
    // This is a minor factor
    const costPerWatt = radiator.price / output;
    if (costPerWatt < 0.05) {
      score += 5; // Good value
    }
  }

  return score;
}

/**
 * Select radiators for all rooms in a building
 */
export function selectRadiatorsForBuilding(
  roomHeatLosses: Array<{ roomId: string; requiredOutput: number }>,
  rooms: Room[],
  flowTemp: FlowTemperature,
  radiatorDatabase: Radiator[]
): Map<string, RadiatorSelection> {
  const selections = new Map<string, RadiatorSelection>();

  for (const heatLoss of roomHeatLosses) {
    const room = rooms.find(r => r.id === heatLoss.roomId);
    if (!room) {
      continue;
    }

    const selection = selectRadiator(
      heatLoss.requiredOutput,
      room,
      flowTemp,
      radiatorDatabase
    );

    if (selection) {
      selections.set(room.id, selection);
    }
  }

  return selections;
}

/**
 * Check if a radiator can fit on a specific wall
 */
export function canRadiatorFitOnWall(
  radiator: Radiator,
  wall: Wall,
  room: Room
): boolean {
  const placement = tryPlaceRadiator(radiator, wall, room);
  return placement !== null;
}

/**
 * Get alternative radiator suggestions if first choice doesn't fit
 */
export function getAlternativeRadiators(
  requiredOutput: number,
  room: Room,
  flowTemp: FlowTemperature,
  radiatorDatabase: Radiator[],
  excludeIds: string[] = []
): RadiatorSelection[] {
  const alternatives: RadiatorSelection[] = [];

  const suitableRads = radiatorDatabase.filter(rad => {
    const output = rad.output[flowTemp];
    return (
      output &&
      output >= requiredOutput &&
      !excludeIds.includes(rad.id)
    );
  });

  for (const radiator of suitableRads) {
    for (const wall of room.walls) {
      const placement = tryPlaceRadiator(radiator, wall, room);
      if (placement) {
        const score = scoreRadiatorPlacement(radiator, wall, room, requiredOutput, flowTemp);
        alternatives.push({
          radiator,
          placement,
          outputAtFlowTemp: radiator.output[flowTemp] || 0,
          score,
        });
        break; // Only need one placement per radiator
      }
    }
  }

  // Sort by score
  alternatives.sort((a, b) => b.score - a.score);

  return alternatives.slice(0, 5); // Return top 5 alternatives
}
