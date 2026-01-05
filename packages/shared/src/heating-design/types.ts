/**
 * Shared types for Heating Design System
 * Used across heating-engine, API, and PWA
 *
 * Imports types from heat-loss-survey for internal use (not re-exported)
 */

import type {
  Orientation,
  GlazingType as SurveyGlazingType,
  ValveType as SurveyValveType,
} from '../types/heat-loss-survey.types';

// Type aliases for internal use (prevents export conflicts)
type GlazingType = SurveyGlazingType;
type ValveType = SurveyValveType;

// Re-export only Orientation (not conflicting)
export type { Orientation };

// ============================================================================
// Core Geometric Types
// ============================================================================

export interface Point3D {
  x: number; // meters
  y: number; // meters
  z: number; // meters (elevation)
}

export interface Point2D {
  x: number; // meters
  y: number; // meters
}

// ============================================================================
// HDRoom and Building Types (Heating Design specific)
// ============================================================================

export type RoomType =
  | 'living_room'
  | 'dining_room'
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'hallway'
  | 'study'
  | 'utility'
  | 'conservatory'
  | 'garage'
  | 'other';

export interface HDWall {
  id: string;
  start: Point3D;
  end: Point3D;
  length: number; // meters
  height: number; // meters
  isExternal: boolean;
  construction: WallConstruction;
  orientation?: Orientation;
  uValue?: number; // W/m²K - can override construction default
}

export interface HDWindow {
  id: string;
  wallId: string;
  position: Point3D;
  width: number; // meters
  height: number; // meters
  glazingType: GlazingType;
  uValue: number; // W/m²K
}

export interface HDDoor {
  id: string;
  wallId: string;
  position: Point3D;
  width: number; // meters
  height: number; // meters
  isExternal: boolean;
  uValue: number; // W/m²K
}

export interface HDRoom {
  id: string;
  name: string;
  type: RoomType;
  area: number; // m²
  perimeter: number; // meters
  ceilingHeight: number; // meters
  volume: number; // m³
  vertices: Point3D[];
  walls: HDWall[];
  windows: HDWindow[];
  doors: HDDoor[];
  exposedHDWalls: string[]; // HDWall IDs facing exterior
  targetTemperature?: number; // °C - overrides default for room type
}

export interface HDFloor {
  id: string;
  level: number; // 0 = ground, 1 = first, etc.
  height: number; // meters
  rooms: HDRoom[];
}

export interface HDFloorPlan {
  id: string;
  projectId: string;
  floors: HDFloor[];
  totalArea: number; // m²
  created: Date;
  fileName?: string;
  fileType?: 'usdz' | 'obj' | 'pdf' | 'json';
}

// ============================================================================
// Construction and Material Types
// ============================================================================

export type WallConstruction =
  | 'solid_brick_uninsulated'
  | 'solid_brick_internal_insulation'
  | 'cavity_uninsulated'
  | 'cavity_partial_fill'
  | 'cavity_full_fill'
  | 'modern_insulated'
  | 'timber_frame';

export type RoofConstruction =
  | 'uninsulated'
  | 'loft_insulation_100mm'
  | 'loft_insulation_270mm'
  | 'warm_roof'
  | 'flat_roof_insulated';

export type FloorConstruction =
  | 'solid_uninsulated'
  | 'solid_insulated'
  | 'suspended_timber_uninsulated'
  | 'suspended_timber_insulated'
  | 'beam_block';


export interface UValueData {
  uValue: number; // W/m²K
  description: string;
}

// ============================================================================
// Building Data
// ============================================================================

export interface HeatingBuildingData {
  id: string;
  projectId: string;
  address: string;
  postcode: string;
  constructionYear?: number;
  wallConstruction: WallConstruction;
  wallUValue?: number; // Override default
  roofConstruction: RoofConstruction;
  roofUValue?: number;
  floorConstruction: FloorConstruction;
  floorUValue?: number;
  airChangesPerHour: number; // Default 1.0
}

export interface HeatingClimateData {
  postcode: string;
  outsideDesignTemp: number; // °C, typically -3 for UK
  windSpeed: number; // m/s
  altitude: number; // meters
  region: string; // e.g., "South East", "Scotland"
}

export interface HeatingDesignConditions {
  targetTemperatures: Record<RoomType, number>; // °C
  infiltrationRate: number; // Air changes per hour
  thermalBridging: number; // W/m²K - Y-value addition (typically 0.15)
  safetyMargin: number; // Percentage (typically 10-20%)
  flowTemperature: FlowTemperature; // Heating system flow temp
}

export type FlowTemperature = '70/50' | '60/40' | '50/30'; // Flow/Return temps

// ============================================================================
// Heat Loss Calculation Types
// ============================================================================

export interface HeatLossInputs {
  hdroom: HDRoom;
  building: HeatingBuildingData;
  climate: HeatingClimateData;
  designConditions: HeatingDesignConditions;
}

export interface HDWallLoss {
  wallId: string;
  area: number; // m²
  uValue: number; // W/m²K
  deltaT: number; // °C
  loss: number; // W
}

export interface HDWindowLoss {
  windowId: string;
  area: number; // m²
  uValue: number; // W/m²K
  deltaT: number; // °C
  loss: number; // W
}

export interface HDDoorLoss {
  doorId: string;
  area: number; // m²
  uValue: number; // W/m²K
  deltaT: number; // °C
  loss: number; // W
}

