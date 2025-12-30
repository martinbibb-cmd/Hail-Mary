/**
 * Refined Confidence System (v2)
 *
 * Three-layer confidence model:
 * 1. Field Confidence: per-input based on source type + recency
 * 2. Room Confidence: weighted rollup (external walls + glazing dominate)
 * 3. Result Confidence: whole-house weighted by heat loss contribution
 */

import type {
  Room,
  Wall,
  RoomHeatLoss,
  DataSourceType,
} from '@hail-mary/shared';
import type { ConfidenceColor, RiskFlag, ValidationState } from './types';

// ============================================
// Layer 1: Field Confidence
// ============================================

/**
 * Calculate confidence for a single field/input
 * @param sourceType - How the data was captured
 * @param recencyDays - Days since measurement (optional)
 * @returns 0-100 confidence score
 */
export function calculateFieldConfidence(
  sourceType: DataSourceType,
  recencyDays?: number
): number {
  // Base score from source type
  let baseScore: number;
  switch (sourceType) {
    case 'LIDAR':
    case 'THERMAL_CAMERA':
    case 'BOROSCOPE':
      baseScore = 95;
      break;
    case 'MANUAL':
      baseScore = 70;
      break;
    case 'SATELLITE':
      baseScore = 50;
      break;
    case 'TABLE_LOOKUP':
      baseScore = 40;
      break;
    case 'ASSUMED':
      baseScore = 20;
      break;
    default:
      baseScore = 20;
  }

  // Degrade score based on recency
  if (recencyDays !== undefined && recencyDays > 365) {
    const yearsDelta = recencyDays / 365;
    baseScore *= Math.max(0.5, 1 - yearsDelta * 0.1); // Max 50% degradation
  }

  return Math.round(Math.min(100, Math.max(0, baseScore)));
}

// ============================================
// Layer 2: Room Confidence (Weighted Rollup)
// ============================================

/**
 * Calculate room confidence with weighted rollup
 * External walls and glazing dominate the score
 */
export function calculateRoomConfidence(
  room: Room,
  walls: Wall[]
): { score: number; color: ConfidenceColor; riskFlags: RiskFlag[] } {
  const riskFlags: RiskFlag[] = [];

  // Weighted scores (external walls + glazing are critical)
  let geometryWeight = 0.2;
  let externalWallWeight = 0.4;
  let glazingWeight = 0.3;
  let otherWeight = 0.1;

  let geometryScore = 0;
  let externalWallScore = 0;
  let glazingScore = 0;
  let otherScore = 0;

  // 1. Geometry confidence
  const geometrySource = room.dimensions.source_type || 'ASSUMED';
  geometryScore = calculateFieldConfidence(geometrySource);

  if (geometryScore < 50) {
    riskFlags.push('GEOMETRY_ASSUMED');
  }

  // 2. External walls confidence
  const externalWalls = walls.filter(
    (w) => w.surface_classification === 'EXTERNAL'
  );

  if (externalWalls.length > 0) {
    const wallScores = externalWalls.map((w) =>
      calculateFieldConfidence(w.source_type || 'ASSUMED')
    );
    externalWallScore =
      wallScores.reduce((sum, s) => sum + s, 0) / wallScores.length;

    // Check for assumed walls
    const hasAssumedWalls = externalWalls.some(
      (w) =>
        w.source_type === 'ASSUMED' ||
        w.source_type === 'TABLE_LOOKUP' ||
        (!w.u_value_measured && !w.u_value_calculated)
    );

    if (hasAssumedWalls) {
      riskFlags.push('WALL_CONSTRUCTION_ASSUMED');
    }
  } else {
    // No external walls found - probably missing data
    externalWallScore = 20;
    riskFlags.push('MISSING_EXTERNAL_WALLS');
  }

  // 3. Glazing confidence (windows/doors)
  // For now, assume if walls have low confidence, glazing also does
  // TODO: Add explicit glazing elements to Room/Wall types
  glazingScore = externalWallScore; // Placeholder

  if (glazingScore < 50) {
    riskFlags.push('GLAZING_ASSUMED');
  }

  // 4. Other factors (unheated adjacent, etc.)
  const unheatedWalls = walls.filter(
    (w) => w.surface_classification === 'UNHEATED_ADJACENT'
  );

  if (unheatedWalls.length > 0) {
    riskFlags.push('UNHEATED_ADJACENT_MODEL');
    otherScore = 60; // Model assumption reduces confidence
  } else {
    otherScore = 80; // No special cases
  }

  // Weighted average
  const totalScore =
    geometryScore * geometryWeight +
    externalWallScore * externalWallWeight +
    glazingScore * glazingWeight +
    otherScore * otherWeight;

  const score = Math.round(totalScore);
  const color = confidenceToColor(score);

  return {
    score,
    color,
    riskFlags: Array.from(new Set(riskFlags)),
  };
}

