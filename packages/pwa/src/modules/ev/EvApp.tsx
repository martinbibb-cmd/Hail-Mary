/**
 * EvApp - EV Charging Module (DEAD LEG)
 * 
 * Phase: 1 = Stub, Phase 2 = Live
 * 
 * Purpose (when live):
 * - Off-street parking, charger location, cable route complexity
 * - Fuse/earthing, load management, PV integration
 */

import React from 'react';
import type { SystemSpecDraft, EvSpec } from '@hail-mary/shared';
import './EvApp.css';

interface EvAppProps {
  specDraft?: SystemSpecDraft;
  onSpecUpdate?: (path: string, value: unknown) => void;
}

const emptySpec: SystemSpecDraft = {
  activeModules: ['ev'],
  ev: {},
};

export const EvApp: React.FC<EvAppProps> = ({
  specDraft = emptySpec,
}) => {
  const ev = specDraft.ev || {};
  const hasAnyData = Object.keys(ev).some(key => {
    const section = ev[key as keyof EvSpec];
    return section && Object.values(section).some(v => v !== undefined && v !== null);
  });

  return (
    <div className="ev-app stub-app">
      <div className="ev-app-header">
        <h2>🔌 EV Charging</h2>
        <span className="module-badge stub">Phase 2 - Coming Soon</span>
      </div>

      <div className="stub-notice ev">
        <div className="stub-icon">🚧</div>
        <h3>EV Charger Module – Phase 2</h3>
        <p>This module is currently a preview. Full functionality will be available in Phase 2.</p>
      </div>

      {/* Show any inferred data if present */}
      {hasAnyData && (
        <div className="inferred-data-card ev">
          <h4>🅿️ Parking Summary</h4>
          <p className="data-hint">The following has been detected:</p>
          
          {ev.parking?.offStreet !== undefined && (
            <div className="data-item">
              <span className="data-label">Off-street parking:</span>
              <span className="data-value">
                {ev.parking.offStreet === true ? 'Yes' :
                 ev.parking.offStreet === false ? 'No' :
                 ev.parking.offStreet === 'shared' ? 'Shared/Complex' : 'Unknown'}
              </span>
            </div>
          )}

          {ev.parking?.cableRouteComplexity && (
            <div className="data-item">
              <span className="data-label">Cable route:</span>
              <span className="data-value">{ev.parking.cableRouteComplexity}</span>
            </div>
          )}

          {ev.electricalCapacity?.mainFuseOkForEV && (
            <div className="data-item">
              <span className="data-label">Main fuse status:</span>
              <span className="data-value">{ev.electricalCapacity.mainFuseOkForEV}</span>
            </div>
          )}

          {ev.earthingAndRegs?.earthingTypeKnown && (
            <div className="data-item">
              <span className="data-label">Earthing type:</span>
              <span className="data-value">{ev.earthingAndRegs.earthingTypeKnown}</span>
            </div>
          )}

          {ev.smartIntegration?.PVIntegrationPlanned !== undefined && (
            <div className="data-item">
              <span className="data-label">PV integration:</span>
              <span className="data-value">
                {ev.smartIntegration.PVIntegrationPlanned === true ? 'Yes' :
                 ev.smartIntegration.PVIntegrationPlanned === false ? 'No' : 'Undecided'}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="phase-roadmap">
        <h4>🗺️ What's Coming in Phase 2</h4>
        <ul>
          <li>
            <span className="feature-icon">🅿️</span>
            Parking & charger location planning
          </li>
          <li>
            <span className="feature-icon">🔌</span>
            Cable route assessment
          </li>
          <li>
            <span className="feature-icon">⚡</span>
            Fuse rating & capacity check
          </li>
          <li>
            <span className="feature-icon">🔧</span>
            Earthing type (PME/TN-S/TT)
          </li>
          <li>
            <span className="feature-icon">⚖️</span>
            Load management requirements
          </li>
          <li>
            <span className="feature-icon">☀️</span>
            PV integration planning
          </li>
          <li>
            <span className="feature-icon">📱</span>
            Smart charger recommendations
          </li>
        </ul>
      </div>

      <div className="stub-footer">
        <p>
          This module will plan EV charger placement, cable route and load management.
          <br />
          Any mentions of "EV", "electric vehicle", or "charger" in your transcript will be captured here.
        </p>
      </div>
    </div>
  );
};

export default EvApp;
