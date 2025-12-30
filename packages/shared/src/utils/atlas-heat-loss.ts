/**
 * Atlas Heat Loss API (Verified v1.1)
 * 
 * Room-by-room heat loss calculations following MCS 3005-D and BS EN 12831.
 * This is the "reality check" Engineer logic focusing on practical MVP features.
 * 
 * Key Principles:
 * 1. Data Truth Hierarchy: LIDAR > MANUAL > SATELLITE
 * 2. Party Walls: Calculated with 0 ΔT (NOT a percentage discount)
 * 3. Thermal Bridging: Global uplift factor (10% default) for MVP
 * 4. Emitter Adequacy: The "Killer Feature" for selling heat pump conversions
 * 5. Audit Trail: Full transparency for every assumption
 */

import {
  Wall,
  Room,
  Emitter,
  HeatLossCalculations,
  RoomHeatLoss,
  DesignConditions,
  ThermalBridgingConfig,
  SetbackRecoveryConfig,
  AirtightnessConfig,
  EmitterAdequacy,
  AuditTrailEntry,
  SurfaceClassification,
  ConfidenceScore,
  DataSourceType,
} from '../types/heat-loss-survey.types';

import {
  calculateHeatLoss,
  calculateVentilationHeatLoss,
  calculateRadiatorOutput,
  DESIGN_EXTERNAL_TEMP_C,
  DESIGN_INTERNAL_TEMP_C,
  TYPICAL_U_VALUES,
  TYPICAL_AIR_CHANGE_RATES,
} from './heat-loss-physics';

// ============================================
// Atlas Configuration Defaults
// ============================================

export const ATLAS_DEFAULTS = {
  THERMAL_BRIDGING_UPLIFT_PERCENT: 10,
  SETBACK_RECOVERY_UPLIFT_PERCENT: 0, // User must explicitly enable
  N50_CONVERSION_FACTOR: 20, // Standard for normal exposure
  SAFETY_MARGIN_PERCENT: 10,
  MIN_ROOM_TEMP_C: 18, // Bedrooms
  STANDARD_ROOM_TEMP_C: 21, // Living areas
} as const;

// ============================================
// Audit Trail Management
// ============================================

/**
 * Create an audit trail entry
 */
export function createAuditEntry(
  fieldName: string,
  value: string | number,
  sourceType: DataSourceType,
  confidenceScore: ConfidenceScore,
  notes?: string
): AuditTrailEntry {
  return {
    field_name: fieldName,
    value,
    source_type: sourceType,
    confidence_score: confidenceScore,
    timestamp: new Date().toISOString(),
    notes,
  };
}

// ============================================
// Surface Classification & Temperature Delta
// ============================================

/**
 * Calculate effective ΔT for a surface based on classification
 * 
 * CRITICAL: Party walls use 0 ΔT (not a discount!)
 * This is the "reality check" fix from the problem statement.
 */
export function calculateEffectiveDeltaT(
  surfaceClassification: SurfaceClassification,
  internalTempC: number,
  externalTempC: number,
  auditTrail: AuditTrailEntry[]
): number {
  let deltaT: number;
  let notes: string;

  switch (surfaceClassification) {
    case 'EXTERNAL':
      deltaT = internalTempC - externalTempC;
      notes = `External surface: full ΔT = ${internalTempC}°C - ${externalTempC}°C`;
      break;

    case 'PARTY_WALL':
      // CRITICAL FIX: Party wall assumes heated adjacent space
      // ΔT = 0 (NOT a percentage discount!)
      deltaT = 0;
      notes = `Party wall: assumes heated adjacent space, ΔT = 0K (prevents undersizing)`;
      break;

    case 'UNHEATED_ADJACENT':
      // Unheated space (e.g., garage): partial ΔT
      // Assume unheated space is 5°C warmer than outside
      const unheatedTempC = externalTempC + 5;
      deltaT = internalTempC - unheatedTempC;
      notes = `Unheated adjacent: assumed ${unheatedTempC}°C, ΔT = ${deltaT}K`;
      break;

    case 'GROUND_FLOOR':
      // Ground contact: assume ground temp ~10°C year-round
      const groundTempC = 10;
      deltaT = internalTempC - groundTempC;
      notes = `Ground floor: assumed ground temp ${groundTempC}°C, ΔT = ${deltaT}K`;
      break;

    default:
      // Fallback to external
      deltaT = internalTempC - externalTempC;
      notes = `Unknown classification: defaulting to external ΔT`;
      break;
  }

  auditTrail.push(
    createAuditEntry(
      `surface_delta_t_${surfaceClassification}`,
      deltaT,
      'ASSUMED',
      'medium',
      notes
    )
  );

  return Math.max(0, deltaT); // Never allow negative ΔT
}