// ============================================
// Layer 3: Result Confidence (Whole House)
// ============================================

/**
 * Calculate whole-house confidence weighted by heat loss contribution
 */
export function calculateResultConfidence(
  roomHeatLosses: RoomHeatLoss[],
  roomConfidences: Map<string, number>
): number {
  if (roomHeatLosses.length === 0) return 0;

  const totalHeatLoss = roomHeatLosses.reduce(
    (sum, r) => sum + r.total_heat_loss_w,
    0
  );

  if (totalHeatLoss === 0) return 0;

  // Weight each room's confidence by its heat loss contribution
  let weightedSum = 0;
  for (const roomHL of roomHeatLosses) {
    const roomConfidence = roomConfidences.get(roomHL.room_id) || 50;
    const weight = roomHL.total_heat_loss_w / totalHeatLoss;
    weightedSum += roomConfidence * weight;
  }

  return Math.round(weightedSum);
}

// ============================================
// Validation State
// ============================================

/**
 * Determine validation state for the calculation
 */
export function getValidationState(
  rooms: Room[],
  walls: Wall[],
  roomConfidences: Map<string, number>
): ValidationState {
  // Check for critical missing data
  if (rooms.length === 0) {
    return 'INCOMPLETE';
  }

  // Check for invalid geometry
  for (const room of rooms) {
    if (
      room.dimensions.floor_area_m2 <= 0 ||
      room.dimensions.volume_m3 <= 0
    ) {
      return 'INCOMPLETE';
    }
  }

  // Check room confidence scores
  const lowConfidenceRooms = Array.from(roomConfidences.values()).filter(
    (score) => score < 50
  );

  // If >50% of rooms have low confidence, mark as PROVISIONAL
  if (lowConfidenceRooms.length / rooms.length > 0.5) {
    return 'PROVISIONAL';
  }

  // If any critical assumptions present, mark as PROVISIONAL
  if (lowConfidenceRooms.length > 0) {
    return 'PROVISIONAL';
  }

  return 'READY';
}

// ============================================
// Utilities
// ============================================

/**
 * Convert numeric confidence (0-100) to color
 */
export function confidenceToColor(score: number): ConfidenceColor {
  if (score >= 80) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}

/**
 * Get source badge label
 */
export function getSourceBadgeLabel(source: DataSourceType): string {
  switch (source) {
    case 'LIDAR':
      return 'LiDAR';
    case 'MANUAL':
      return 'Manual';
    case 'THERMAL_CAMERA':
      return 'Thermal';
    case 'BOROSCOPE':
      return 'Borescope';
    case 'ASSUMED':
      return 'Assumed';
    case 'TABLE_LOOKUP':
      return 'Table';
    case 'SATELLITE':
      return 'Satellite';
    default:
      return 'Unknown';
  }
}

/**
 * Get risk flag label
 */
export function getRiskFlagLabel(flag: RiskFlag): string {
  switch (flag) {
    case 'GEOMETRY_ASSUMED':
      return 'Room geometry assumed';
    case 'WALL_CONSTRUCTION_ASSUMED':
      return 'Wall construction or U-value assumed';
    case 'GLAZING_ASSUMED':
      return 'Glazing type or U-value assumed';
    case 'UNHEATED_ADJACENT_MODEL':
      return 'Unheated adjacent space temperature model used';
    case 'ACH_ASSUMED':
      return 'Air changes per hour assumed from age band';
    case 'MISSING_EXTERNAL_WALLS':
      return 'Missing external wall data';
    default:
      return 'Unknown risk';
  }
}

/**
 * Get risk flag icon emoji
 */
export function getRiskFlagIcon(flag: RiskFlag): string {
  switch (flag) {
    case 'GEOMETRY_ASSUMED':
      return '📏';
    case 'WALL_CONSTRUCTION_ASSUMED':
      return '🧱';
    case 'GLAZING_ASSUMED':
      return '🪟';
    case 'UNHEATED_ADJACENT_MODEL':
      return '❄️';
    case 'ACH_ASSUMED':
      return '💨';
    case 'MISSING_EXTERNAL_WALLS':
      return '⚠️';
    default:
      return '❓';
  }
}

/**
 * Get CSS class for confidence color
 */
export function getConfidenceColorClass(color: ConfidenceColor): string {
  return `confidence-${color}`;
}

/**
 * Check if room needs urgent attention
 */
export function needsUrgentAttention(confidence: number): boolean {
  return confidence < 50;
}
