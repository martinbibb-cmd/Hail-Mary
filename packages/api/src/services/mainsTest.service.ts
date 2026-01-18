/**
 * Mains Performance Test Service
 *
 * Handles computations, validation, and analysis for mains water supply performance tests.
 * Generates pressure-flow curves, risk flags, and customer-facing insights.
 */

import {
  MainsPerformanceTest,
  MainsTestDevice,
  MainsTestStep,
  MainsTestObservation,
  MainsTestResults,
  MainsTestWarning,
  MainsTestWarningCodes,
  MainsTestRiskFlag,
  MainsTestRiskCodes,
  MainsTestConfidence,
  DynamicPressurePoint,
  SupplyCurvePoint,
  UK_MAINS_PLAUSIBILITY_BOUNDS,
} from '@hail-mary/shared';

// ============================================
// Validation Functions
// ============================================

/**
 * Validate a single observation for plausibility
 */
export function validateObservation(
  observation: MainsTestObservation,
  warnings: MainsTestWarning[] = []
): MainsTestWarning[] {
  const bounds = UK_MAINS_PLAUSIBILITY_BOUNDS;

  // Pressure validation
  if (observation.pressureBar !== undefined && observation.pressureBar !== null) {
    if (observation.pressureBar < bounds.pressure.min) {
      warnings.push({
        code: MainsTestWarningCodes.PRESSURE_TOO_LOW,
        severity: 'error',
        category: 'plausibility',
        message: `Pressure ${observation.pressureBar} bar is below minimum (${bounds.pressure.min} bar). Check measurement.`,
        suggestedFix: 'Verify sensor is working correctly. Negative or zero pressure suggests sensor error.',
        affectedFields: ['pressureBar'],
        context: { observationId: observation.id, value: observation.pressureBar },
      });
    } else if (observation.pressureBar > bounds.pressure.max) {
      warnings.push({
        code: MainsTestWarningCodes.PRESSURE_TOO_HIGH,
        severity: 'error',
        category: 'plausibility',
        message: `Pressure ${observation.pressureBar} bar exceeds maximum (${bounds.pressure.max} bar). Check measurement.`,
        suggestedFix: 'UK mains pressure rarely exceeds 10 bar. Verify reading and sensor calibration.',
        affectedFields: ['pressureBar'],
        context: { observationId: observation.id, value: observation.pressureBar },
      });
    } else if (observation.pressureBar < bounds.pressure.warn_low) {
      warnings.push({
        code: MainsTestWarningCodes.PRESSURE_TOO_LOW,
        severity: 'warning',
        category: 'plausibility',
        message: `Pressure ${observation.pressureBar} bar is low (below ${bounds.pressure.warn_low} bar).`,
        suggestedFix: 'Low pressure may indicate supply issues or measurement during high demand.',
        affectedFields: ['pressureBar'],
        context: { observationId: observation.id, value: observation.pressureBar },
      });
    } else if (observation.pressureBar > bounds.pressure.warn_high) {
      warnings.push({
        code: MainsTestWarningCodes.PRESSURE_TOO_HIGH,
        severity: 'warning',
        category: 'plausibility',
        message: `Pressure ${observation.pressureBar} bar is high (above ${bounds.pressure.warn_high} bar).`,
        suggestedFix: 'High pressure may require a pressure reducing valve.',
        affectedFields: ['pressureBar'],
        context: { observationId: observation.id, value: observation.pressureBar },
      });
    }
  }

  // Flow validation
  if (observation.flowLpm !== undefined && observation.flowLpm !== null) {
    if (observation.flowLpm < bounds.flow.min) {
      warnings.push({
        code: MainsTestWarningCodes.FLOW_TOO_LOW,
        severity: 'error',
        category: 'plausibility',
        message: `Flow ${observation.flowLpm} L/min is negative. Check measurement.`,
        suggestedFix: 'Flow rate should not be negative. Verify sensor connection and flow direction.',
        affectedFields: ['flowLpm'],
        context: { observationId: observation.id, value: observation.flowLpm },
      });
    } else if (observation.flowLpm > bounds.flow.max) {
      warnings.push({
        code: MainsTestWarningCodes.FLOW_TOO_HIGH,
        severity: 'error',
        category: 'plausibility',
        message: `Flow ${observation.flowLpm} L/min exceeds maximum (${bounds.flow.max} L/min). Check measurement.`,
        suggestedFix: 'Flow rate seems implausibly high for domestic supply. Verify reading.',
        affectedFields: ['flowLpm'],
        context: { observationId: observation.id, value: observation.flowLpm },
      });
    } else if (observation.flowLpm > bounds.flow.warn_high) {
      warnings.push({
        code: MainsTestWarningCodes.FLOW_TOO_HIGH,
        severity: 'warning',
        category: 'plausibility',
        message: `Flow ${observation.flowLpm} L/min is very high (above ${bounds.flow.warn_high} L/min).`,
        suggestedFix: 'Very high flow rate - confirm this is accurate for your test setup.',
        affectedFields: ['flowLpm'],
        context: { observationId: observation.id, value: observation.flowLpm },
      });
    }
  }

  // Temperature validation (for cold water tests)
  if (observation.waterTempC !== undefined && observation.waterTempC !== null) {
    if (observation.waterTempC < bounds.temperature.min) {
      warnings.push({
        code: MainsTestWarningCodes.TEMP_TOO_LOW,
        severity: 'error',
        category: 'plausibility',
        message: `Temperature ${observation.waterTempC}°C is below freezing. Check measurement.`,
        suggestedFix: 'Temperature below 0°C suggests sensor error or frozen pipes.',
        affectedFields: ['waterTempC'],
        context: { observationId: observation.id, value: observation.waterTempC },
      });
    } else if (observation.waterTempC > bounds.temperature.max) {
      warnings.push({
        code: MainsTestWarningCodes.TEMP_TOO_HIGH,
        severity: 'error',
        category: 'plausibility',
        message: `Temperature ${observation.waterTempC}°C exceeds maximum (${bounds.temperature.max}°C). Check measurement.`,
        suggestedFix: 'Temperature seems implausibly high. Verify sensor.',
        affectedFields: ['waterTempC'],
        context: { observationId: observation.id, value: observation.waterTempC },
      });
    } else if (observation.waterTempC > bounds.temperature.cold_feed_max) {
      warnings.push({
        code: MainsTestWarningCodes.TEMP_TOO_HIGH,
        severity: 'warning',
        category: 'plausibility',
        message: `Cold water temperature ${observation.waterTempC}°C is unusually high (above ${bounds.temperature.cold_feed_max}°C).`,
        suggestedFix: 'Cold feed temperature is warmer than expected. May indicate hot water contamination.',
        affectedFields: ['waterTempC'],
        context: { observationId: observation.id, value: observation.waterTempC },
      });
    }
  }

  // Quality flag warnings
  if (observation.qualityFlags && observation.qualityFlags.length > 0) {
    warnings.push({
      code: MainsTestWarningCodes.QUALITY_FLAGS_PRESENT,
      severity: 'info',
      category: 'data_quality',
      message: `Observation has quality flags: ${observation.qualityFlags.join(', ')}`,
      affectedFields: ['qualityFlags'],
      context: { observationId: observation.id, flags: observation.qualityFlags },
    });
  }

  return warnings;
}

