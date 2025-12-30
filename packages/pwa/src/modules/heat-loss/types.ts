/**
 * Heat Loss UI Types (Refined v2)
 *
 * Updated to support:
 * - 3-layer confidence system
 * - Validation states (READY/PROVISIONAL/INCOMPLETE)
 * - Risk flags (not icons)
 * - Deterministic upgrade actions
 */

import type {
  Room,
  Wall,
  Emitter,
  HeatLossCalculations,
  RoomHeatLoss,
  AuditTrailEntry,
  DataSourceType,
  SurfaceClassification,
} from '@hail-mary/shared';

// ============================================
// Validation & Confidence
// ============================================

/**
 * Validation state for calculation readiness
 */
export type ValidationState = 'READY' | 'PROVISIONAL' | 'INCOMPLETE';

/**
 * Confidence color scheme
 */
export type ConfidenceColor = 'green' | 'amber' | 'red';

/**
 * Risk flags (why confidence is low)
 */
export type RiskFlag =
  | 'GEOMETRY_ASSUMED' // Room dimensions assumed
  | 'WALL_CONSTRUCTION_ASSUMED' // Wall type or U-value assumed
  | 'GLAZING_ASSUMED' // Window/door U-value assumed
  | 'UNHEATED_ADJACENT_MODEL' // Garage/porch temp model used
  | 'ACH_ASSUMED' // Air changes from age band, not blower test
  | 'MISSING_EXTERNAL_WALLS'; // No external wall data found

// ============================================
// Flow Temperature & Adequacy
// ============================================

/**
 * Flow temperature presets
 */
export type FlowTemp = 45 | 55 | 75;

/**
 * Emitter adequacy status
 */
export type AdequacyStatus = 'ok' | 'upsize' | 'major_upsize' | 'unknown';

/**
 * Adequacy result for all flow temps (returned by API once)
 */
export interface AdequacyAtAllTemps {
  at_45c: { adequate: boolean; shortfall_w: number } | null;
  at_55c: { adequate: boolean; shortfall_w: number } | null;
  at_75c: { adequate: boolean; shortfall_w: number } | null;
}

// ============================================
// Room Summary (Dashboard)
// ============================================

/**
 * Room summary for dashboard grid
 */
export interface RoomSummary {
  room_id: string;
  room_name: string;
  heat_loss_w: number;

  // Layer 2: Room confidence
  confidence_score: number; // 0-100
  confidence_color: ConfidenceColor;
  risk_flags: RiskFlag[];

  // Adequacy (pre-computed for all temps, instant toggle)
  adequacy_at_all_temps: AdequacyAtAllTemps;
}

// ============================================
// Surface Detail (Room Detail View)
// ============================================

/**
 * Surface row data
 */
export interface SurfaceRow {
  surface_id: string;
  surface_name: string;
  surface_type: 'wall' | 'window' | 'door' | 'roof' | 'floor';
  classification: SurfaceClassification;
  heat_loss_w: number;
  source_badge: DataSourceType;
  confidence_score: number; // Field confidence (0-100)
  u_value?: number;
  area_m2?: number;
  assumed_temp_c?: number; // For unheated adjacent
}

// ============================================
// Heat Loss Breakdown
// ============================================

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

// ============================================
// Upgrade Actions (Deterministic)
// ============================================

/**
 * Context-aware upgrade action
 */
export interface UpgradeAction {
  action_id: string;
  type:
    | 'scan_geometry'
    | 'confirm_wall'
    | 'confirm_insulation'
    | 'confirm_glazing'
    | 'attach_photo'
    | 'set_unheated_temp'
    | 'set_ach_method';
  label: string;
  reason: string; // Why this action improves confidence
  estimated_time_sec: number;
  target_risk_flags: RiskFlag[]; // Which risks this action addresses
  priority: number; // 1 = highest
}

/**
 * Generate upgrade actions for a room based on risk flags
 */
export type GetUpgradeActionsFn = (
  roomId: string,
  riskFlags: RiskFlag[],
  walls: Wall[]
) => UpgradeAction[];

// ============================================
// Heat Loss State (Store)
// ============================================

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

  // Validation state
  validationState: ValidationState;

  // UI state
  selectedFlowTemp: FlowTemp;
  selectedRoomId: string | null;
  isCalculating: boolean;
  error: string | null;
  lastCalculatedAt: Date | null;

  // Derived summaries
  roomSummaries: RoomSummary[];

  // Layer 3: Result confidence (whole house)
  wholeHouseConfidence: number; // 0-100, weighted by heat loss contribution
}

// ============================================
// API Response Contract
// ============================================

/**
 * What the UI expects from /api/atlas/calculate-heat-loss
 */
export interface AtlasHeatLossResponse {
  success: boolean;
  data?: {
    // Summary
    whole_house_heat_loss_w: number;
    whole_house_heat_loss_kw: number;

    // Room-by-room
    room_heat_losses: RoomHeatLoss[];

    // Config used
    design_conditions: {
      design_external_temp_c: number;
      desired_internal_temp_c: number;
    };

    // Audit trail (for source transparency)
    audit_trail: AuditTrailEntry[];

    // Optional: adequacy for all temps (if API returns it)
    // If not present, UI can compute client-side
    adequacy_at_all_temps?: Map<string, AdequacyAtAllTemps>; // roomId -> adequacy
  };
  error?: string;
}