// ============================================
// Airtightness Calculations
// ============================================

/**
 * Convert n50 to effective ACH
 * 
 * Formula: ACH = n50 / conversion_factor
 * Typical conversion_factor = 20 for normal exposure
 */
export function calculateEffectiveACH(
  config: AirtightnessConfig,
  auditTrail: AuditTrailEntry[]
): number {
  let effectiveACH: number;
  let notes: string;

  if (config.source === 'n50_test' && config.n50_value !== undefined) {
    const conversionFactor = config.conversion_factor ?? ATLAS_DEFAULTS.N50_CONVERSION_FACTOR;
    effectiveACH = config.n50_value / conversionFactor;
    notes = `Airtightness from test: n50=${config.n50_value}, conversion=${conversionFactor}, ACH=${effectiveACH.toFixed(2)}`;
    
    auditTrail.push(
      createAuditEntry('airtightness_ach', effectiveACH, 'MANUAL', 'high', notes)
    );
  } else if (config.source === 'age_band' && config.age_band) {
    // Age-based defaults
    const ageBandDefaults: Record<string, number> = {
      'pre-1919': TYPICAL_AIR_CHANGE_RATES.very_leaky,
      '1919-1944': TYPICAL_AIR_CHANGE_RATES.leaky,
      '1945-1964': TYPICAL_AIR_CHANGE_RATES.leaky,
      '1965-1980': TYPICAL_AIR_CHANGE_RATES.average,
      '1981-1990': TYPICAL_AIR_CHANGE_RATES.average,
      '1991-2002': TYPICAL_AIR_CHANGE_RATES.good,
      '2003-2010': TYPICAL_AIR_CHANGE_RATES.good,
      '2011+': TYPICAL_AIR_CHANGE_RATES.good,
    };
    
    effectiveACH = ageBandDefaults[config.age_band] ?? TYPICAL_AIR_CHANGE_RATES.average;
    notes = `Airtightness from age band '${config.age_band}': ACH=${effectiveACH}`;
    
    auditTrail.push(
      createAuditEntry('airtightness_ach', effectiveACH, 'ASSUMED', 'low', notes)
    );
  } else {
    // Fallback to average
    effectiveACH = TYPICAL_AIR_CHANGE_RATES.average;
    notes = `Airtightness assumed average: ACH=${effectiveACH}`;
    
    auditTrail.push(
      createAuditEntry('airtightness_ach', effectiveACH, 'ASSUMED', 'low', notes)
    );
  }

  return effectiveACH;
}

// ============================================
// Room Heat Loss Calculation
// ============================================

export interface RoomHeatLossInput {
  room: Room;
  walls: Wall[];
  emitters?: Emitter[];
  designConditions: DesignConditions;
  thermalBridgingConfig?: ThermalBridgingConfig;
  setbackRecoveryConfig?: SetbackRecoveryConfig;
  airtightnessConfig?: AirtightnessConfig;
}

export interface RoomHeatLossOutput {
  roomHeatLoss: RoomHeatLoss;
  auditTrail: AuditTrailEntry[];
}

/**
 * Calculate heat loss for a single room
 * 
 * Implements:
 * - Fabric loss with proper party wall handling (0 ΔT)
 * - Ventilation loss with n50 conversion if provided
 * - Thermal bridging uplift (toggleable)
 * - Setback & recovery uplift (toggleable)
 * - Emitter adequacy checking
 */