/**
 * Validate completeness of a test
 */
export function validateTestCompleteness(
  steps: MainsTestStep[],
  observations: MainsTestObservation[],
  warnings: MainsTestWarning[] = []
): MainsTestWarning[] {
  // Check step 0 has pressure
  const step0 = steps.find(s => s.index === 0);
  if (step0) {
    const step0Observations = observations.filter(o => o.stepId === step0.id);
    const step0HasPressure = step0Observations.some(o => o.pressureBar !== undefined && o.pressureBar !== null);

    if (!step0HasPressure) {
      warnings.push({
        code: MainsTestWarningCodes.STEP_0_NO_PRESSURE,
        severity: 'warning',
        category: 'completeness',
        message: 'Step 0 (static pressure) has no pressure readings. Cannot compute static pressure.',
        suggestedFix: 'Add at least one pressure reading for step 0 with all outlets closed.',
        affectedFields: ['observations'],
        context: { stepId: step0.id },
      });
    }
  }

  // Check steps with outletCount > 0 have flow readings
  for (const step of steps) {
    if (step.outletCount > 0) {
      const stepObservations = observations.filter(o => o.stepId === step.id);
      const hasFlow = stepObservations.some(o => o.flowLpm !== undefined && o.flowLpm !== null);

      if (!hasFlow) {
        warnings.push({
          code: MainsTestWarningCodes.STEP_NO_FLOW,
          severity: 'warning',
          category: 'completeness',
          message: `Step ${step.index} "${step.label}" indicates ${step.outletCount} outlet(s) open but has no flow readings.`,
          suggestedFix: 'Add flow readings for this step or adjust outlet count.',
          affectedFields: ['observations'],
          context: { stepId: step.id, stepIndex: step.index, outletCount: step.outletCount },
        });
      }
    }
  }

  // Check for steps with no observations
  for (const step of steps) {
    const stepObservations = observations.filter(o => o.stepId === step.id);
    if (stepObservations.length === 0) {
      warnings.push({
        code: MainsTestWarningCodes.NO_OBSERVATIONS,
        severity: 'warning',
        category: 'completeness',
        message: `Step ${step.index} "${step.label}" has no observations.`,
        suggestedFix: 'Add observations for this step or remove it from the test.',
        affectedFields: ['observations'],
        context: { stepId: step.id, stepIndex: step.index },
      });
    }
  }

  return warnings;
}

