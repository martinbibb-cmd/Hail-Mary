/**
 * Mains Performance Test Module
 *
 * Multi-screen workflow for testing mains water supply performance:
 * 1. Create Test - Set up test with devices
 * 2. Define Steps - Choose test template or custom steps
 * 3. Log Observations - Step-by-step data entry
 * 4. Results - Computed analysis with warnings and risk flags
 */

import React, { useState, useEffect } from 'react';
import {
  MainsPerformanceTest,
  MainsTestDevice,
  MainsTestStep,
  MainsTestObservation,
  MainsTestResults,
  MainsTestScreen,
  DeviceLabel,
  SourcePoint,
  MAINS_TEST_TEMPLATES,
  CreateMainsTestRequest,
  AddStepsRequest,
  AddObservationRequest,
  ApiResponse,
  GetMainsTestResultsResponse,
  QualityFlag,
} from '@hail-mary/shared';
import './MainsTestApp.css';

interface MainsTestAppProps {
  propertyId?: number;
  surveyId?: number;
  readOnly?: boolean;
}

export const MainsTestApp: React.FC<MainsTestAppProps> = ({
  propertyId,
  surveyId,
  readOnly = false,
}) => {
  // State
  const [currentScreen, setCurrentScreen] = useState<MainsTestScreen>('create');
  const [test, setTest] = useState<MainsPerformanceTest | null>(null);
  const [devices, setDevices] = useState<MainsTestDevice[]>([]);
  const [steps, setSteps] = useState<MainsTestStep[]>([]);
  const [observations, setObservations] = useState<MainsTestObservation[]>([]);
  const [results, setResults] = useState<MainsTestResults | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for creating test
  const [sourcePoint, setSourcePoint] = useState<SourcePoint>('outside_tap');
  const [ambientTempC, setAmbientTempC] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [deviceDrafts, setDeviceDrafts] = useState<
    Array<{ label: DeviceLabel; location: string; notes: string }>
  >([{ label: 'A', location: '', notes: '' }]);

  // Form state for current observation
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [pressureBar, setPressureBar] = useState<string>('');
  const [flowLpm, setFlowLpm] = useState<string>('');
  const [waterTempC, setWaterTempC] = useState<string>('');
  const [qualityFlags, setQualityFlags] = useState<QualityFlag[]>([]);

  // API base URL
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // ============================================
  // API Functions
  // ============================================

  const createTest = async () => {
    setLoading(true);
    setError(null);

    try {
      const request: CreateMainsTestRequest = {
        propertyId,
        surveyId,
        sourcePoint,
        ambientTempC: ambientTempC ? parseFloat(ambientTempC) : undefined,
        notes,
        devices: deviceDrafts.map((d) => ({
          label: d.label,
          location: d.location,
          sensorType: 'manual',
          notes: d.notes,
        })),
      };

      const response = await fetch(`${API_BASE}/api/mains-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      });

      const data: ApiResponse<any> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to create test');
      }

      setTest(data.data.test);
      setDevices(data.data.devices);
      setCurrentScreen('steps');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const addSteps = async (template: typeof MAINS_TEST_TEMPLATES[number]) => {
    if (!test) return;

    setLoading(true);
    setError(null);

    try {
      const request: AddStepsRequest = {
        testId: test.id,
        steps: template.steps,
      };

      const response = await fetch(`${API_BASE}/api/mains-test/${test.id}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      });

      const data: ApiResponse<MainsTestStep[]> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to add steps');
      }

      setSteps(data.data);
      setCurrentStepIndex(0);
      setCurrentScreen('logging');
      // Initialize with first device if available
      if (devices.length > 0) {
        setCurrentDeviceId(devices[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const addObservation = async () => {
    if (!test || !steps[currentStepIndex] || !currentDeviceId) return;

    setLoading(true);
    setError(null);

    try {
      const request: AddObservationRequest = {
        testId: test.id,
        stepId: steps[currentStepIndex].id,
        deviceId: currentDeviceId,
        pressureBar: pressureBar ? parseFloat(pressureBar) : undefined,
        flowLpm: flowLpm ? parseFloat(flowLpm) : undefined,
        waterTempC: waterTempC ? parseFloat(waterTempC) : undefined,
        qualityFlags,
        method: 'manual',
      };

      const response = await fetch(`${API_BASE}/api/mains-test/${test.id}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      });

      const data: ApiResponse<MainsTestObservation> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to add observation');
      }

      setObservations([...observations, data.data]);

      // Clear form
      setPressureBar('');
      setFlowLpm('');
      setWaterTempC('');
      setQualityFlags([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    if (!test) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/mains-test/${test.id}/results`, {
        method: 'GET',
        credentials: 'include',
      });

      const data: ApiResponse<GetMainsTestResultsResponse> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to fetch results');
      }

      setResults(data.data.results);
      setObservations(data.data.observations);
      setCurrentScreen('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Screen 1: Create Test
  // ============================================

  const renderCreateScreen = () => (
    <div className="mains-test-screen">
      <div className="screen-header">
        <h2>💧 Create Mains Performance Test</h2>
        <p>Set up devices and source point for water supply testing</p>
      </div>

      <div className="form-section">
        <label className="field-label">Source Point *</label>
        <select
          className="field-select"
          value={sourcePoint}
          onChange={(e) => setSourcePoint(e.target.value as SourcePoint)}
          disabled={readOnly || loading}
        >
          <option value="outside_tap">Outside Tap (Recommended)</option>
          <option value="kitchen_cold">Kitchen Cold Tap</option>
          <option value="bathroom_cold">Bathroom Cold Tap</option>
          <option value="shower_cold_feed">Shower Cold Feed</option>
          <option value="utility_cold">Utility Cold Tap</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="form-section">
        <label className="field-label">Ambient Temperature (°C)</label>
        <input
          type="number"
          className="field-input"
          value={ambientTempC}
          onChange={(e) => setAmbientTempC(e.target.value)}
          placeholder="Optional"
          step="0.1"
          disabled={readOnly || loading}
        />
      </div>

      <div className="form-section">
        <label className="field-label">Test Notes</label>
        <textarea
          className="field-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes about test conditions, weather, etc."
          rows={3}
          disabled={readOnly || loading}
        />
      </div>

      <div className="form-section">
        <label className="field-label">Test Devices (A/B/C)</label>
        <p className="field-hint">
          Add 1-3 measurement devices. Each can measure pressure, flow, and/or temperature.
        </p>

        {deviceDrafts.map((device, idx) => (
          <div key={idx} className="device-draft-card">
            <div className="device-draft-header">
              <span className="device-label-badge">{device.label}</span>
              {deviceDrafts.length > 1 && (
                <button
                  className="btn-icon"
                  onClick={() => setDeviceDrafts(deviceDrafts.filter((_, i) => i !== idx))}
                  disabled={readOnly || loading}
                >
                  ✕
                </button>
              )}
            </div>

            <input
              type="text"
              className="field-input"
              value={device.location}
              onChange={(e) => {
                const updated = [...deviceDrafts];
                updated[idx].location = e.target.value;
                setDeviceDrafts(updated);
              }}
              placeholder="Location (e.g., 'Outside tap front', 'Kitchen sink')"
              disabled={readOnly || loading}
            />

            <input
              type="text"
              className="field-input"
              value={device.notes}
              onChange={(e) => {
                const updated = [...deviceDrafts];
                updated[idx].notes = e.target.value;
                setDeviceDrafts(updated);
              }}
              placeholder="Notes (e.g., 'Measures pressure only')"
              disabled={readOnly || loading}
            />
          </div>
        ))}

        {deviceDrafts.length < 3 && (
          <button
            className="btn-secondary"
            onClick={() => {
              const nextLabel: DeviceLabel = deviceDrafts.length === 1 ? 'B' : 'C';
              setDeviceDrafts([...deviceDrafts, { label: nextLabel, location: '', notes: '' }]);
            }}
            disabled={readOnly || loading}
          >
            + Add Device {deviceDrafts.length === 1 ? 'B' : 'C'}
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="screen-footer">
        <button
          className="btn-primary"
          onClick={createTest}
          disabled={readOnly || loading || !deviceDrafts[0].location}
        >
          {loading ? 'Creating...' : 'Create Test & Continue'}
        </button>
      </div>
    </div>
  );

  // ============================================
  // Screen 2: Define Steps
  // ============================================

  const renderStepsScreen = () => (
    <div className="mains-test-screen">
      <div className="screen-header">
        <h2>📋 Define Test Steps</h2>
        <p>Choose a test template or create custom load steps</p>
      </div>

      <div className="templates-grid">
        {MAINS_TEST_TEMPLATES.map((template) => (
          <div key={template.id} className="template-card">
            <h3>{template.name}</h3>
            <p className="template-description">{template.description}</p>

            <div className="template-steps">
              <strong>Steps:</strong>
              <ol>
                {template.steps.map((step) => (
                  <li key={step.index}>
                    {step.label}
                    {step.targetFlowLpm && ` (${step.targetFlowLpm} L/min)`}
                  </li>
                ))}
              </ol>
            </div>

            <button
              className="btn-primary"
              onClick={() => addSteps(template)}
              disabled={readOnly || loading}
            >
              {loading ? 'Loading...' : 'Use This Template'}
            </button>
          </div>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="screen-footer">
        <button className="btn-secondary" onClick={() => setCurrentScreen('create')}>
          ← Back
        </button>
      </div>
    </div>
  );

  // ============================================
  // Screen 3: Log Observations
  // ============================================

  const renderLoggingScreen = () => {
    if (steps.length === 0) return <div>No steps defined</div>;

    const currentStep = steps[currentStepIndex];
    const currentStepObservations = observations.filter((o) => o.stepId === currentStep.id);

    return (
      <div className="mains-test-screen">
        <div className="screen-header">
          <h2>📊 Log Observations</h2>
          <div className="step-progress">
            Step {currentStepIndex + 1} of {steps.length}: <strong>{currentStep.label}</strong>
          </div>
        </div>

        <div className="logging-layout">
          {/* Left: Current step info */}
          <div className="step-info-panel">
            <h3>Current Step</h3>
            <div className="step-details">
              <p>
                <strong>Label:</strong> {currentStep.label}
              </p>
              <p>
                <strong>Outlets Open:</strong> {currentStep.outletCount}
              </p>
              {currentStep.targetFlowLpm && (
                <p>
                  <strong>Target Flow:</strong> {currentStep.targetFlowLpm} L/min
                </p>
              )}
              {currentStep.notes && (
                <p>
                  <strong>Notes:</strong> {currentStep.notes}
                </p>
              )}
            </div>

            <h4>Instructions</h4>
            <ol className="step-instructions">
              <li>Set up outlets according to step configuration</li>
              <li>Wait for readings to stabilize (~30 seconds)</li>
              <li>Record readings from each device</li>
              <li>Move to next step</li>
            </ol>

            <h4>Recorded Observations ({currentStepObservations.length})</h4>
            <div className="observations-list">
              {currentStepObservations.map((obs) => {
                const device = devices.find((d) => d.id === obs.deviceId);
                return (
                  <div key={obs.id} className="observation-item">
                    <strong>{device?.label}</strong>:{' '}
                    {obs.pressureBar && `${obs.pressureBar} bar`}
                    {obs.flowLpm && `, ${obs.flowLpm} L/min`}
                    {obs.waterTempC && `, ${obs.waterTempC}°C`}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Observation form */}
          <div className="observation-form-panel">
            <h3>Record Reading</h3>

            <div className="form-section">
              <label className="field-label">Device *</label>
              <select
                className="field-select"
                value={currentDeviceId}
                onChange={(e) => setCurrentDeviceId(e.target.value)}
                disabled={readOnly || loading}
              >
                <option value="">Select device...</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.label} - {device.location}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-section">
              <label className="field-label">Pressure (bar)</label>
              <input
                type="number"
                className="field-input"
                value={pressureBar}
                onChange={(e) => setPressureBar(e.target.value)}
                placeholder="e.g., 2.5"
                step="0.01"
                disabled={readOnly || loading || !currentDeviceId}
              />
            </div>

            <div className="form-section">
              <label className="field-label">Flow (L/min)</label>
              <input
                type="number"
                className="field-input"
                value={flowLpm}
                onChange={(e) => setFlowLpm(e.target.value)}
                placeholder="e.g., 15"
                step="0.1"
                disabled={readOnly || loading || !currentDeviceId}
              />
            </div>

            <div className="form-section">
              <label className="field-label">Temperature (°C)</label>
              <input
                type="number"
                className="field-input"
                value={waterTempC}
                onChange={(e) => setWaterTempC(e.target.value)}
                placeholder="e.g., 12"
                step="0.1"
                disabled={readOnly || loading || !currentDeviceId}
              />
            </div>

            <div className="form-section">
              <label className="field-label">Quality Flags</label>
              <div className="quality-flags">
                {(['estimated', 'unstable', 'air_in_line'] as QualityFlag[]).map((flag) => (
                  <label key={flag} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={qualityFlags.includes(flag)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setQualityFlags([...qualityFlags, flag]);
                        } else {
                          setQualityFlags(qualityFlags.filter((f) => f !== flag));
                        }
                      }}
                      disabled={readOnly || loading || !currentDeviceId}
                    />
                    {flag.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={addObservation}
              disabled={
                readOnly ||
                loading ||
                !currentDeviceId ||
                (!pressureBar && !flowLpm && !waterTempC)
              }
            >
              {loading ? 'Adding...' : 'Add Reading'}
            </button>

            {error && <div className="error-banner">{error}</div>}
          </div>
        </div>

        <div className="screen-footer">
          <button
            className="btn-secondary"
            onClick={() => {
              if (currentStepIndex > 0) {
                setCurrentStepIndex(currentStepIndex - 1);
              }
            }}
            disabled={currentStepIndex === 0}
          >
            ← Previous Step
          </button>

          {currentStepIndex < steps.length - 1 ? (
            <button
              className="btn-primary"
              onClick={() => setCurrentStepIndex(currentStepIndex + 1)}
            >
              Next Step →
            </button>
          ) : (
            <button className="btn-primary" onClick={fetchResults}>
              Complete & View Results →
            </button>
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // Screen 4: Results
  // ============================================

  const renderResultsScreen = () => {
    if (!results) return <div>No results available</div>;

    return (
      <div className="mains-test-screen">
        <div className="screen-header">
          <h2>📈 Test Results & Analysis</h2>
          <p>Computed performance metrics and risk assessment</p>
        </div>

        {/* Key Metrics */}
        <div className="results-section">
          <h3>Key Metrics</h3>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Static Pressure</div>
              <div className="metric-value">
                {results.staticPressureBar?.toFixed(2) || 'N/A'} bar
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Max Flow Observed</div>
              <div className="metric-value">
                {results.maxFlowObservedLpm?.toFixed(1) || 'N/A'} L/min
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Pressure Drop/Outlet</div>
              <div className="metric-value">
                {results.pressureDropPerOutlet?.toFixed(2) || 'N/A'} bar
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Confidence</div>
              <div className={`metric-value confidence-${results.confidence.overall}`}>
                {results.confidence.overall.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Risk Flags */}
        {results.riskFlags.length > 0 && (
          <div className="results-section">
            <h3>⚠️ Risk Flags</h3>
            <div className="risk-flags-list">
              {results.riskFlags.map((risk, idx) => (
                <div key={idx} className={`risk-card risk-${risk.severity}`}>
                  <div className="risk-header">
                    <span className="risk-severity">{risk.severity.toUpperCase()}</span>
                    <strong>{risk.title}</strong>
                  </div>
                  <p className="risk-description">{risk.description}</p>
                  <div className="risk-customer-statement">
                    <strong>Customer Statement:</strong> {risk.customerStatement}
                  </div>
                  {risk.recommendation && (
                    <div className="risk-recommendation">
                      <strong>Recommendation:</strong> {risk.recommendation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Pressure Points */}
        {results.dynamicPressureAtSteps.length > 0 && (
          <div className="results-section">
            <h3>Pressure vs Load Steps</h3>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Outlets</th>
                    <th>Pressure (bar)</th>
                    <th>Min/Max</th>
                    <th>Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {results.dynamicPressureAtSteps.map((point) => (
                    <tr key={point.stepIndex}>
                      <td>{point.stepLabel}</td>
                      <td>{point.outletCount}</td>
                      <td>{point.pressureBar.toFixed(2)}</td>
                      <td>
                        {point.minPressure?.toFixed(2)} / {point.maxPressure?.toFixed(2)}
                      </td>
                      <td>{point.sampleCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Supply Curve */}
        {results.supplyCurvePoints.length > 0 && (
          <div className="results-section">
            <h3>Supply Curve (Flow vs Pressure)</h3>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Flow (L/min)</th>
                    <th>Pressure (bar)</th>
                    <th>Temp (°C)</th>
                    <th>Step</th>
                  </tr>
                </thead>
                <tbody>
                  {results.supplyCurvePoints.map((point, idx) => (
                    <tr key={idx}>
                      <td>{point.flowLpm.toFixed(1)}</td>
                      <td>{point.pressureBar.toFixed(2)}</td>
                      <td>{point.tempC?.toFixed(1) || 'N/A'}</td>
                      <td>{point.stepLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Warnings */}
        {results.warnings.length > 0 && (
          <div className="results-section">
            <h3>⚠️ Validation Warnings</h3>
            <div className="warnings-list">
              {results.warnings.map((warning, idx) => (
                <div key={idx} className={`warning-item warning-${warning.severity}`}>
                  <strong>{warning.category}:</strong> {warning.message}
                  {warning.suggestedFix && <div className="fix-suggestion">{warning.suggestedFix}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="screen-footer">
          <button className="btn-secondary" onClick={() => setCurrentScreen('logging')}>
            ← Back to Logging
          </button>
          <button className="btn-secondary" onClick={() => window.print()}>
            🖨️ Print Results
          </button>
        </div>
      </div>
    );
  };

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="mains-test-app">
      <div className="app-header">
        <h1>💧 Mains Performance Test</h1>
        <div className="screen-nav">
          {(['create', 'steps', 'logging', 'results'] as MainsTestScreen[]).map((screen) => (
            <button
              key={screen}
              className={`screen-nav-btn ${currentScreen === screen ? 'active' : ''} ${
                screen === 'steps' && !test ? 'disabled' : ''
              } ${screen === 'logging' && steps.length === 0 ? 'disabled' : ''} ${
                screen === 'results' && !results ? 'disabled' : ''
              }`}
              onClick={() => {
                if (screen === 'steps' && !test) return;
                if (screen === 'logging' && steps.length === 0) return;
                if (screen === 'results' && !results) return;
                setCurrentScreen(screen);
              }}
            >
              {screen.charAt(0).toUpperCase() + screen.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="app-content">
        {currentScreen === 'create' && renderCreateScreen()}
        {currentScreen === 'steps' && renderStepsScreen()}
        {currentScreen === 'logging' && renderLoggingScreen()}
        {currentScreen === 'results' && renderResultsScreen()}
      </div>
    </div>
  );
};