export function calculateRoomHeatLoss(input: RoomHeatLossInput): RoomHeatLossOutput {
  const {
    room,
    walls,
    emitters = [],
    designConditions,
    thermalBridgingConfig,
    setbackRecoveryConfig,
    airtightnessConfig,
  } = input;

  const auditTrail: AuditTrailEntry[] = [];
  
  // Design temperatures
  const internalTempC = room.design_temp_c ?? designConditions.desired_internal_temp_c ?? DESIGN_INTERNAL_TEMP_C;
  const externalTempC = designConditions.design_external_temp_c ?? DESIGN_EXTERNAL_TEMP_C;
  
  auditTrail.push(
    createAuditEntry('room_internal_temp_c', internalTempC, 'MANUAL', 'high', `Design internal temp for ${room.name}`)
  );
  auditTrail.push(
    createAuditEntry('design_external_temp_c', externalTempC, 'TABLE_LOOKUP', 'high', 'UK MCS design external temp')
  );

  // 1. FABRIC LOSS - Calculate for each wall
  let fabricLossW = 0;
  
  for (const wall of walls) {
    const uValue = wall.u_value_measured ?? wall.u_value_calculated ?? TYPICAL_U_VALUES.walls.cavity_unfilled;
    const areaM2 = wall.area_m2;
    const classification = wall.surface_classification ?? 'EXTERNAL';
    
    // Calculate effective ΔT based on classification
    const deltaT = calculateEffectiveDeltaT(classification, internalTempC, externalTempC, auditTrail);
    
    // CRITICAL: Party walls will have deltaT = 0, so loss = 0W
    const wallLoss = calculateHeatLoss({ u_value: uValue, area_m2: areaM2, delta_t: deltaT });
    fabricLossW += wallLoss.heat_loss_w;
    
    const sourceType = wall.u_value_measured ? 'THERMAL_CAMERA' : 'TABLE_LOOKUP';
    const confidence = wall.confidence_score ?? (wall.u_value_measured ? 'high' : 'medium');
    
    auditTrail.push(
      createAuditEntry(
        `wall_${wall.wall_id}_loss`,
        wallLoss.heat_loss_w,
        sourceType,
        confidence,
        `U=${uValue} W/m²K, Area=${areaM2} m², ΔT=${deltaT}K, Classification=${classification}`
      )
    );
  }

  // 2. VENTILATION LOSS
  const volumeM3 = room.dimensions.volume_m3;
  const ach = airtightnessConfig 
    ? calculateEffectiveACH(airtightnessConfig, auditTrail)
    : TYPICAL_AIR_CHANGE_RATES.average;
  
  const deltaT = internalTempC - externalTempC;
  const ventilationLossW = calculateVentilationHeatLoss(volumeM3, ach, deltaT);
  
  auditTrail.push(
    createAuditEntry(
      `room_${room.room_id}_ventilation_loss`,
      ventilationLossW,
      'ASSUMED',
      'medium',
      `Volume=${volumeM3} m³, ACH=${ach}, ΔT=${deltaT}K`
    )
  );

  // 3. THERMAL BRIDGING UPLIFT (toggleable)
  let thermalBridgingW = 0;
  if (thermalBridgingConfig?.enabled) {
    const upliftPercent = thermalBridgingConfig.uplift_factor_percent ?? ATLAS_DEFAULTS.THERMAL_BRIDGING_UPLIFT_PERCENT;
    thermalBridgingW = (fabricLossW * upliftPercent) / 100;
    
    auditTrail.push(
      createAuditEntry(
        `room_${room.room_id}_thermal_bridging`,
        thermalBridgingW,
        'ASSUMED',
        'medium',
        `Global uplift: ${upliftPercent}% of fabric loss (${fabricLossW}W)`
      )
    );
  }

  // 4. SETBACK & RECOVERY UPLIFT (toggleable)
  let setbackRecoveryW = 0;
  if (setbackRecoveryConfig?.enabled) {
    const upliftPercent = setbackRecoveryConfig.uplift_factor_percent;
    const baseLoss = fabricLossW + ventilationLossW + thermalBridgingW;
    setbackRecoveryW = (baseLoss * upliftPercent) / 100;
    
    auditTrail.push(
      createAuditEntry(
        `room_${room.room_id}_setback_recovery`,
        setbackRecoveryW,
        'MANUAL',
        'medium',
        `Occupancy pattern: ${setbackRecoveryConfig.occupancy_pattern ?? 'unspecified'}, Uplift: ${upliftPercent}%`
      )
    );
  }

  // 5. TOTAL ROOM HEAT LOSS
  const totalLossW = Math.round(fabricLossW + ventilationLossW + thermalBridgingW + setbackRecoveryW);
  const lossWPerM2 = Math.round(totalLossW / room.dimensions.floor_area_m2);

  // 6. EMITTER ADEQUACY (The Killer Feature!)
  let emitterAdequacy: EmitterAdequacy | undefined;
  
  if (emitters.length > 0) {
    const emitter = emitters[0]; // Use first emitter for this room
    const radiatorDetails = emitter.radiator_details;
    
    if (radiatorDetails && emitter.type === 'radiator') {
      const roomTempC = internalTempC;
      
      // Calculate outputs at different MWTs
      const output75 = calculateRadiatorOutput({
        panel_type: radiatorDetails.panel_type,
        height_mm: radiatorDetails.height_mm ?? 600,
        width_mm: radiatorDetails.width_mm ?? 1000,
        depth_mm: radiatorDetails.depth_mm ?? 100,
        flow_temp_c: 75,
        return_temp_c: 65,
        room_temp_c: roomTempC,
      });
      
      const output55 = calculateRadiatorOutput({
        panel_type: radiatorDetails.panel_type,
        height_mm: radiatorDetails.height_mm ?? 600,
        width_mm: radiatorDetails.width_mm ?? 1000,
        depth_mm: radiatorDetails.depth_mm ?? 100,
        flow_temp_c: 55,
        return_temp_c: 45,
        room_temp_c: roomTempC,
      });
      
      const output45 = calculateRadiatorOutput({
        panel_type: radiatorDetails.panel_type,
        height_mm: radiatorDetails.height_mm ?? 600,
        width_mm: radiatorDetails.width_mm ?? 1000,
        depth_mm: radiatorDetails.depth_mm ?? 100,
        flow_temp_c: 45,
        return_temp_c: 35,
        room_temp_c: roomTempC,
      });
      
      // 10% margin for adequacy check
      const requiredW = totalLossW * 1.1;
      
      let recommendedAction: 'ok' | 'upsize' | 'major_upsize' | 'replace';
      if (output45.output_watts >= requiredW) {
        recommendedAction = 'ok';
      } else if (output45.output_watts >= totalLossW * 0.75) {
        recommendedAction = 'upsize';
      } else if (output55.output_watts >= requiredW) {
        recommendedAction = 'major_upsize';
      } else {
        recommendedAction = 'replace';
      }
      
      emitterAdequacy = {
        emitter_id: emitter.emitter_id,
        room_id: room.room_id,
        room_heat_loss_w: totalLossW,
        current_output_at_mwt_75: output75.output_watts,
        current_output_at_mwt_55: output55.output_watts,
        current_output_at_mwt_45: output45.output_watts,
        adequate_at_mwt_75: output75.output_watts >= requiredW,
        adequate_at_mwt_55: output55.output_watts >= requiredW,
        adequate_at_mwt_45: output45.output_watts >= requiredW,
        recommended_action: recommendedAction,
        notes: `Radiator ${radiatorDetails.panel_type}, ${radiatorDetails.height_mm}x${radiatorDetails.width_mm}mm`,
      };
      
      auditTrail.push(
        createAuditEntry(
          `emitter_${emitter.emitter_id}_adequacy`,
          recommendedAction,
          'MANUAL',
          'high',
          `Output at 45°C: ${output45.output_watts}W vs required ${totalLossW}W (+10% margin)`
        )
      );
    }
  }

  const roomHeatLoss: RoomHeatLoss = {
    room_id: room.room_id,
    fabric_loss_w: Math.round(fabricLossW),
    ventilation_loss_w: ventilationLossW,
    thermal_bridging_w: Math.round(thermalBridgingW),
    setback_recovery_w: Math.round(setbackRecoveryW),
    total_loss_w: totalLossW,
    loss_w_per_m2: lossWPerM2,
    emitter_adequacy: emitterAdequacy,
  };

  return { roomHeatLoss, auditTrail };
}

