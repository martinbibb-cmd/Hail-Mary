/**
 * Confidence Calculation Utilities
 *
 * Calculate confidence scores and colors for heat loss data
 */

import type {
  Room,
  Wall,
  ConfidenceScore,
  DataSourceType,
  AuditTrailEntry,
} from '@hail-mary/shared';
import type { ConfidenceColor, RiskIcon, RoomSummary } from './types';

/**
 * Convert confidence score to numeric value (0-100)
 */
export function confidenceToNumber(score: ConfidenceScore): number {
  switch (score) {
    case 'high':
      return 90;
    case 'medium':
      return 60;
    case 'low':
      return 30;
    default:
      return 30;
  }
}

/**
 * Convert numeric confidence to color
 */
export function confidenceToColor(score: number): ConfidenceColor {
  if (score >= 80) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}

/**
 * Calculate room confidence from walls and audit trail
 */
export function calculateRoomConfidence(
  room: Room,
  walls: Wall[],
  auditTrail: AuditTrailEntry[]
): { score: number; color: ConfidenceColor; riskIcons: RiskIcon[] } {
  const riskIcons: RiskIcon[] = [];
  let totalConfidence = 0;
  let count = 0;

  // Check geometry confidence
  // Note: RoomDimensions interface doesn't have source_type property,
  // so we default to ASSUMED. This should be enhanced in future to track
  // room dimension data sources via audit trail or room metadata.
  const geometrySource = 'ASSUMED'; // Default since RoomDimensions doesn't have source_type
  if (geometrySource === 'LIDAR') {
    totalConfidence += 90;
  } else if (geometrySource === 'MANUAL') {
    totalConfidence += 60;
  } else {
    totalConfidence += 30;
    riskIcons.push('assumed_wall');
  }
  count++;

  // Check wall confidence
  for (const wall of walls) {
    const wallConfidence = wall.confidence_score
      ? confidenceToNumber(wall.confidence_score)
      : 30;

    totalConfidence += wallConfidence;
    count++;

    // Check for risk factors
    if (wall.surface_classification === 'UNHEATED_ADJACENT') {
      riskIcons.push('unheated_adjacent');
    }

    if (!wall.u_value_measured && !wall.u_value_calculated) {
      riskIcons.push('unknown_glazing');
    }

    if (wall.source_type === 'ASSUMED' || wall.source_type === 'TABLE_LOOKUP') {
      if (!riskIcons.includes('assumed_wall')) {
        riskIcons.push('assumed_wall');
      }
    }
  }

  const avgConfidence = count > 0 ? totalConfidence / count : 30;
  const color = confidenceToColor(avgConfidence);

  return {
    score: Math.round(avgConfidence),
    color,
    riskIcons: Array.from(new Set(riskIcons)), // Remove duplicates
  };
}

/**
 * Calculate whole-house confidence from room summaries
 */
export function calculateWholeHouseConfidence(
  roomSummaries: RoomSummary[]
): number {
  if (roomSummaries.length === 0) return 0;

  const totalConfidence = roomSummaries.reduce(
    (sum, room) => sum + room.confidence_score,
    0
  );

  return Math.round(totalConfidence / roomSummaries.length);
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
 * Get risk icon label
 */
export function getRiskIconLabel(icon: RiskIcon): string {
  switch (icon) {
    case 'assumed_wall':
      return 'Assumed wall construction';
    case 'unknown_glazing':
      return 'Unknown glazing U-value';
    case 'unheated_adjacent':
      return 'Unheated adjacent space';
    default:
      return 'Unknown risk';
  }
}

/**
 * Get confidence color CSS class
 */
export function getConfidenceColorClass(color: ConfidenceColor): string {
  return `confidence-${color}`;
}

/**
 * Determine if room needs urgent attention (red confidence)
 */
export function needsUrgentAttention(confidence: number): boolean {
  return confidence < 50;
}

/**
 * Get next best action message based on risk icons
 */
export function getNextBestActionMessage(riskIcons: RiskIcon[]): string {
  if (riskIcons.length === 0) {
    return 'Confidence is high - no urgent actions needed';
  }

  if (riskIcons.includes('assumed_wall')) {
    return 'Confirm wall construction type (10 sec)';
  }

  if (riskIcons.includes('unknown_glazing')) {
    return 'Confirm glazing type (10 sec)';
  }

  if (riskIcons.includes('unheated_adjacent')) {
    return 'Set unheated adjacent temp model';
  }

  return 'Scan geometry with RoomPlan';
}
