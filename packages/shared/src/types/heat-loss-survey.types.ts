/**
 * Physics-First Heat Loss Survey Types
 *
 * Comprehensive types for professional heat loss surveys combining:
 * - LiDAR scanning for accurate geometry
 * - Thermal imaging for U-value measurement
 * - Boroscope inspections for cavity verification
 * - Moisture meters for thermal performance assessment
 * - Manual measurements for hydraulic system analysis
 */

// ============================================
// Common Types
// ============================================

export type Orientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type PhotoType = 'visible' | 'thermal' | 'boroscope' | '360';

export interface PhotoEvidence {
  photo_id: string;
  url: string;
  type?: PhotoType;
  timestamp: Date | string;
  notes?: string;
}

export type ConditionRating = 'good' | 'fair' | 'poor';

export type HeatLossPriority = 'critical' | 'high' | 'medium' | 'low';

// ============================================
// Survey Metadata
// ============================================

export interface WeatherConditions {
  external_temp_c: number;
  wind_speed_ms?: number;
  humidity_percent?: number;
}

export interface DesignConditions {
  design_external_temp_c: number; // Default: -3°C for UK
  desired_internal_temp_c: number; // Default: 21°C
}

export interface SurveyMetadata {
  survey_id: string;
  lead_id?: number;
  surveyor_id?: number;
  survey_date: Date | string;
  weather_conditions?: WeatherConditions;
  design_conditions?: DesignConditions;
}

// ============================================
// Property Envelope - Structural Elements
// ============================================

export type ConstructionType = 'solid' | 'cavity_unfilled' | 'cavity_filled' | 'timber_frame' | 'other';

export type InsulationCondition = 'good' | 'slumped' | 'partial' | 'wet' | 'none' | 'unknown';

export type InspectionMethod = 'boroscope' | 'visual' | 'assumed';

export interface CavityStatus {
  inspected: boolean;
  method: InspectionMethod;
  insulation_present: boolean;
  insulation_condition: InsulationCondition;
  cavity_width_mm?: number;
}

export interface Wall {
  wall_id: string;
  orientation: Orientation;
  area_m2: number;
  thickness_mm?: number;
  construction_type?: ConstructionType;
  insulation_type?: string;
  insulation_thickness_mm?: number;
  u_value_calculated?: number; // W/m²K from tables
  u_value_measured?: number; // W/m²K from thermal camera (the "Stroma-Killer" value)
  surface_temp_c?: number; // From thermal camera
  moisture_percent?: number; // From moisture meter
  cavity_status?: CavityStatus;
  photo_evidence?: PhotoEvidence[];
}

export type GlazingType = 'single' | 'double' | 'triple' | 'secondary';

export type FrameMaterial = 'upvc' | 'timber' | 'aluminium' | 'composite';

export type AirTightness = 'good' | 'fair' | 'poor';

export interface WindowDoor {
  element_id: string;
  type: 'window' | 'door' | 'french_door' | 'skylight';
  location: string;
  width_m?: number;
  height_m?: number;
  area_m2: number;
  glazing_type?: GlazingType;
  frame_material?: FrameMaterial;
  u_value?: number; // W/m²K
  air_tightness?: AirTightness;
  trickle_vents?: boolean;
  photo_evidence?: PhotoEvidence[];
}

export type RoofType = 'pitched' | 'flat' | 'mixed';

export interface Roof {
  type: RoofType;
  area_m2?: number;
  insulation_type?: string;
  insulation_thickness_mm?: number;
  u_value?: number; // W/m²K
  loft_access?: boolean;
  photo_evidence?: PhotoEvidence[];
}

export type FloorType = 'solid' | 'suspended' | 'mixed';

export interface Floor {
  type: FloorType;
  area_m2?: number;
  insulation_present?: boolean;
  insulation_thickness_mm?: number;
  u_value?: number; // W/m²K
}

export type ExtractorFanType = 'mechanical' | 'passive';

export interface ExtractorFan {
  location: string;
  type: ExtractorFanType;
}

export type DraftinessLevel = 'low' | 'medium' | 'high';

export interface Ventilation {
  trickle_vents_count?: number;
  extractor_fans?: ExtractorFan[];
  air_tightness_test_done?: boolean;
  air_changes_per_hour?: number;
  draftiness_assessment?: DraftinessLevel;
}

export interface PropertyEnvelope {
  floor_area_m2?: number;
  volume_m3?: number;
  walls?: Wall[];
  windows_doors?: WindowDoor[];
  roof?: Roof;
  floor?: Floor;
  ventilation?: Ventilation;
}

// ============================================
// Rooms
// ============================================

export interface RoomDimensions {
  length_m?: number;
  width_m?: number;
  height_m?: number;
  floor_area_m2: number;
  volume_m3: number;
}

export interface LiDARScan {
  scan_id: string;
  scan_date: Date | string;
  device: string;
  accuracy_mm?: number;
}