// ============================================
// Computation Functions
// ============================================

/**
 * Compute static pressure from step 0 observations
 */
export function computeStaticPressure(
  steps: MainsTestStep[],
  observations: MainsTestObservation[]
): number | undefined {
  const step0 = steps.find(s => s.index === 0);
  if (!step0) return undefined;

  const step0Observations = observations.filter(o => o.stepId === step0.id);
  const pressureReadings = step0Observations
    .map(o => o.pressureBar)
    .filter((p): p is number => p !== undefined && p !== null);

  if (pressureReadings.length === 0) return undefined;

  // Return median pressure
  const sorted = [...pressureReadings].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Compute dynamic pressure points for each step
 */
export function computeDynamicPressurePoints(
  steps: MainsTestStep[],
  observations: MainsTestObservation[]
): DynamicPressurePoint[] {
  const points: DynamicPressurePoint[] = [];

  for (const step of steps) {
    const stepObservations = observations.filter(o => o.stepId === step.id);
    const pressureReadings = stepObservations
      .map(o => o.pressureBar)
      .filter((p): p is number => p !== undefined && p !== null);

    if (pressureReadings.length === 0) continue;

    const sorted = [...pressureReadings].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    points.push({
      stepIndex: step.index,
      stepLabel: step.label,
      outletCount: step.outletCount,
      pressureBar: median,
      minPressure: Math.min(...pressureReadings),
      maxPressure: Math.max(...pressureReadings),
      sampleCount: pressureReadings.length,
    });
  }

  return points;
}

/**
 * Compute supply curve points (flow vs pressure)
 */
export function computeSupplyCurvePoints(
  steps: MainsTestStep[],
  observations: MainsTestObservation[]
): SupplyCurvePoint[] {
  const points: SupplyCurvePoint[] = [];

  for (const step of steps) {
    const stepObservations = observations.filter(o => o.stepId === step.id);

    // Group by device to get device-level readings
    const deviceReadings = new Map<string, { pressure?: number; flow?: number; temp?: number }>();

    for (const obs of stepObservations) {
      if (!deviceReadings.has(obs.deviceId)) {
        deviceReadings.set(obs.deviceId, {});
      }
      const reading = deviceReadings.get(obs.deviceId)!;

      // Take the latest reading for each metric
      if (obs.pressureBar !== undefined && obs.pressureBar !== null) {
        reading.pressure = obs.pressureBar;
      }
      if (obs.flowLpm !== undefined && obs.flowLpm !== null) {
        reading.flow = obs.flowLpm;
      }
      if (obs.waterTempC !== undefined && obs.waterTempC !== null) {
        reading.temp = obs.waterTempC;
      }
    }

    // Create points where both flow and pressure are available
    for (const [_, reading] of deviceReadings) {
      if (reading.pressure !== undefined && reading.flow !== undefined) {
        points.push({
          flowLpm: reading.flow,
          pressureBar: reading.pressure,
          tempC: reading.temp,
          stepIndex: step.index,
          stepLabel: step.label,
        });
      }
    }
  }

  // Sort by flow rate
  return points.sort((a, b) => a.flowLpm - b.flowLpm);
}

/**
 * Analyze test results and generate risk flags
 */
export function analyzeTestResults(
  test: MainsPerformanceTest,
  steps: MainsTestStep[],
  observations: MainsTestObservation[],
  staticPressure?: number,
  dynamicPoints: DynamicPressurePoint[] = []
): MainsTestRiskFlag[] {
  const risks: MainsTestRiskFlag[] = [];

  // Risk 1: Low static pressure
  if (staticPressure !== undefined && staticPressure < 1.5) {
    risks.push({
      code: MainsTestRiskCodes.LOW_STATIC_PRESSURE,
      severity: staticPressure < 1.0 ? 'critical' : 'high',
      title: 'Low Static Pressure',
      description: `Static pressure is ${staticPressure.toFixed(2)} bar, which is below the typical minimum of 1.5 bar.`,
      customerStatement: `Your mains water pressure is ${staticPressure < 1.0 ? 'critically' : 'significantly'} low at ${staticPressure.toFixed(1)} bar. This may cause poor shower performance and could affect combi boiler operation.`,
      recommendation: 'Consider installing a mains booster pump or contact your water supplier to investigate supply issues.',
      context: { staticPressure },
    });
  }

  // Risk 2: Large pressure collapse between steps
  for (let i = 1; i < dynamicPoints.length; i++) {
    const prev = dynamicPoints[i - 1];
    const curr = dynamicPoints[i];
    const pressureDrop = prev.pressureBar - curr.pressureBar;
    const dropPercent = (pressureDrop / prev.pressureBar) * 100;

    if (dropPercent > 30 && curr.outletCount >= 2) {
      risks.push({
        code: MainsTestRiskCodes.PRESSURE_COLLAPSE_MULTI_OUTLET,
        severity: 'high',
        title: 'Significant Pressure Drop Under Load',
        description: `Pressure drops ${dropPercent.toFixed(0)}% (${pressureDrop.toFixed(2)} bar) when increasing from ${prev.outletCount} to ${curr.outletCount} outlets.`,
        customerStatement: `Running multiple taps simultaneously causes a significant pressure drop. Using ${curr.outletCount} outlets drops pressure by ${dropPercent.toFixed(0)}%, which may cause temperature fluctuations or reduced flow.`,
        recommendation: 'Consider investigating pipe sizing, potential blockages, or installing a pressure accumulator.',
        context: {
          fromStep: prev.stepIndex,
          toStep: curr.stepIndex,
          pressureDrop,
          dropPercent,
        },
      });
    }
  }

  // Risk 3: Low dynamic pressure with multiple outlets
  const multiOutletPoints = dynamicPoints.filter(p => p.outletCount >= 2);
  for (const point of multiOutletPoints) {
    if (point.pressureBar < 1.0) {
      risks.push({
        code: MainsTestRiskCodes.LOW_DYNAMIC_PRESSURE,
        severity: 'critical',
        title: 'Critical Pressure Drop Under Demand',
        description: `Pressure falls to ${point.pressureBar.toFixed(2)} bar with ${point.outletCount} outlets open.`,
        customerStatement: `When using ${point.outletCount} outlets together, your water pressure drops below 1 bar. This will likely cause combi boiler instability and poor performance from showers and taps.`,
        recommendation: 'This is a critical issue. Consider upgrading pipework, installing a pressure accumulator, or addressing supply restrictions.',
        context: {
          stepIndex: point.stepIndex,
          outletCount: point.outletCount,
          pressure: point.pressureBar,
        },
      });
    } else if (point.pressureBar < 1.5) {
      risks.push({
        code: MainsTestRiskCodes.COMBI_DHW_STABILITY_RISK,
        severity: 'medium',
        title: 'Combi DHW Stability Risk',
        description: `Pressure drops to ${point.pressureBar.toFixed(2)} bar with ${point.outletCount} outlets, below ideal combi operating pressure.`,
        customerStatement: `Turning on ${point.outletCount === 2 ? 'a tap while showering' : 'multiple taps'} may cause temperature instability or reduced flow from your combi boiler.`,
        recommendation: 'Monitor combi performance during simultaneous use. Consider a pressure accumulator if issues occur frequently.',
        context: {
          stepIndex: point.stepIndex,
          outletCount: point.outletCount,
          pressure: point.pressureBar,
        },
      });
    }
  }

  // Risk 4: Temperature instability
  const tempReadings = observations
    .map(o => o.waterTempC)
    .filter((t): t is number => t !== undefined && t !== null);

  if (tempReadings.length >= 3) {
    const avgTemp = tempReadings.reduce((sum, t) => sum + t, 0) / tempReadings.length;
    const variance = tempReadings.reduce((sum, t) => sum + Math.pow(t - avgTemp, 2), 0) / tempReadings.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > 3) {
      risks.push({
        code: MainsTestRiskCodes.TEMP_INSTABILITY_RISK,
        severity: 'medium',
        title: 'Temperature Variation Detected',
        description: `Cold feed temperature varies significantly (±${stdDev.toFixed(1)}°C) during test.`,
        customerStatement: 'Your cold water temperature fluctuates during use, which may indicate hot water mixing back into the cold supply or supply issues.',
        recommendation: 'Check for backflow prevention and ensure hot/cold supplies are properly isolated.',
        context: { avgTemp, stdDev, sampleCount: tempReadings.length },
      });
    }
  }

  return risks;
}

