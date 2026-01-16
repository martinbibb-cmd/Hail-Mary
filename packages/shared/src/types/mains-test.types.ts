/**
 * Mains Performance Test Module Types
 *
 * Captures time/step series of static/dynamic pressure, flow rate, and temperature
 * under controlled load conditions for mains water supply analysis.
 */

// ============================================
// Core Entities
// ============================================

export interface MainsPerformanceTest {
  id: string;
  propertyId?: number;
  surveyId?: number;
  userId: number;
  accountId: number;
  sourcePoint: string; // outside_tap|kitchen|bath_cold|etc
  ambientTempC?: number;
  notes?: string;
  createdAt: Date;
  createdBy: number;
}

export interface MainsTestDevice {
  id: string;
  testId: string;
  label: DeviceLabel; // A|B|C
  location: string; // outside_tap|kitchen_cold|shower_cold_feed|etc
  sensorType: SensorType;
  calibrationProfileId?: string; // future use
  notes?: string;
  createdAt: Date;
}

export interface MainsTestStep {
  id: string;
  testId: string;
  index: number; // 0..N
  label: string; // "All closed"|"Outlet 1 open"|etc
  outletCount: number; // 0..3
  valveState?: string; // free text for now; later: % open
  durationSeconds?: number;
  targetFlowLpm?: number; // optional, for "hold at X L/min"
  notes?: string;
  createdAt: Date;
}

export interface MainsTestObservation {
  id: string;
  testId: string;
  stepId: string;
  deviceId: string;
  timestamp: Date;
  pressureBar?: number; // nullable - device might not measure pressure
  flowLpm?: number; // nullable - device might not measure flow
  waterTempC?: number; // nullable - device might not measure temp
  qualityFlags: QualityFlag[];
  method: ObservationMethod;
  enteredBy?: number;
}

// ============================================
// Enums and Constants
// ============================================

export type DeviceLabel = 'A' | 'B' | 'C';

export type SensorType = 'manual' | 'bluetooth' | 'wifi' | 'wired' | 'other';

export type ObservationMethod = 'manual' | 'automatic';

export type QualityFlag =
  | 'estimated'
  | 'unstable'
  | 'sensor_swapped'
  | 'air_in_line'
  | 'pressure_surge'
  | 'flow_restricted'
  | 'temperature_anomaly';

export type SourcePoint =
  | 'outside_tap'
  | 'kitchen_cold'
  | 'bathroom_cold'
  | 'shower_cold_feed'
  | 'utility_cold'
  | 'other';

// ============================================
// Computed Results
// ============================================

export interface MainsTestResults {
  testId: string;
  staticPressureBar?: number; // from step 0
  dynamicPressureAtSteps: DynamicPressurePoint[];
  maxFlowObservedLpm?: number;
  pressureDropPerOutlet?: number; // rough heuristic
  supplyCurvePoints: SupplyCurvePoint[];

  // Analysis flags
  warnings: MainsTestWarning[];
  riskFlags: MainsTestRiskFlag[];

  // Metadata
  computedAt: Date;
  confidence: MainsTestConfidence;
}

export interface DynamicPressurePoint {
  stepIndex: number;
  stepLabel: string;
  outletCount: number;
  pressureBar: number; // median/average from observations
  minPressure?: number;
  maxPressure?: number;
  sampleCount: number;
}

export interface SupplyCurvePoint {
  flowLpm: number;
  pressureBar: number;
  tempC?: number;
  stepIndex: number;
  stepLabel: string;
}

// ============================================
// Validation and Warnings
// ============================================

export interface MainsTestWarning {
  code: MainsTestWarningCode;
  severity: 'info' | 'warning' | 'error';
  category: 'data_quality' | 'plausibility' | 'completeness';
  message: string;
  suggestedFix?: string;
  affectedFields?: string[];
  context?: Record<string, unknown>;
}

export const MainsTestWarningCodes = {
  // Plausibility warnings
  PRESSURE_TOO_LOW: 'PRESSURE_TOO_LOW',
  PRESSURE_TOO_HIGH: 'PRESSURE_TOO_HIGH',
  FLOW_TOO_HIGH: 'FLOW_TOO_HIGH',
  TEMP_TOO_LOW: 'TEMP_TOO_LOW',
  TEMP_TOO_HIGH: 'TEMP_TOO_HIGH',

  // Completeness warnings
  STEP_0_NO_PRESSURE: 'STEP_0_NO_PRESSURE',
  STEP_NO_FLOW: 'STEP_NO_FLOW',
  NO_OBSERVATIONS: 'NO_OBSERVATIONS',
  INCOMPLETE_STEP: 'INCOMPLETE_STEP',

  // Data quality warnings
  HIGH_VARIANCE: 'HIGH_VARIANCE',
  QUALITY_FLAGS_PRESENT: 'QUALITY_FLAGS_PRESENT',
  INCONSISTENT_DATA: 'INCONSISTENT_DATA',
} as const;

export type MainsTestWarningCode = typeof MainsTestWarningCodes[keyof typeof MainsTestWarningCodes];

export interface MainsTestRiskFlag {
  code: MainsTestRiskCode;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  customerStatement: string; // What to tell the customer
  recommendation?: string;
  context?: Record<string, unknown>;
}