export interface Room {
  room_id: string;
  name: string;
  floor_level?: number;
  dimensions: RoomDimensions;
  lidar_scan?: LiDARScan;
  orientation?: Orientation | 'internal';
  external_walls_count?: number;
  design_temp_c?: number;
  calculated_heat_loss_w?: number;
  heat_loss_w_per_k?: number;
  photo_evidence?: PhotoEvidence[];
}

// ============================================
// Emitters (Radiators, Underfloor Heating, etc.)
// ============================================

export type RadiatorPanelType = 'P+' | 'K1' | 'K2' | 'K3' | 'other';
// P+ = single panel
// K1 = single panel with single convector
// K2 = double panel with double convector
// K3 = triple panel with triple convector

export type RadiatorMaterial = 'steel' | 'aluminium' | 'cast_iron';

export interface RadiatorDetails {
  panel_type: RadiatorPanelType;
  material?: RadiatorMaterial;
  height_mm?: number;
  width_mm?: number;
  depth_mm?: number;
  surface_area_m2?: number; // Calculated from LiDAR or manual measurement
  output_at_dt50?: number; // Watts at ΔT=50K (flow 75°C, room 20°C) - traditional system
  output_at_dt35?: number; // Watts at ΔT=35K (flow 45°C, room 20°C) - heat pump compatible
  output_at_dt30?: number; // Watts at ΔT=30K (flow 40°C, room 20°C) - low temp heat pump
}

export type ValveType = 'trv' | 'lockshield' | 'none' | 'thermostatic';

export interface Emitter {
  emitter_id: string;
  room_id: string;
  type: 'radiator' | 'underfloor' | 'fan_convector' | 'other';
  radiator_details?: RadiatorDetails;
  condition?: ConditionRating;
  valve_type?: ValveType;
  photo_evidence?: PhotoEvidence[];
}

// ============================================
// System Hydraulics
// ============================================

export type BoilerType = 'combi' | 'system' | 'regular' | 'heat_only';

export interface Boiler {
  make?: string;
  model?: string;
  type?: BoilerType;
  output_kw?: number;
  age_years?: number;
  condition?: ConditionRating;
}

export type PipeDiameter = 10 | 15 | 22 | 28 | 35;

export type DistributionType = 'microbore' | 'standard_two_pipe' | 'single_pipe' | 'mixed';

export type MeasurementTool = 'calliper' | 'visual' | 'template';

export interface PipeMeasurement {
  location: string;
  diameter_mm: number;
  measurement_tool: MeasurementTool;
  photo_evidence?: PhotoEvidence;
}

export interface Pipework {
  flow_pipe_diameter_mm?: PipeDiameter;
  return_pipe_diameter_mm?: PipeDiameter;
  distribution_type?: DistributionType;
  insulation_present?: boolean;
  insulation_condition?: ConditionRating | 'none';
  pipe_measurements?: PipeMeasurement[];
}

export interface Pump {
  make?: string;
  model?: string;
  speed_settings?: number;
  current_setting?: number;
  head_meters?: number;
  flow_rate_lpm?: number;
}

export type SludgeLevel = 'none' | 'low' | 'medium' | 'high';

export type FilterCondition = 'clean' | 'dirty' | 'blocked';

export interface WaterSample {
  ph?: number;
  tds_ppm?: number;
  color?: string;
}

export interface HeatLossWaterQuality {
  sludge_check_done?: boolean;
  sludge_level?: SludgeLevel;
  inhibitor_present?: boolean;
  inhibitor_type?: string;
  filter_fitted?: boolean;
  filter_type?: string;
  filter_condition?: FilterCondition;
  water_sample?: WaterSample;
}

export interface SystemHydraulics {
  boiler?: Boiler;
  pipework?: Pipework;
  pump?: Pump;
  water_quality?: HeatLossWaterQuality;
  system_volume_litres?: number;
  expansion_vessel_size_litres?: number;
}

// ============================================
// Thermal Imaging (The "Stroma-Killer" Feature)
// ============================================

export interface ThermalImage {
  image_id: string;
  location: string;
  wall_id?: string;
  url: string;
  timestamp: Date | string;
  internal_surface_temp_c?: number;
  external_surface_temp_c?: number;
  delta_t?: number; // Temperature difference across element
  calculated_u_value?: number; // W/m²K calculated from delta-T (the Pro move!)
  notes?: string;
}

export interface ThermalImaging {
  camera_model?: string; // e.g., "FLIR One Pro", "Seek Thermal Compact Pro"
  calibration_date?: Date | string;
  ambient_temp_c?: number;
  external_temp_c?: number;
  thermal_images?: ThermalImage[];
}

// ============================================
// Invasive Checks (Boroscope & Moisture)
// ============================================

export interface BoroscopeFindings {
  cavity_width_mm?: number;
  insulation_present?: boolean;
  insulation_type?: string;
  insulation_condition?: InsulationCondition;
  moisture_visible?: boolean;
  debris_present?: boolean;
}

export interface BoroscopePhoto {
  photo_id: string;
  url: string;
}

