/**
 * Heat Loss UI Types
 *
 * UI-specific types for the confidence-led heat loss interface
 */

import type {
  Room,
  Wall,
  Emitter,
  HeatLossCalculations,
  ConfidenceScore,
  DataSourceType,
  SurfaceClassification,
} from '@hail-mary/shared';

/**
 * Flow temperature presets for adequacy checking
 */
export type FlowTemp = 45 | 55 | 75;

/**
 * Adequacy status for radiators at different flow temps
 */
export type AdequacyStatus = 'ok' | 'upsize' | 'major_upsize' | 'unknown';

/**
 * Confidence color scheme
 */
export type ConfidenceColor = 'green' | 'amber' | 'red';

/**
 * Risk icons for surface assumptions
 */
export type RiskIcon = 'assumed_wall' | 'unknown_glazing' | 'unheated_adjacent';

/**
 * Room summary for dashboard grid
 */
export interface RoomSummary {
  room_id: string;
  room_name: string;
  heat_loss_w: number;
  confidence_color: ConfidenceColor;
  confidence_score: number; // 0-100
  risk_icons: RiskIcon[];
  adequacy_45: AdequacyStatus;
  adequacy_55: AdequacyStatus;
  adequacy_75: AdequacyStatus;
}

/**
 * Surface row data for room detail view
 */
export interface SurfaceRow {
  surface_id: string;
  surface_name: string;
  surface_type: 'wall' | 'window' | 'door' | 'roof' | 'floor';
  classification: SurfaceClassification;
  heat_loss_w: number;
  source_badge: DataSourceType;
  confidence: ConfidenceScore;
  u_value?: number;
  area_m2?: number;
  assumed_temp_c?: number; // For unheated adjacent
}

/**
 * Heat loss breakdown for visualization
 */
export interface HeatLossBreakdown {
  transmission_w: number;
  ventilation_w: number;
  thermal_bridge_uplift_w: number;
  setback_recovery_w: number;
  total_w: number;
}

/**
 * Context-aware action for upgrading confidence
 */
export interface UpgradeAction {
  action_id: string;
  type: 'scan_geometry' | 'confirm_wall' | 'confirm_insulation' | 'attach_photo' | 'set_unheated_temp';
  label: string;
  description: string;
  surface_ids?: string[]; // Which surfaces this action improves
  estimated_time_sec: number;
}

/**
 * Heat loss state for UI
 */
export interface HeatLossState {
  // Input data
  rooms: Room[];
  walls: Wall[];
  emitters: Emitter[];

  // Calculation results
  calculations: HeatLossCalculations | null;

  // UI state
  selectedFlowTemp: FlowTemp;
  selectedRoomId: string | null;
  isCalculating: boolean;
  error: string | null;
  lastCalculatedAt: Date | null;

  // Derived summaries
  roomSummaries: RoomSummary[];
  wholeHouseConfidence: number; // 0-100
}
