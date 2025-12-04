/**
 * HeatPumpApp - Heat Pump Module (DEAD LEG)
 * 
 * Phase: 1 = Stub, Phase 2 = Live
 * 
 * Purpose (when live):
 * - Show HP suitability, flow temps, emitter changes, cylinder situation
 * - Outdoor placement, electrics
 * 
 * Current (Phase 1 stub):
 * - Visible tab marked "early preview"
 * - Shows any opportunistic data from transcript
 * - Simple read-only summary + "Not implemented yet" note
 */

import React from 'react';
import type { SystemSpecDraft, HeatPumpSpec } from '@hail-mary/shared';
import './HeatPumpApp.css';

interface HeatPumpAppProps {
  specDraft?: SystemSpecDraft;
  onSpecUpdate?: (path: string, value: unknown) => void;
}

const emptySpec: SystemSpecDraft = {
  activeModules: ['heat_pump'],
  heatPump: {},
};

export const HeatPumpApp: React.FC<HeatPumpAppProps> = ({
  specDraft = emptySpec,
}) => {
  const hp = specDraft.heatPump || {};
  const hasAnyData = Object.keys(hp).some(key => {
    const section = hp[key as keyof HeatPumpSpec];
    return section && Object.values(section).some(v => v !== undefined && v !== null);
  });

  return (
    <div className="hp-app stub-app">
      <div className="hp-app-header">
        <h2>♨️ Heat Pump</h2>
        <span className="module-badge stub">Phase 2 - Coming Soon</span>
      </div>

      <div className="stub-notice">
        <div className="stub-icon">🚧</div>
        <h3>Heat Pump Module – Phase 2</h3>
        <p>This module is currently a preview. Full functionality will be available in Phase 2.</p>
      </div>

      {/* Show any inferred data if present */}
      {hasAnyData && (
        <div className="inferred-data-card">
          <h4>📋 Data Detected</h4>
          <p className="data-hint">The following has been captured from your survey:</p>
          
          {hp.proposedSystem?.replaceBoilerCompletely !== undefined && (
            <div className="data-item">
              <span className="data-label">Replace boiler completely:</span>
              <span className="data-value">
                {hp.proposedSystem.replaceBoilerCompletely === true ? 'Yes' :
                 hp.proposedSystem.replaceBoilerCompletely === false ? 'No (Hybrid)' : 'Undecided'}
              </span>
            </div>
          )}

          {hp.emitterCheck?.designFlowTempTarget && (
            <div className="data-item">
              <span className="data-label">Target flow temp:</span>
              <span className="data-value">{hp.emitterCheck.designFlowTempTarget}°C</span>
            </div>
          )}

          {hp.emitterCheck?.roomsNeedingUpsize && (
            <div className="data-item">
              <span className="data-label">Radiator changes:</span>
              <span className="data-value">{hp.emitterCheck.roomsNeedingUpsize}</span>
            </div>
          )}

          {hp.plantArea?.existingCylinderReusePossible && (
            <div className="data-item">
              <span className="data-label">Cylinder plan:</span>
              <span className="data-value">{hp.plantArea.existingCylinderReusePossible}</span>
            </div>
          )}

          {hp.outdoorUnit?.candidateLocationQuality && (
            <div className="data-item">
              <span className="data-label">Outdoor location:</span>
              <span className="data-value">{hp.outdoorUnit.candidateLocationQuality}</span>
            </div>
          )}

          {hp.electrical?.mainFuseOkForHPAndRest && (
            <div className="data-item">
              <span className="data-label">Electrical capacity:</span>
              <span className="data-value">{hp.electrical.mainFuseOkForHPAndRest}</span>
            </div>
          )}
        </div>
      )}

      <div className="phase-roadmap">
        <h4>🗺️ What's Coming in Phase 2</h4>
        <ul>
          <li>
            <span className="feature-icon">🌡️</span>
            HP suitability assessment
          </li>
          <li>
            <span className="feature-icon">📐</span>
            Flow temperature planning
          </li>
          <li>
            <span className="feature-icon">🔲</span>
            Radiator upsize calculations
          </li>
          <li>
            <span className="feature-icon">🏠</span>
            Cylinder situation analysis
          </li>
          <li>
            <span className="feature-icon">📍</span>
            Outdoor unit placement
          </li>
          <li>
            <span className="feature-icon">⚡</span>
            Electrical capacity checks
          </li>
          <li>
            <span className="feature-icon">🔊</span>
            Noise risk assessment
          </li>
        </ul>
      </div>

      <div className="stub-footer">
        <p>
          We'll use this space for HP suitability, radiator changes, and cylinder planning.
          <br />
          Any mentions of "heat pump" or "HP-ready cylinder" in your transcript will be captured here.
        </p>
      </div>
    </div>
  );
};

export default HeatPumpApp;
