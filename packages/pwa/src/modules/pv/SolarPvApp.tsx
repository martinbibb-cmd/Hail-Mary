/**
 * SolarPvApp - Solar PV Module (DEAD LEG)
 * 
 * Phase: 1 = Stub, Phase 2 = Live
 * 
 * Purpose (when live):
 * - Show roof aspects, shading, roof condition
 * - Inverter location/electrics
 * 
 * Current (Phase 1 stub):
 * - Preview tab
 * - Shows any opportunistic data from transcript
 */

import React from 'react';
import type { SystemSpecDraft, SolarPvSpec } from '@hail-mary/shared';
import './SolarPvApp.css';

interface SolarPvAppProps {
  specDraft?: SystemSpecDraft;
  onSpecUpdate?: (path: string, value: unknown) => void;
}

const emptySpec: SystemSpecDraft = {
  activeModules: ['pv'],
  solarPv: {},
};

export const SolarPvApp: React.FC<SolarPvAppProps> = ({
  specDraft = emptySpec,
}) => {
  const pv = specDraft.solarPv || {};
  const hasAnyData = Object.keys(pv).some(key => {
    const section = pv[key as keyof SolarPvSpec];
    return section && Object.values(section).some(v => v !== undefined && v !== null);
  });

  return (
    <div className="pv-app stub-app">
      <div className="pv-app-header">
        <h2>☀️ Solar PV</h2>
        <span className="module-badge stub">Phase 2 - Coming Soon</span>
      </div>

      <div className="stub-notice pv">
        <div className="stub-icon">🚧</div>
        <h3>Solar PV Module – Phase 2</h3>
        <p>This module is currently a preview. Full functionality will be available in Phase 2.</p>
      </div>

      {/* Show any inferred data if present */}
      {hasAnyData && (
        <div className="inferred-data-card pv">
          <h4>📋 Potential Roof Pitches</h4>
          <p className="data-hint">The following has been detected:</p>
          
          {pv.roofUse?.mainPitchAspect && (
            <div className="data-item">
              <span className="data-label">Main roof aspect:</span>
              <span className="data-value">{pv.roofUse.mainPitchAspect}</span>
            </div>
          )}

          {pv.roofUse?.shadingSummary && (
            <div className="data-item">
              <span className="data-label">Shading:</span>
              <span className="data-value">{pv.roofUse.shadingSummary}</span>
            </div>
          )}

          {pv.structuralAndAccess?.roofConditionSummary && (
            <div className="data-item">
              <span className="data-label">Roof condition:</span>
              <span className="data-value">{pv.structuralAndAccess.roofConditionSummary}</span>
            </div>
          )}

          {pv.electricalIntegration?.inverterLocationQuality && (
            <div className="data-item">
              <span className="data-label">Inverter location:</span>
              <span className="data-value">{pv.electricalIntegration.inverterLocationQuality}</span>
            </div>
          )}

          {pv.storageAndFuture?.batteryInterestLevel && (
            <div className="data-item">
              <span className="data-label">Battery interest:</span>
              <span className="data-value">{pv.storageAndFuture.batteryInterestLevel}</span>
            </div>
          )}
        </div>
      )}

      <div className="phase-roadmap">
        <h4>🗺️ What's Coming in Phase 2</h4>
        <ul>
          <li>
            <span className="feature-icon">🧭</span>
            Roof aspect analysis (S, SE, SW, E, W)
          </li>
          <li>
            <span className="feature-icon">🌳</span>
            Shading impact assessment
          </li>
          <li>
            <span className="feature-icon">🏗️</span>
            Roof condition check
          </li>
          <li>
            <span className="feature-icon">📍</span>
            Inverter location planning
          </li>
          <li>
            <span className="feature-icon">⚡</span>
            Grid/export limit analysis
          </li>
          <li>
            <span className="feature-icon">🔋</span>
            Battery storage integration
          </li>
          <li>
            <span className="feature-icon">📐</span>
            Panel layout recommendations
          </li>
        </ul>
      </div>

      <div className="stub-footer">
        <p>
          This module will recommend panel layouts, shading impact and inverter locations.
          <br />
          Any mentions of "solar", "PV", or "roof" in your transcript will be captured here.
        </p>
      </div>
    </div>
  );
};

export default SolarPvApp;
