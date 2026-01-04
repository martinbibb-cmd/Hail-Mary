/**
 * Physics-First Heat Loss Calculation Utilities
 *
 * Professional-grade thermal calculations for heat loss surveys
 * Implements the "Stroma-Killer" approach with measured U-values from thermal cameras
 */

import {
  UValueCalculationInput,
  UValueCalculationResult,
  HeatLossCalculationInput,
  HeatLossCalculationResult,
  RadiatorOutputInput,
  RadiatorOutputResult,
  RadiatorPanelType,
} from '../types/heat-loss-survey.types';

// ============================================
// Physical Constants
// ============================================

/**
 * Standard UK design external temperature (°C)
 * MCS standard for heat loss calculations
 */
export const DESIGN_EXTERNAL_TEMP_C = -3;

/**
 * Standard UK internal design temperature (°C)
 * Living areas
 */
export const DESIGN_INTERNAL_TEMP_C = 21;

/**
 * Standard UK internal design temperature (°C)
 * Bedrooms
 */
export const DESIGN_BEDROOM_TEMP_C = 18;

/**
 * Standard surface heat transfer coefficients (W/m²K)
 * Used in U-value calculations
 */
export const SURFACE_RESISTANCE = {
  INTERNAL: 0.13, // Internal surface resistance (m²K/W)
  EXTERNAL: 0.04, // External surface resistance (m²K/W)
};

// ============================================
// U-Value Calculations (The "Stroma-Killer" Move)
// ============================================

/**
 * Calculate U-value from thermal camera measurements
 *
 * This is the "Pro Trick" that separates Atlas from virtual-only apps.
 * By measuring the temperature delta (ΔT) across a wall with a thermal camera,
 * you can calculate the actual thermal resistance of that specific wall.
 *
 * Formula: U = Q / (A × ΔT)
 * Where:
 * - Q = Heat flux (W/m²)
 * - A = Area (m²)
 * - ΔT = Temperature difference (K)
 *
 * For surface measurements:
 * U ≈ (T_internal_air - T_external_air) / ((T_internal_surface - T_external_surface) × R_total)
 *
 * @param input - Temperature measurements from thermal camera
 * @returns Calculated U-value and intermediate values
 */
export function calculateUValueFromThermalImaging(
  input: UValueCalculationInput
): UValueCalculationResult {
  const {
    internal_surface_temp_c,
    external_surface_temp_c,
    internal_air_temp_c,
    external_air_temp_c,
  } = input;

  // Calculate temperature differences
  const delta_t_surface = internal_surface_temp_c - external_surface_temp_c;
  const delta_t_air = internal_air_temp_c - external_air_temp_c;

  // Heat flux through the surface (W/m²)
  // Q = h_i × (T_air_internal - T_surface_internal)
  // Where h_i is the internal heat transfer coefficient (~8 W/m²K)
  const h_internal = 8.0; // W/m²K
  const heat_flux_w_m2 = h_internal * (internal_air_temp_c - internal_surface_temp_c);

  // U-value calculation
  // U = heat_flux / delta_t_air
  let u_value_w_m2k = 0;
  if (delta_t_air !== 0) {
    u_value_w_m2k = Math.abs(heat_flux_w_m2 / delta_t_air);
  }

  // Alternative method using surface temperatures
  // More accurate when you have external surface temperature
  if (delta_t_surface !== 0 && external_surface_temp_c !== undefined) {
    const r_total = SURFACE_RESISTANCE.INTERNAL + SURFACE_RESISTANCE.EXTERNAL;
    const u_value_alternative = delta_t_air / (delta_t_surface * (1 / r_total));

    // Use average of both methods for better accuracy
    u_value_w_m2k = (u_value_w_m2k + Math.abs(u_value_alternative)) / 2;
  }

  return {
    u_value_w_m2k: Math.round(u_value_w_m2k * 100) / 100, // Round to 2 decimal places
    delta_t_surface: Math.round(delta_t_surface * 10) / 10,
    delta_t_air: Math.round(delta_t_air * 10) / 10,
    heat_flux_w_m2: Math.round(heat_flux_w_m2 * 10) / 10,
  };
}

/**
 * Adjust U-value for moisture content
 *
 * Wet walls have significantly higher thermal conductivity.
 * This function adjusts the U-value based on moisture meter readings.
 *
 * @param u_value_dry - Dry U-value (W/m²K)
 * @param moisture_percent - Moisture content (%)
 * @returns Adjusted U-value accounting for moisture
 */