// ============================================
// Whole Property Heat Loss Calculation
// ============================================

export interface PropertyHeatLossInput {
  rooms: Room[];
  wallsByRoom: Map<string, Wall[]>; // room_id -> walls
  emittersByRoom: Map<string, Emitter[]>; // room_id -> emitters
  designConditions: DesignConditions;
  thermalBridgingConfig?: ThermalBridgingConfig;
  setbackRecoveryConfig?: SetbackRecoveryConfig;
  airtightnessConfig?: AirtightnessConfig;
}

/**
 * Calculate heat loss for entire property
 * 
 * Returns:
 * - Room-by-room breakdown
 * - Total property heat loss
 * - Emitter adequacy report for every room
 * - Full audit trail for Sarah to translate into PDF
 */
export function calculatePropertyHeatLoss(input: PropertyHeatLossInput): HeatLossCalculations {
  const {
    rooms,
    wallsByRoom,
    emittersByRoom,
    designConditions,
    thermalBridgingConfig,
    setbackRecoveryConfig,
    airtightnessConfig,
  } = input;

  const allAuditTrail: AuditTrailEntry[] = [];
  const roomHeatLosses: RoomHeatLoss[] = [];
  let totalHeatLossW = 0;

  // Calculate heat loss for each room
  for (const room of rooms) {
    const walls = wallsByRoom.get(room.room_id) ?? [];
    const emitters = emittersByRoom.get(room.room_id) ?? [];

    const result = calculateRoomHeatLoss({
      room,
      walls,
      emitters,
      designConditions,
      thermalBridgingConfig,
      setbackRecoveryConfig,
      airtightnessConfig,
    });

    roomHeatLosses.push(result.roomHeatLoss);
    allAuditTrail.push(...result.auditTrail);
    totalHeatLossW += result.roomHeatLoss.total_loss_w ?? 0;
  }

  // Calculate totals
  const totalFloorArea = rooms.reduce((sum, r) => sum + r.dimensions.floor_area_m2, 0);
  const heatLossPerM2 = totalFloorArea > 0 ? Math.round(totalHeatLossW / totalFloorArea) : 0;
  const totalHeatLossKw = Math.round((totalHeatLossW / 1000) * 10) / 10;

  // Add safety margin for boiler sizing
  const safetyMarginPercent = ATLAS_DEFAULTS.SAFETY_MARGIN_PERCENT;
  const recommendedBoilerSizeKw = Math.round(totalHeatLossKw * (1 + safetyMarginPercent / 100) * 10) / 10;

  allAuditTrail.push(
    createAuditEntry(
      'recommended_boiler_size_kw',
      recommendedBoilerSizeKw,
      'ASSUMED',
      'high',
      `Total loss ${totalHeatLossKw}kW + ${safetyMarginPercent}% safety margin`
    )
  );

  return {
    calculation_method: 'room_by_room',
    design_conditions: designConditions,
    thermal_bridging_config: thermalBridgingConfig,
    setback_recovery_config: setbackRecoveryConfig,
    airtightness_config: airtightnessConfig,
    room_heat_losses: roomHeatLosses,
    whole_house_heat_loss_w: totalHeatLossW,
    whole_house_heat_loss_kw: totalHeatLossKw,
    heat_loss_per_m2: heatLossPerM2,
    safety_margin_percent: safetyMarginPercent,
    recommended_boiler_size_kw: recommendedBoilerSizeKw,
    audit_trail: allAuditTrail,
  };
}

// ============================================
// Export all Atlas utilities
// ============================================

export const AtlasHeatLoss = {
  // Defaults
  DEFAULTS: ATLAS_DEFAULTS,
  
  // Audit trail
  createAuditEntry,
  
  // Surface calculations
  calculateEffectiveDeltaT,
  
  // Airtightness
  calculateEffectiveACH,
  
  // Room calculations
  calculateRoomHeatLoss,
  
  // Property calculations
  calculatePropertyHeatLoss,
};