export interface HeatLossBreakdown {
  walls: HDWallLoss[];
  windows: HDWindowLoss[];
  doors: HDDoorLoss[];
  floor: number; // W
  ceiling: number; // W
  thermalBridging: number; // W
  infiltration: number; // W
}

export interface HeatLossResult {
  roomId: string;
  fabricLoss: number; // W
  ventilationLoss: number; // W
  totalLoss: number; // W
  breakdown: HeatLossBreakdown;
  requiredOutput: number; // W (with safety margin)

  // Provenance: audit trail for defensibility
  provenance: import('./provenance').CalculationProvenance;

  // Legacy fields (kept for backwards compatibility)
  calculatedAt: Date;
  overridden: boolean;
}

// ============================================================================
// Radiator Types
// ============================================================================

export type RadiatorType = 'single' | 'double' | 'K1' | 'K2' | 'K3' | 'vertical' | 'column';
export type RadiatorConnection = 'TBOE' | 'BBOE' | 'TBCenter' | 'BBCenter';
// ValveType imported from heat-loss-survey.types

export interface Radiator {
  id: string;
  manufacturer: string;
  model: string;
  type: RadiatorType;
  height: number; // mm
  width: number; // mm
  depth: number; // mm
  output: Record<FlowTemperature, number>; // Watts at different flow temps
  weight: number; // kg
  waterVolume: number; // litres
  connectionType: RadiatorConnection;
  connectionCenters: number; // mm
  price?: number; // GBP
  dataSheetUrl?: string;
  imageUrl?: string;
}

export interface PipeworkConfig {
  flowPosition: Point3D;
  returnPosition: Point3D;
  connectionType: RadiatorConnection;
  valveType: ValveType;
}

export interface RadiatorPlacement {
  radiatorId: string;
  roomId: string;
  wallId: string;
  position: Point3D; // Center of radiator
  heightAboveHDFloor: number; // mm, default 100mm
  rotation: number; // degrees
  pipework: PipeworkConfig;
}

export interface RadiatorSelection {
  radiator: Radiator;
  placement: RadiatorPlacement;
  outputAtFlowTemp: number; // W
  score: number; // Selection algorithm score
}

// ============================================================================
// Pipe Routing Types
// ============================================================================

export type PipeType = 'flow' | 'return';
export type PipeMaterial = 'copper' | 'plastic' | 'pex';

export interface PipeLeg {
  id: string;
  start: Point3D;
  end: Point3D;
  length: number; // meters
  diameter: number; // mm (15, 22, 28, 35 typical)
  route: Point3D[]; // Waypoints
  type: PipeType;
  material: PipeMaterial;
  roomIds: string[]; // HDRooms this pipe passes through
  isVertical: boolean;
  insulated: boolean;
}

export interface PipeBranch {
  id: string;
  parentLegId?: string;
  branchPoint: Point3D;
  radiatorId: string;
  legs: PipeLeg[];
}

export interface PipeNetwork {
  projectId: string;
  boilerPosition: Point3D;
  primaryPipes: PipeLeg[];
  branches: PipeBranch[];
  totalLength: number; // meters
  totalCopperLength?: number; // meters
  totalPlasticLength?: number; // meters
  materialSchedule: MaterialSchedule;
}

export interface MaterialSchedule {
  pipes: PipeMaterialItem[];
  fittings: Fitting[];
  radiators: Radiator[];
  valves: Valve[];
  totalCost?: number; // GBP
}

export interface PipeMaterialItem {
  diameter: number; // mm
  length: number; // meters
  material: PipeMaterial;
  cost?: number; // GBP per meter
}

export interface Fitting {
  type: 'elbow' | 'tee' | 'reducer' | 'coupling' | 'valve';
  diameter: number; // mm
  quantity: number;
  cost?: number; // GBP each
}

export interface Valve {
  type: ValveType;
  size: number; // mm
  quantity: number;
  cost?: number; // GBP each
}

export interface RoutingConstraints {
  avoidLivingSpaces: boolean;
  preferHDFloorVoids: boolean;
  preferCeilingVoids: boolean;
  maxPipeRunInHDRoom: number; // mm
  cornerRadius: number; // mm
  verticalRoutesOnly: string[]; // HDRoom IDs where vertical routes allowed
}

// ============================================================================
// Project Types
// ============================================================================

export type HeatingProjectStatus = 'draft' | 'floor_plan_imported' | 'heat_loss_calculated' | 'radiators_selected' | 'pipes_routed' | 'complete';

export interface HeatingProject {
  id: string;
  leadId?: number; // Link to existing lead
  userId: number;
  accountId: number;
  name: string;
  status: HeatingProjectStatus;
  floorPlanId?: string;
  buildingDataId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Export/Report Types
// ============================================================================

export interface HeatLossReport {
  projectId: string;
  projectName: string;
  buildingData: HeatingBuildingData;
  climateData: HeatingClimateData;
  designConditions: HeatingDesignConditions;
  rooms: Array<{
    hdroom: HDRoom;
    heatLoss: HeatLossResult;
  }>;
  totalHeatLoss: number; // W
  totalRequiredOutput: number; // W
  generatedAt: Date;
}

export interface MaterialScheduleReport {
  projectId: string;
  projectName: string;
  radiators: Array<{
    hdroom: string;
    radiator: Radiator;
    quantity: number;
  }>;
  pipework: MaterialSchedule;
  totalCost: number; // GBP
  generatedAt: Date;
}