export function adjustUValueForMoisture(
  u_value_dry: number,
  moisture_percent: number
): number {
  // Empirical correction factor:
  // Every 1% moisture increases heat loss by ~5%
  const moisture_factor = 1 + (moisture_percent * 0.05);
  const u_value_wet = u_value_dry * moisture_factor;

  return Math.round(u_value_wet * 100) / 100;
}

// ============================================
// Heat Loss Calculations
// ============================================

/**
 * Calculate heat loss through a building element
 *
 * Q = U × A × ΔT
 *
 * Where:
 * - Q = Heat loss (Watts)
 * - U = Thermal transmittance (W/m²K)
 * - A = Area (m²)
 * - ΔT = Temperature difference (K)
 *
 * @param input - U-value, area, and temperature difference
 * @returns Heat loss in Watts
 */
export function calculateHeatLoss(
  input: HeatLossCalculationInput
): HeatLossCalculationResult {
  const { u_value, area_m2, delta_t } = input;

  const heat_loss_w = u_value * area_m2 * delta_t;

  return {
    heat_loss_w: Math.round(heat_loss_w),
  };
}

/**
 * Calculate ventilation heat loss
 *
 * Q_vent = 0.33 × n × V × ΔT
 *
 * Where:
 * - Q_vent = Ventilation heat loss (W)
 * - 0.33 = Specific heat capacity of air (Wh/m³K)
 * - n = Air changes per hour (ACH)
 * - V = Volume (m³)
 * - ΔT = Temperature difference (K)
 *
 * @param volume_m3 - Room/building volume (m³)
 * @param air_changes_per_hour - ACH rate
 * @param delta_t - Internal to external temperature difference (K)
 * @returns Ventilation heat loss in Watts
 */
export function calculateVentilationHeatLoss(
  volume_m3: number,
  air_changes_per_hour: number,
  delta_t: number
): number {
  const q_vent = 0.33 * air_changes_per_hour * volume_m3 * delta_t;
  return Math.round(q_vent);
}

/**
 * Calculate total room heat loss
 *
 * Combines fabric losses (walls, windows, doors, floor, ceiling) with ventilation losses
 *
 * @param fabric_loss_w - Total fabric heat loss (W)
 * @param ventilation_loss_w - Ventilation heat loss (W)
 * @param safety_margin_percent - Safety margin (default 10%)
 * @returns Total heat loss with safety margin
 */
export function calculateTotalRoomHeatLoss(
  fabric_loss_w: number,
  ventilation_loss_w: number,
  safety_margin_percent: number = 10
): number {
  const total_loss = fabric_loss_w + ventilation_loss_w;
  const safety_factor = 1 + (safety_margin_percent / 100);
  const total_with_margin = total_loss * safety_factor;

  return Math.round(total_with_margin);
}

// ============================================
// Radiator Output Calculations
// ============================================

/**
 * Radiator correction factors for different panel types
 * Based on EN442 standard
 */
const RADIATOR_CORRECTION_FACTORS: Record<RadiatorPanelType, number> = {
  'P+': 1.0,   // Single panel (baseline)
  'K1': 1.3,   // Single panel + single convector
  'K2': 1.6,   // Double panel + double convector
  'K3': 1.8,   // Triple panel + triple convector
  'other': 1.0,
};

/**
 * Calculate radiator heat output at different flow temperatures
 *
 * Uses the logarithmic mean temperature difference (LMTD) method:
 * Output = Output_rated × (ΔT_actual / ΔT_rated)^n
 *
 * Where:
 * - n = 1.3 (exponent for radiators, empirical value)
 * - ΔT = Mean water temp - Room temp
 *
 * @param input - Radiator specifications and operating conditions
 * @returns Output at various flow temperatures
 */
export function calculateRadiatorOutput(
  input: RadiatorOutputInput
): RadiatorOutputResult {
  const {
    panel_type,
    height_mm,
    width_mm,
    flow_temp_c,
    return_temp_c,
    room_temp_c,
  } = input;

  // Calculate mean water temperature
  const mean_water_temp = (flow_temp_c + return_temp_c) / 2;
  const delta_t = mean_water_temp - room_temp_c;

  // Base output calculation (per m² of radiator face area)
  // Typical radiator outputs ~100 W/m² at ΔT=50K
  const face_area_m2 = (height_mm * width_mm) / 1_000_000;
  const base_output_per_m2 = 100; // W/m² at ΔT=50K

  // Apply panel type correction factor
  const correction_factor = RADIATOR_CORRECTION_FACTORS[panel_type] || 1.0;

  // Calculate output at ΔT=50K (standard rating)
  const output_at_dt50 = base_output_per_m2 * face_area_m2 * correction_factor;

  // Calculate output at actual ΔT using the power law
  const n = 1.3; // Radiator exponent
  const dt_rated = 50; // Standard ΔT for ratings
  const output_watts = output_at_dt50 * Math.pow(delta_t / dt_rated, n);

  // Calculate outputs at common flow temperatures for reference
  // ΔT=35K: Heat pump compatible (flow 45°C, room 20°C, assuming 10°C drop)
  const mean_temp_dt35 = 40; // (45+35)/2
  const dt35 = mean_temp_dt35 - room_temp_c;
  const output_at_dt35 = output_at_dt50 * Math.pow(dt35 / dt_rated, n);

  // ΔT=30K: Low temp heat pump (flow 40°C, room 20°C, assuming 10°C drop)
  const mean_temp_dt30 = 35; // (40+30)/2
  const dt30 = mean_temp_dt30 - room_temp_c;
  const output_at_dt30 = output_at_dt50 * Math.pow(dt30 / dt_rated, n);

  return {
    delta_t: Math.round(delta_t * 10) / 10,
    output_watts: Math.round(output_watts),
    output_at_dt50: Math.round(output_at_dt50),
    output_at_dt35: Math.round(output_at_dt35),
    output_at_dt30: Math.round(output_at_dt30),
  };
}