export const MainsTestRiskCodes = {
  PRESSURE_COLLAPSE_MULTI_OUTLET: 'PRESSURE_COLLAPSE_MULTI_OUTLET',
  LOW_STATIC_PRESSURE: 'LOW_STATIC_PRESSURE',
  LOW_DYNAMIC_PRESSURE: 'LOW_DYNAMIC_PRESSURE',
  TEMP_INSTABILITY_RISK: 'TEMP_INSTABILITY_RISK',
  COMBI_DHW_STABILITY_RISK: 'COMBI_DHW_STABILITY_RISK',
  FLOW_HIGH_PRESSURE_UNSTABLE: 'FLOW_HIGH_PRESSURE_UNSTABLE',
  PRESSURE_SURGE_DETECTED: 'PRESSURE_SURGE_DETECTED',
} as const;

export type MainsTestRiskCode = typeof MainsTestRiskCodes[keyof typeof MainsTestRiskCodes];

export interface MainsTestConfidence {
  overall: 'high' | 'medium' | 'low';
  pressure: 'high' | 'medium' | 'low';
  flow: 'high' | 'medium' | 'low';
  temperature: 'high' | 'medium' | 'low';
  factors: string[]; // Reasons for confidence level
}

// ============================================
// UI State and Templates
// ============================================

export interface MainsTestDraft {
  test?: Partial<MainsPerformanceTest>;
  devices: Partial<MainsTestDevice>[];
  steps: Partial<MainsTestStep>[];
  observations: Partial<MainsTestObservation>[];
  currentStepIndex: number;
  currentScreen: MainsTestScreen;
}

export type MainsTestScreen = 'create' | 'steps' | 'logging' | 'results';

export interface MainsTestTemplate {
  id: string;
  name: string;
  description: string;
  steps: Omit<MainsTestStep, 'id' | 'testId' | 'createdAt'>[];
}

export const MAINS_TEST_TEMPLATES: MainsTestTemplate[] = [
  {
    id: 'outlets-0-1-2-3',
    name: '0-1-2-3 Outlets',
    description: 'Standard test: all closed, then progressively open 1, 2, 3 outlets',
    steps: [
      { index: 0, label: 'All closed (static)', outletCount: 0 },
      { index: 1, label: 'Outlet 1 open', outletCount: 1 },
      { index: 2, label: 'Outlet 1+2 open', outletCount: 2 },
      { index: 3, label: 'Outlet 1+2+3 open', outletCount: 3 },
    ],
  },
  {
    id: 'flow-sweep',
    name: 'Flow Sweep',
    description: 'Test at controlled flow rates: 5, 10, 15, 20 L/min',
    steps: [
      { index: 0, label: 'All closed (static)', outletCount: 0 },
      { index: 1, label: 'Hold at 5 L/min', outletCount: 1, targetFlowLpm: 5 },
      { index: 2, label: 'Hold at 10 L/min', outletCount: 1, targetFlowLpm: 10 },
      { index: 3, label: 'Hold at 15 L/min', outletCount: 1, targetFlowLpm: 15 },
      { index: 4, label: 'Hold at 20 L/min', outletCount: 1, targetFlowLpm: 20 },
    ],
  },
  {
    id: 'quick-2-outlet',
    name: 'Quick 2-Outlet Test',
    description: 'Fast test: static, 1 outlet, 2 outlets',
    steps: [
      { index: 0, label: 'All closed (static)', outletCount: 0 },
      { index: 1, label: 'Outlet 1 open', outletCount: 1 },
      { index: 2, label: 'Outlet 1+2 open', outletCount: 2 },
    ],
  },
];

// ============================================
// Plausibility Bounds (UK Mains)
// ============================================

export interface PlausibilityBounds {
  pressure: {
    min: number; // bar
    max: number; // bar
    warn_low: number; // bar
    warn_high: number; // bar
  };
  flow: {
    min: number; // L/min
    max: number; // L/min
    warn_high: number; // L/min
  };
  temperature: {
    min: number; // °C
    max: number; // °C
    cold_feed_max: number; // °C - for cold water tests
  };
}

export const UK_MAINS_PLAUSIBILITY_BOUNDS: PlausibilityBounds = {
  pressure: {
    min: 0,
    max: 10, // 10 bar is very high for UK mains
    warn_low: 1.0, // Below 1 bar is concerning
    warn_high: 6.0, // Above 6 bar is unusual
  },
  flow: {
    min: 0,
    max: 100, // Hard limit
    warn_high: 60, // Above 60 L/min is very high for domestic
  },
  temperature: {
    min: 0,
    max: 100,
    cold_feed_max: 25, // Cold water should not exceed ~25°C
  },
};

// ============================================
// API Request/Response Types
// ============================================

export interface CreateMainsTestRequest {
  propertyId?: number;
  surveyId?: number;
  sourcePoint: string;
  ambientTempC?: number;
  notes?: string;
  devices: Omit<MainsTestDevice, 'id' | 'testId' | 'createdAt'>[];
}

export interface CreateMainsTestResponse {
  test: MainsPerformanceTest;
  devices: MainsTestDevice[];
}

export interface AddStepsRequest {
  testId: string;
  steps: Omit<MainsTestStep, 'id' | 'testId' | 'createdAt'>[];
}

export interface AddObservationRequest {
  testId: string;
  stepId: string;
  deviceId: string;
  pressureBar?: number;
  flowLpm?: number;
  waterTempC?: number;
  qualityFlags?: QualityFlag[];
  method?: ObservationMethod;
}

export interface GetMainsTestResultsResponse {
  test: MainsPerformanceTest;
  devices: MainsTestDevice[];
  steps: MainsTestStep[];
  observations: MainsTestObservation[];
  results: MainsTestResults;
}