export interface BoroscopeInspection {
  inspection_id: string;
  wall_id?: string;
  location: string;
  device_model?: string;
  timestamp: Date | string;
  findings?: BoroscopeFindings;
  video_url?: string;
  photos?: BoroscopePhoto[];
  notes?: string;
}

export type MeterType = 'capacitance' | 'resistance' | 'infrared';

export type MoistureMaterial = 'masonry' | 'timber' | 'plaster';

export interface MoistureReading {
  reading_id: string;
  location: string;
  wall_id?: string;
  timestamp: Date | string;
  meter_type?: MeterType;
  moisture_percent?: number;
  material?: MoistureMaterial;
  depth_mm?: number;
  notes?: string;
}

export interface InvasiveChecks {
  boroscope_inspections?: BoroscopeInspection[];
  moisture_readings?: MoistureReading[];
}

// ============================================
// Heat Loss Calculations
// ============================================

export type CalculationMethod = 'MCS' | 'room_by_room' | 'whole_house_estimate';

export interface RoomHeatLoss {
  room_id: string;
  fabric_loss_w?: number;
  ventilation_loss_w?: number;
  total_loss_w?: number;
  loss_w_per_m2?: number;
}

export interface HeatLossCalculations {
  calculation_method: CalculationMethod;
  design_conditions?: DesignConditions;
  room_heat_losses?: RoomHeatLoss[];
  whole_house_heat_loss_w?: number;
  whole_house_heat_loss_kw?: number;
  heat_loss_per_m2?: number;
  safety_margin_percent?: number;
  recommended_boiler_size_kw?: number;
}

// ============================================
// Equipment Used
// ============================================

export interface EquipmentUsed {
  lidar_device?: string; // e.g., "iPhone 14 Pro", "iPad Pro 2024"
  thermal_camera?: string; // e.g., "FLIR One Pro", "Seek Thermal Compact Pro"
  moisture_meter?: string;
  boroscope?: string;
  callipers?: string;
  laser_measure?: string;
}

// ============================================
// Recommendations
// ============================================

export interface FabricImprovement {
  improvement: string;
  priority: HeatLossPriority;
  estimated_heat_loss_reduction_w?: number;
  estimated_cost_gbp?: number;
}

export interface SystemImprovement {
  improvement: string;
  priority: HeatLossPriority;
  estimated_cost_gbp?: number;
}

export interface Recommendations {
  immediate_actions?: string[];
  fabric_improvements?: FabricImprovement[];
  system_improvements?: SystemImprovement[];
}

// ============================================
// Main Heat Loss Survey Type
// ============================================

export interface HeatLossSurvey {
  survey_metadata: SurveyMetadata;
  property_envelope: PropertyEnvelope;
  rooms: Room[];
  emitters?: Emitter[];
  system_hydraulics?: SystemHydraulics;
  thermal_imaging?: ThermalImaging;
  invasive_checks?: InvasiveChecks;
  heat_loss_calculations: HeatLossCalculations;
  equipment_used?: EquipmentUsed;
  recommendations?: Recommendations;
}

// ============================================
// Database Table Types
// ============================================

export interface HeatLossSurveyRecord {
  id: number;
  lead_id: number;
  surveyor_id?: number;
  survey_date: Date;
  survey_data: HeatLossSurvey; // Stored as JSONB
  whole_house_heat_loss_w?: number; // Denormalized for quick queries
  recommended_boiler_size_kw?: number; // Denormalized for quick queries
  created_at: Date;
  updated_at: Date;
}

// ============================================
// DTOs for API
// ============================================

export type CreateHeatLossSurveyDto = Omit<HeatLossSurveyRecord, 'id' | 'created_at' | 'updated_at'>;

export type UpdateHeatLossSurveyDto = Partial<CreateHeatLossSurveyDto>;

// ============================================
// Helper Types for Physics Calculations
// ============================================

export interface UValueCalculationInput {
  internal_surface_temp_c: number;
  external_surface_temp_c: number;
  internal_air_temp_c: number;
  external_air_temp_c: number;
  element_thickness_m?: number;
}

export interface UValueCalculationResult {
  u_value_w_m2k: number;
  delta_t_surface: number;
  delta_t_air: number;
  heat_flux_w_m2: number;
}

export interface HeatLossCalculationInput {
  u_value: number; // W/m²K
  area_m2: number;
  delta_t: number; // Temperature difference (internal - external)
}

export interface HeatLossCalculationResult {
  heat_loss_w: number;
}

// ============================================
// Radiator Output Calculation
// ============================================

export interface RadiatorOutputInput {
  panel_type: RadiatorPanelType;
  height_mm: number;
  width_mm: number;
  depth_mm: number;
  flow_temp_c: number;
  return_temp_c: number;
  room_temp_c: number;
}

export interface RadiatorOutputResult {
  delta_t: number;
  output_watts: number;
  output_at_dt50: number;
  output_at_dt35: number;
  output_at_dt30: number;
}