/**
 * Check if radiator is suitable for heat pump
 *
 * For a heat pump system, radiators need to provide sufficient output at low flow temperatures
 *
 * @param required_output_w - Required heat output (W)
 * @param radiator_output_at_dt35 - Radiator output at ΔT=35K (W)
 * @returns true if radiator is suitable, false if needs upsizing
 */
export function isRadiatorSuitableForHeatPump(
  required_output_w: number,
  radiator_output_at_dt35: number
): boolean {
  // Add 10% margin for safety
  return radiator_output_at_dt35 >= required_output_w * 1.1;
}

/**
 * Calculate required radiator size for heat pump conversion
 *
 * @param room_heat_loss_w - Room heat loss (W)
 * @param current_radiator_output_dt35 - Current radiator output at ΔT=35K (W)
 * @returns Suggested action: 'ok', 'upsize', or 'major_upsize'
 */
export function getRadiatorUpgradeSuggestion(
  room_heat_loss_w: number,
  current_radiator_output_dt35: number
): 'ok' | 'upsize' | 'major_upsize' {
  const ratio = current_radiator_output_dt35 / room_heat_loss_w;

  if (ratio >= 1.1) {
    return 'ok'; // 10% margin
  } else if (ratio >= 0.75) {
    return 'upsize'; // Need larger radiator
  } else {
    return 'major_upsize'; // Need significantly larger radiator or multiple radiators
  }
}

// ============================================
// Standard U-Values (Lookup Tables)
// ============================================

/**
 * Typical U-values for different construction types (W/m²K)
 * Used as defaults when thermal imaging is not available
 */
export const TYPICAL_U_VALUES = {
  walls: {
    solid_uninsulated: 2.1,
    solid_insulated: 0.6,
    cavity_unfilled: 1.6,
    cavity_filled: 0.55,
    timber_frame_insulated: 0.35,
  },
  windows: {
    single_glazed: 5.0,
    double_glazed_air: 2.8,
    double_glazed_argon: 1.6,
    triple_glazed: 0.8,
  },
  roof: {
    uninsulated: 2.3,
    '100mm_insulation': 0.4,
    '200mm_insulation': 0.16,
    '270mm_insulation': 0.13,
  },
  floor: {
    solid_uninsulated: 0.7,
    solid_insulated: 0.25,
    suspended_uninsulated: 0.6,
    suspended_insulated: 0.22,
  },
};

/**
 * Typical air change rates (ACH) for different building types
 */
export const TYPICAL_AIR_CHANGE_RATES = {
  very_leaky: 2.0,    // Old, draughty buildings
  leaky: 1.5,         // Typical older buildings
  average: 1.0,       // Average UK dwelling
  good: 0.5,          // Well-sealed modern building
  excellent: 0.3,     // Passive house standard
};

// ============================================
// Export all utilities
// ============================================

export const HeatLossPhysics = {
  // Constants
  DESIGN_EXTERNAL_TEMP_C,
  DESIGN_INTERNAL_TEMP_C,
  DESIGN_BEDROOM_TEMP_C,
  TYPICAL_U_VALUES,
  TYPICAL_AIR_CHANGE_RATES,

  // U-value calculations
  calculateUValueFromThermalImaging,
  adjustUValueForMoisture,

  // Heat loss calculations
  calculateHeatLoss,
  calculateVentilationHeatLoss,
  calculateTotalRoomHeatLoss,

  // Radiator calculations
  calculateRadiatorOutput,
  isRadiatorSuitableForHeatPump,
  getRadiatorUpgradeSuggestion,
};
