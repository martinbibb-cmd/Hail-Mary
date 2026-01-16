/**
 * Mains Test Service Unit Tests
 *
 * Tests for computation, validation, and analysis functions.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateObservation,
  validateTestCompleteness,
  computeStaticPressure,
  computeDynamicPressurePoints,
  computeSupplyCurvePoints,
  analyzeTestResults,
  computeConfidence,
  computeTestResults,
} from '../services/mainsTest.service';
import type {
  MainsPerformanceTest,
  MainsTestDevice,
  MainsTestStep,
  MainsTestObservation,
  MainsTestWarning,
} from '@hail-mary/shared';

// ============================================
// Test Data Helpers
// ============================================

const createMockTest = (): MainsPerformanceTest => ({
  id: 'test-1',
  propertyId: 1,
  surveyId: 1,
  userId: 1,
  accountId: 1,
  sourcePoint: 'outside_tap',
  ambientTempC: 15,
  notes: 'Test notes',
  createdAt: new Date(),
  createdBy: 1,
});

const createMockDevice = (label: 'A' | 'B' | 'C', id: string): MainsTestDevice => ({
  id,
  testId: 'test-1',
  label,
  location: `Device ${label} location`,
  sensorType: 'manual',
  createdAt: new Date(),
});

const createMockStep = (index: number, outletCount: number, label: string, id: string): MainsTestStep => ({
  id,
  testId: 'test-1',
  index,
  label,
  outletCount,
  createdAt: new Date(),
});

const createMockObservation = (
  stepId: string,
  deviceId: string,
  pressureBar?: number,
  flowLpm?: number,
  waterTempC?: number
): MainsTestObservation => ({
  id: `obs-${Math.random()}`,
  testId: 'test-1',
  stepId,
  deviceId,
  timestamp: new Date(),
  pressureBar,
  flowLpm,
  waterTempC,
  qualityFlags: [],
  method: 'manual',
});

// ============================================
// Validation Tests
// ============================================

describe('validateObservation', () => {
  it('should flag pressure too low (below 0 bar)', () => {
    const obs = createMockObservation('step-1', 'device-1', -0.5);
    const warnings: MainsTestWarning[] = [];
    validateObservation(obs, warnings);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].code).toBe('PRESSURE_TOO_LOW');
    expect(warnings[0].severity).toBe('error');
  });

  it('should flag pressure too high (above 10 bar)', () => {
    const obs = createMockObservation('step-1', 'device-1', 12);
    const warnings: MainsTestWarning[] = [];
    validateObservation(obs, warnings);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].code).toBe('PRESSURE_TOO_HIGH');
    expect(warnings[0].severity).toBe('error');
  });

  it('should warn for low pressure (below 1 bar)', () => {
    const obs = createMockObservation('step-1', 'device-1', 0.8);
    const warnings: MainsTestWarning[] = [];
    validateObservation(obs, warnings);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].code).toBe('PRESSURE_TOO_LOW');
    expect(warnings[0].severity).toBe('warning');
  });

  it('should warn for high pressure (above 6 bar)', () => {
    const obs = createMockObservation('step-1', 'device-1', 7);
    const warnings: MainsTestWarning[] = [];
    validateObservation(obs, warnings);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].code).toBe('PRESSURE_TOO_HIGH');
    expect(warnings[0].severity).toBe('warning');
  });

  it('should accept normal pressure (1-6 bar)', () => {
    const obs = createMockObservation('step-1', 'device-1', 3.5);
    const warnings: MainsTestWarning[] = [];
    validateObservation(obs, warnings);

    expect(warnings.length).toBe(0);
  });

  it('should flag flow too high (above 100 L/min)', () => {
    const obs = createMockObservation('step-1', 'device-1', undefined, 150);
    const warnings: MainsTestWarning[] = [];
    validateObservation(obs, warnings);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].code).toBe('FLOW_TOO_HIGH');
    expect(warnings[0].severity).toBe('error');
  });

  it('should warn for very high flow (above 60 L/min)', () => {
    const obs = createMockObservation('step-1', 'device-1', undefined, 70);
    const warnings: MainsTestWarning[] = [];
    validateObservation(obs, warnings);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].code).toBe('FLOW_TOO_HIGH');
    expect(warnings[0].severity).toBe('warning');
  });

  it('should flag temperature below 0°C', () => {
    const obs = createMockObservation('step-1', 'device-1', undefined, undefined, -5);
    const warnings: MainsTestWarning[] = [];
    validateObservation(obs, warnings);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].code).toBe('TEMP_TOO_LOW');
    expect(warnings[0].severity).toBe('error');
  });

  it('should warn for cold water temp above 25°C', () => {
    const obs = createMockObservation('step-1', 'device-1', undefined, undefined, 30);
    const warnings: MainsTestWarning[] = [];
    validateObservation(obs, warnings);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].code).toBe('TEMP_TOO_HIGH');
    expect(warnings[0].severity).toBe('warning');
  });
});

describe('validateTestCompleteness', () => {
  it('should warn if step 0 has no pressure readings', () => {
    const steps = [createMockStep(0, 0, 'All closed', 'step-0')];
    const observations = [createMockObservation('step-0', 'device-1', undefined, 10)]; // Flow but no pressure
    const warnings: MainsTestWarning[] = [];

    validateTestCompleteness(steps, observations, warnings);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.code === 'STEP_0_NO_PRESSURE')).toBe(true);
  });

  it('should warn if step with outlets open has no flow readings', () => {
    const steps = [
      createMockStep(0, 0, 'All closed', 'step-0'),
      createMockStep(1, 1, 'Outlet 1', 'step-1'),
    ];
    const observations = [
      createMockObservation('step-0', 'device-1', 3.5),
      createMockObservation('step-1', 'device-1', 3.2), // Pressure but no flow
    ];
    const warnings: MainsTestWarning[] = [];

    validateTestCompleteness(steps, observations, warnings);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.code === 'STEP_NO_FLOW')).toBe(true);
  });

  it('should warn if step has no observations at all', () => {
    const steps = [
      createMockStep(0, 0, 'All closed', 'step-0'),
      createMockStep(1, 1, 'Outlet 1', 'step-1'),
    ];
    const observations = [createMockObservation('step-0', 'device-1', 3.5)];
    const warnings: MainsTestWarning[] = [];

    validateTestCompleteness(steps, observations, warnings);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.code === 'NO_OBSERVATIONS')).toBe(true);
  });
});

// ============================================
// Computation Tests
// ============================================

describe('computeStaticPressure', () => {
  it('should compute median pressure from step 0 observations', () => {
    const steps = [createMockStep(0, 0, 'All closed', 'step-0')];
    const observations = [
      createMockObservation('step-0', 'device-1', 3.4),
      createMockObservation('step-0', 'device-1', 3.6),
      createMockObservation('step-0', 'device-1', 3.5),
    ];

    const result = computeStaticPressure(steps, observations);

    expect(result).toBe(3.5); // Median of [3.4, 3.5, 3.6]
  });

  it('should return undefined if no step 0', () => {
    const steps = [createMockStep(1, 1, 'Outlet 1', 'step-1')];
    const observations = [createMockObservation('step-1', 'device-1', 3.2, 15)];

    const result = computeStaticPressure(steps, observations);

    expect(result).toBeUndefined();
  });

  it('should return undefined if step 0 has no pressure readings', () => {
    const steps = [createMockStep(0, 0, 'All closed', 'step-0')];
    const observations = [createMockObservation('step-0', 'device-1', undefined, 0)];

    const result = computeStaticPressure(steps, observations);

    expect(result).toBeUndefined();
  });

  it('should compute average for even number of observations', () => {
    const steps = [createMockStep(0, 0, 'All closed', 'step-0')];
    const observations = [
      createMockObservation('step-0', 'device-1', 3.0),
      createMockObservation('step-0', 'device-1', 4.0),
    ];

    const result = computeStaticPressure(steps, observations);

    expect(result).toBe(3.5); // Average of middle two: (3.0 + 4.0) / 2
  });
});

describe('computeDynamicPressurePoints', () => {
  it('should compute pressure points for each step', () => {
    const steps = [
      createMockStep(0, 0, 'All closed', 'step-0'),
      createMockStep(1, 1, 'Outlet 1', 'step-1'),
      createMockStep(2, 2, 'Outlet 1+2', 'step-2'),
    ];
    const observations = [
      createMockObservation('step-0', 'device-1', 3.5),
      createMockObservation('step-1', 'device-1', 3.2),
      createMockObservation('step-2', 'device-1', 2.8),
    ];

    const result = computeDynamicPressurePoints(steps, observations);

    expect(result.length).toBe(3);
    expect(result[0].pressureBar).toBe(3.5);
    expect(result[1].pressureBar).toBe(3.2);
    expect(result[2].pressureBar).toBe(2.8);
  });

  it('should compute min/max pressure for steps with multiple readings', () => {
    const steps = [createMockStep(0, 0, 'All closed', 'step-0')];
    const observations = [
      createMockObservation('step-0', 'device-1', 3.4),
      createMockObservation('step-0', 'device-1', 3.6),
      createMockObservation('step-0', 'device-1', 3.5),
    ];

    const result = computeDynamicPressurePoints(steps, observations);

    expect(result.length).toBe(1);
    expect(result[0].minPressure).toBe(3.4);
    expect(result[0].maxPressure).toBe(3.6);
    expect(result[0].sampleCount).toBe(3);
  });

  it('should skip steps with no pressure readings', () => {
    const steps = [
      createMockStep(0, 0, 'All closed', 'step-0'),
      createMockStep(1, 1, 'Outlet 1', 'step-1'),
    ];
    const observations = [
      createMockObservation('step-0', 'device-1', 3.5),
      // step-1 has no observations
    ];

    const result = computeDynamicPressurePoints(steps, observations);

    expect(result.length).toBe(1);
    expect(result[0].stepIndex).toBe(0);
  });
});

describe('computeSupplyCurvePoints', () => {
  it('should create points where both flow and pressure are available', () => {
    const steps = [
      createMockStep(0, 0, 'All closed', 'step-0'),
      createMockStep(1, 1, 'Outlet 1', 'step-1'),
      createMockStep(2, 2, 'Outlet 1+2', 'step-2'),
    ];
    const observations = [
      createMockObservation('step-0', 'device-1', 3.5, 0),
      createMockObservation('step-1', 'device-1', 3.2, 15),
      createMockObservation('step-2', 'device-1', 2.8, 25),
    ];

    const result = computeSupplyCurvePoints(steps, observations);

    expect(result.length).toBe(3);
    expect(result[0].flowLpm).toBe(0);
    expect(result[0].pressureBar).toBe(3.5);
    expect(result[1].flowLpm).toBe(15);
    expect(result[2].flowLpm).toBe(25);
  });

  it('should sort points by flow rate', () => {
    const steps = [
      createMockStep(0, 2, 'High flow', 'step-0'),
      createMockStep(1, 1, 'Low flow', 'step-1'),
    ];
    const observations = [
      createMockObservation('step-0', 'device-1', 2.5, 30), // Higher flow first
      createMockObservation('step-1', 'device-1', 3.0, 10), // Lower flow
    ];

    const result = computeSupplyCurvePoints(steps, observations);

    expect(result.length).toBe(2);
    expect(result[0].flowLpm).toBe(10); // Sorted: lower flow first
    expect(result[1].flowLpm).toBe(30);
  });

  it('should include temperature if available', () => {
    const steps = [createMockStep(0, 1, 'Step 1', 'step-0')];
    const observations = [createMockObservation('step-0', 'device-1', 3.2, 15, 12.5)];

    const result = computeSupplyCurvePoints(steps, observations);

    expect(result.length).toBe(1);
    expect(result[0].tempC).toBe(12.5);
  });

  it('should skip observations missing either flow or pressure', () => {
    const steps = [createMockStep(0, 1, 'Step 1', 'step-0')];
    const observations = [
      createMockObservation('step-0', 'device-1', 3.2, undefined), // No flow
      createMockObservation('step-0', 'device-1', undefined, 15), // No pressure
    ];

    const result = computeSupplyCurvePoints(steps, observations);

    expect(result.length).toBe(0);
  });
});

// ============================================
// Risk Analysis Tests
// ============================================

describe('analyzeTestResults', () => {
  it('should flag low static pressure (below 1.5 bar)', () => {
    const test = createMockTest();
    const steps = [createMockStep(0, 0, 'All closed', 'step-0')];
    const observations = [createMockObservation('step-0', 'device-1', 1.2)];

    const risks = analyzeTestResults(test, steps, observations, 1.2, []);

    expect(risks.length).toBeGreaterThan(0);
    expect(risks.some((r) => r.code === 'LOW_STATIC_PRESSURE')).toBe(true);
  });

  it('should flag critical low dynamic pressure (below 1 bar)', () => {
    const test = createMockTest();
    const steps = [createMockStep(2, 2, 'Outlet 1+2', 'step-2')];
    const observations = [createMockObservation('step-2', 'device-1', 0.8, 20)];
    const dynamicPoints = [
      { stepIndex: 2, stepLabel: 'Outlet 1+2', outletCount: 2, pressureBar: 0.8, sampleCount: 1 },
    ];

    const risks = analyzeTestResults(test, steps, observations, undefined, dynamicPoints);

    expect(risks.length).toBeGreaterThan(0);
    expect(risks.some((r) => r.code === 'LOW_DYNAMIC_PRESSURE')).toBe(true);
    const criticalRisk = risks.find((r) => r.code === 'LOW_DYNAMIC_PRESSURE');
    expect(criticalRisk?.severity).toBe('critical');
  });

  it('should flag large pressure collapse between steps', () => {
    const test = createMockTest();
    const steps = [
      createMockStep(0, 0, 'All closed', 'step-0'),
      createMockStep(1, 1, 'Outlet 1', 'step-1'),
      createMockStep(2, 2, 'Outlet 1+2', 'step-2'),
    ];
    const observations = [
      createMockObservation('step-0', 'device-1', 4.0),
      createMockObservation('step-1', 'device-1', 3.8),
      createMockObservation('step-2', 'device-1', 2.5), // 34% drop from step 1
    ];
    const dynamicPoints = [
      { stepIndex: 0, stepLabel: 'All closed', outletCount: 0, pressureBar: 4.0, sampleCount: 1 },
      { stepIndex: 1, stepLabel: 'Outlet 1', outletCount: 1, pressureBar: 3.8, sampleCount: 1 },
      { stepIndex: 2, stepLabel: 'Outlet 1+2', outletCount: 2, pressureBar: 2.5, sampleCount: 1 },
    ];

    const risks = analyzeTestResults(test, steps, observations, 4.0, dynamicPoints);

    expect(risks.length).toBeGreaterThan(0);
    expect(risks.some((r) => r.code === 'PRESSURE_COLLAPSE_MULTI_OUTLET')).toBe(true);
  });

  it('should not flag small pressure drops', () => {
    const test = createMockTest();
    const steps = [
      createMockStep(0, 0, 'All closed', 'step-0'),
      createMockStep(1, 1, 'Outlet 1', 'step-1'),
    ];
    const observations = [
      createMockObservation('step-0', 'device-1', 4.0),
      createMockObservation('step-1', 'device-1', 3.9), // Only 2.5% drop
    ];
    const dynamicPoints = [
      { stepIndex: 0, stepLabel: 'All closed', outletCount: 0, pressureBar: 4.0, sampleCount: 1 },
      { stepIndex: 1, stepLabel: 'Outlet 1', outletCount: 1, pressureBar: 3.9, sampleCount: 1 },
    ];

    const risks = analyzeTestResults(test, steps, observations, 4.0, dynamicPoints);

    expect(risks.some((r) => r.code === 'PRESSURE_COLLAPSE_MULTI_OUTLET')).toBe(false);
  });
});

// ============================================
// Confidence Tests
// ============================================

describe('computeConfidence', () => {
  it('should return high confidence with good data', () => {
    const observations = [
      createMockObservation('step-0', 'device-1', 3.5, 0, 12),
      createMockObservation('step-1', 'device-1', 3.2, 15, 12),
      createMockObservation('step-2', 'device-1', 2.8, 25, 12),
      createMockObservation('step-3', 'device-1', 2.5, 30, 12),
    ];
    const warnings: MainsTestWarning[] = [];

    const result = computeConfidence(observations, warnings);

    expect(result.overall).toBe('high');
    expect(result.pressure).toBe('high');
    expect(result.flow).toBe('high');
  });

  it('should return low confidence with limited data', () => {
    const observations = [createMockObservation('step-0', 'device-1', 3.5)]; // Only 1 reading, no flow
    const warnings: MainsTestWarning[] = [];

    const result = computeConfidence(observations, warnings);

    expect(result.overall).toBe('low');
    expect(result.pressure).toBe('low');
    expect(result.flow).toBe('low');
  });

  it('should return medium confidence with moderate data', () => {
    const observations = [
      createMockObservation('step-0', 'device-1', 3.5, 0),
      createMockObservation('step-1', 'device-1', 3.2, 15),
      createMockObservation('step-2', 'device-1', 2.8),
    ];
    const warnings: MainsTestWarning[] = [];

    const result = computeConfidence(observations, warnings);

    expect(result.overall).toBe('medium');
    expect(result.flow).toBe('medium');
  });

  it('should lower confidence with errors', () => {
    const observations = [
      createMockObservation('step-0', 'device-1', 3.5, 0, 12),
      createMockObservation('step-1', 'device-1', 3.2, 15, 12),
      createMockObservation('step-2', 'device-1', 2.8, 25, 12),
    ];
    const warnings: MainsTestWarning[] = [
      {
        code: 'PRESSURE_TOO_HIGH',
        severity: 'error',
        category: 'plausibility',
        message: 'Pressure error',
      },
      {
        code: 'PRESSURE_TOO_HIGH',
        severity: 'error',
        category: 'plausibility',
        message: 'Another error',
      },
      {
        code: 'PRESSURE_TOO_HIGH',
        severity: 'error',
        category: 'plausibility',
        message: 'Third error',
      },
    ];

    const result = computeConfidence(observations, warnings);

    expect(result.overall).toBe('low'); // Many errors should lower confidence
  });
});

// ============================================
// Integration Test
// ============================================

describe('computeTestResults', () => {
  it('should compute complete results for a typical test', () => {
    const test = createMockTest();
    const devices = [createMockDevice('A', 'device-1')];
    const steps = [
      createMockStep(0, 0, 'All closed', 'step-0'),
      createMockStep(1, 1, 'Outlet 1', 'step-1'),
      createMockStep(2, 2, 'Outlet 1+2', 'step-2'),
    ];
    const observations = [
      createMockObservation('step-0', 'device-1', 3.5, 0, 12),
      createMockObservation('step-1', 'device-1', 3.2, 15, 12.5),
      createMockObservation('step-2', 'device-1', 2.8, 25, 13),
    ];

    const results = computeTestResults(test, devices, steps, observations);

    expect(results.testId).toBe('test-1');
    expect(results.staticPressureBar).toBe(3.5);
    expect(results.maxFlowObservedLpm).toBe(25);
    expect(results.dynamicPressureAtSteps.length).toBe(3);
    expect(results.supplyCurvePoints.length).toBe(3);
    expect(results.confidence).toBeDefined();
    expect(results.warnings).toBeDefined();
    expect(results.riskFlags).toBeDefined();
  });

  it('should generate warnings for incomplete test', () => {
    const test = createMockTest();
    const devices = [createMockDevice('A', 'device-1')];
    const steps = [
      createMockStep(0, 0, 'All closed', 'step-0'),
      createMockStep(1, 1, 'Outlet 1', 'step-1'),
    ];
    const observations = [
      // Step 0 has no observations
      createMockObservation('step-1', 'device-1', 3.2, undefined), // No flow
    ];

    const results = computeTestResults(test, devices, steps, observations);

    expect(results.warnings.length).toBeGreaterThan(0);
    expect(results.warnings.some((w) => w.code === 'NO_OBSERVATIONS')).toBe(true);
    expect(results.warnings.some((w) => w.code === 'STEP_NO_FLOW')).toBe(true);
  });
});