/**
 * Compute confidence in test results
 */
export function computeConfidence(
  observations: MainsTestObservation[],
  warnings: MainsTestWarning[]
): MainsTestConfidence {
  const factors: string[] = [];

  // Count observations by type
  const pressureCount = observations.filter(o => o.pressureBar !== undefined && o.pressureBar !== null).length;
  const flowCount = observations.filter(o => o.flowLpm !== undefined && o.flowLpm !== null).length;
  const tempCount = observations.filter(o => o.waterTempC !== undefined && o.waterTempC !== null).length;

  // Count quality issues
  const qualityFlaggedCount = observations.filter(o => o.qualityFlags && o.qualityFlags.length > 0).length;
  const errorCount = warnings.filter(w => w.severity === 'error').length;
  const warningCount = warnings.filter(w => w.severity === 'warning').length;

  // Compute individual confidence scores
  let pressureConfidence: 'high' | 'medium' | 'low' = 'high';
  if (pressureCount < 3) {
    pressureConfidence = 'low';
    factors.push('Limited pressure readings');
  } else if (pressureCount < 6 || errorCount > 0) {
    pressureConfidence = 'medium';
    if (errorCount > 0) factors.push('Pressure readings have plausibility errors');
  }

  let flowConfidence: 'high' | 'medium' | 'low' = 'high';
  if (flowCount < 2) {
    flowConfidence = 'low';
    factors.push('Limited flow readings');
  } else if (flowCount < 4) {
    flowConfidence = 'medium';
  }

  let tempConfidence: 'high' | 'medium' | 'low' = 'high';
  if (tempCount === 0) {
    tempConfidence = 'low';
    factors.push('No temperature readings');
  } else if (tempCount < 3) {
    tempConfidence = 'medium';
  }

  // Quality flags impact
  if (qualityFlaggedCount > observations.length / 2) {
    factors.push('Many observations have quality flags');
  }

  if (warningCount > 3) {
    factors.push('Multiple validation warnings');
  }

  // Overall confidence
  let overall: 'high' | 'medium' | 'low' = 'high';
  if (pressureConfidence === 'low' || flowConfidence === 'low' || errorCount > 2) {
    overall = 'low';
  } else if (pressureConfidence === 'medium' || flowConfidence === 'medium' || warningCount > 2) {
    overall = 'medium';
  }

  return {
    overall,
    pressure: pressureConfidence,
    flow: flowConfidence,
    temperature: tempConfidence,
    factors,
  };
}

