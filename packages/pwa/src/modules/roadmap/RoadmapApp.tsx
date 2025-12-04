/**
 * RoadmapApp - Upgrade Roadmap Module (DEAD LEG)
 * 
 * Phase: 1 = Minimal stub, Phase 2 = Partial, Phase 3 = Full
 * 
 * Purpose (when live):
 * - Show the 10-15 year plan: Today, Next, Future across all modules
 * - 0-2 / 2-5 / 5-15 year upgrade recommendations
 */

import React from 'react';
import type { SystemSpecDraft } from '@hail-mary/shared';
import './RoadmapApp.css';

interface RoadmapAppProps {
  specDraft?: SystemSpecDraft;
}

const emptySpec: SystemSpecDraft = {
  activeModules: ['core', 'central_heating'],
};

export const RoadmapApp: React.FC<RoadmapAppProps> = ({
  specDraft = emptySpec,
}) => {
  const ch = specDraft.centralHeating;
  const boilerAge = ch?.existingHeatSource?.boilerApproxAgeYears;
  const boilerCondition = ch?.existingHeatSource?.generalCondition;

  // Simple heuristic for "what next" hint
  const getQuickThought = () => {
    if (boilerCondition === 'condemned') {
      return '🚨 Boiler is condemned - immediate replacement required';
    }
    if (boilerCondition === 'poor') {
      return '⚠️ Boiler in poor condition - replacement recommended within 0-2 years';
    }
    if (boilerAge === '20-30' || boilerAge === '30-40' || boilerAge === '40+') {
      return '📅 Boiler is over 20 years old - plan replacement within 0-2 years';
    }
    if (boilerAge === '10-20') {
      return '📋 Boiler is 10-20 years old - start planning replacement in 2-5 years';
    }
    if (boilerAge === '<10' && boilerCondition === 'good') {
      return '✅ Boiler is relatively new and in good condition';
    }
    return '📊 Add more survey data to generate roadmap insights';
  };

  return (
    <div className="roadmap-app stub-app">
      <div className="roadmap-app-header">
        <h2>🗺️ Upgrade Roadmap</h2>
        <span className="module-badge stub">Phase 3 - Planned</span>
      </div>

      <div className="stub-notice roadmap">
        <div className="stub-icon">🚧</div>
        <h3>Upgrade Roadmap – Planned</h3>
        <p>Full roadmap functionality will be available in Phase 3.</p>
      </div>

      {/* Quick Thoughts Section - Simple "What Next" widget */}
      <div className="quick-thoughts-card">
        <h4>💭 Quick Thoughts</h4>
        <div className="thought-content">
          <p>{getQuickThought()}</p>
        </div>
      </div>

      {/* Phase Preview */}
      <div className="roadmap-preview">
        <h4>📅 Timeline Preview</h4>
        
        <div className="timeline-section">
          <div className="timeline-header">
            <span className="timeline-badge now">0-2 Years</span>
            <span className="timeline-label">Immediate / Now</span>
          </div>
          <div className="timeline-content placeholder">
            <p>Immediate upgrades will appear here based on survey data</p>
          </div>
        </div>

        <div className="timeline-section">
          <div className="timeline-header">
            <span className="timeline-badge next">2-5 Years</span>
            <span className="timeline-label">Near Term</span>
          </div>
          <div className="timeline-content placeholder">
            <p>Near-term planning recommendations will appear here</p>
          </div>
        </div>

        <div className="timeline-section">
          <div className="timeline-header">
            <span className="timeline-badge future">5-15 Years</span>
            <span className="timeline-label">Future Planning</span>
          </div>
          <div className="timeline-content placeholder">
            <p>Long-term upgrade path will appear here</p>
          </div>
        </div>
      </div>

      <div className="phase-roadmap">
        <h4>🗺️ What's Coming in Phase 3</h4>
        <ul>
          <li>
            <span className="feature-icon">📊</span>
            Full 0-2 / 2-5 / 5-15 year upgrade plan
          </li>
          <li>
            <span className="feature-icon">💷</span>
            Cost estimates and ROI calculations
          </li>
          <li>
            <span className="feature-icon">🌿</span>
            Carbon savings projections
          </li>
          <li>
            <span className="feature-icon">🏛️</span>
            Grant eligibility (BUS, ECO4, etc.)
          </li>
          <li>
            <span className="feature-icon">🔗</span>
            Cross-module recommendations (HP+PV+EV)
          </li>
          <li>
            <span className="feature-icon">📤</span>
            Exportable customer roadmap PDF
          </li>
        </ul>
      </div>

      <div className="stub-footer">
        <p>
          This will eventually show a 0-2 / 2-5 / 5-15 year upgrade plan.
          <br />
          Currently shows basic insights based on CH survey data.
        </p>
      </div>
    </div>
  );
};

export default RoadmapApp;