/**
 * Main function: compute complete test results
 */
export function computeTestResults(
  test: MainsPerformanceTest,
  devices: MainsTestDevice[],
  steps: MainsTestStep[],
  observations: MainsTestObservation[]
): MainsTestResults {
  const warnings: MainsTestWarning[] = [];

  // Validate all observations
  for (const observation of observations) {
    validateObservation(observation, warnings);
  }

  // Validate test completeness
  validateTestCompleteness(steps, observations, warnings);

  // Compute metrics
  const staticPressureBar = computeStaticPressure(steps, observations);
  const dynamicPressureAtSteps = computeDynamicPressurePoints(steps, observations);
  const supplyCurvePoints = computeSupplyCurvePoints(steps, observations);

  // Max flow
  const flowReadings = observations
    .map(o => o.flowLpm)
    .filter((f): f is number => f !== undefined && f !== null);
  const maxFlowObservedLpm = flowReadings.length > 0 ? Math.max(...flowReadings) : undefined;

  // Pressure drop per outlet (heuristic)
  let pressureDropPerOutlet: number | undefined;
  if (dynamicPressureAtSteps.length >= 2) {
    const drops: number[] = [];
    for (let i = 1; i < dynamicPressureAtSteps.length; i++) {
      const prev = dynamicPressureAtSteps[i - 1];
      const curr = dynamicPressureAtSteps[i];
      const outletDelta = curr.outletCount - prev.outletCount;
      if (outletDelta > 0) {
        const pressureDrop = prev.pressureBar - curr.pressureBar;
        drops.push(pressureDrop / outletDelta);
      }
    }
    if (drops.length > 0) {
      pressureDropPerOutlet = drops.reduce((sum, d) => sum + d, 0) / drops.length;
    }
  }

  // Analyze risks
  const riskFlags = analyzeTestResults(test, steps, observations, staticPressureBar, dynamicPressureAtSteps);

  // Compute confidence
  const confidence = computeConfidence(observations, warnings);

  return {
    testId: test.id,
    staticPressureBar,
    dynamicPressureAtSteps,
    maxFlowObservedLpm,
    pressureDropPerOutlet,
    supplyCurvePoints,
    warnings,
    riskFlags,
    computedAt: new Date(),
    confidence,
  };
}
