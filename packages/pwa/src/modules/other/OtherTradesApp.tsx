/**
 * OtherTradesApp - Future Trades Gateway (GENERIC DEAD LEG)
 * 
 * Purpose:
 * - Gateway for future/third-party modules
 * - Lists existing stubs for future trades
 * - Roofing, Insulation, Glazing, Electrical, etc.
 */

import React from 'react';
import { moduleRegistry, getPlannedModules, type ModuleMeta } from '@hail-mary/shared';
import './OtherTradesApp.css';

interface OtherTradesAppProps {
  onModuleSelect?: (moduleId: string) => void;
}

export const OtherTradesApp: React.FC<OtherTradesAppProps> = ({
  onModuleSelect,
}) => {
  // Get all planned (future) modules
  const plannedModules = getPlannedModules();

  return (
    <div className="other-trades-app">
      <div className="other-trades-header">
        <h2>🔧 Other Trades & Future Modules</h2>
        <span className="module-badge stub">Extensible</span>
      </div>

      <div className="intro-card">
        <p>
          Hail Mary is designed to support additional trades beyond heating and renewables.
          The modules below are planned for future development or can be added by third parties.
        </p>
      </div>

      {/* Planned Modules List */}
      <div className="modules-list">
        <h3>📋 Planned Modules</h3>
        
        {plannedModules.length === 0 ? (
          <p className="empty-state">No additional modules planned yet.</p>
        ) : (
          <div className="module-cards">
            {plannedModules.map((module: ModuleMeta) => (
              <div 
                key={module.id}
                className="module-card planned"
                onClick={() => onModuleSelect?.(module.id)}
              >
                <div className="module-icon">{module.icon}</div>
                <div className="module-info">
                  <h4>{module.label}</h4>
                  <p>{module.description}</p>
                  <span className="phase-badge">Phase {module.phaseIntroduced} – TBD</span>
                </div>
                <div className="module-status">
                  <span className="status-badge planned">Planned</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Third Party Integration Info */}
      <div className="integration-section">
        <h3>🔌 Third Party Integration</h3>
        <p>
          Want to add your own trade module? Hail Mary uses a plug-in architecture that makes it easy:
        </p>
        
        <div className="integration-steps">
          <div className="step">
            <span className="step-number">1</span>
            <div className="step-content">
              <h4>Register your module</h4>
              <p>Add an entry to the module registry with your trade's ID, label, and topics.</p>
            </div>
          </div>
          
          <div className="step">
            <span className="step-number">2</span>
            <div className="step-content">
              <h4>Add helper slots</h4>
              <p>Define the survey questions and chip options for your trade.</p>
            </div>
          </div>
          
          <div className="step">
            <span className="step-number">3</span>
            <div className="step-content">
              <h4>Create your app component</h4>
              <p>Build a React component under <code>/modules/your-trade/</code></p>
            </div>
          </div>
        </div>

        <div className="code-hint">
          <h4>Module Registry Entry:</h4>
          <pre>{`{
  id: 'your_trade',
  label: 'Your Trade',
  icon: '🔨',
  description: 'Description of your trade',
  phaseIntroduced: 3,
  status: 'stub',
  hasUi: true,
  enabled: true,
  navOrder: 100,
  topicTags: ['your_topic'],
}`}</pre>
        </div>
      </div>

      {/* Note about data capture */}
      <div className="data-capture-note">
        <h3>📝 Note: Data Still Captured</h3>
        <p>
          Even without a dedicated module, observations from your surveys are still captured 
          in the HomeProfile and hazards. When a module goes live, relevant data will be 
          automatically surfaced.
        </p>
      </div>
    </div>
  );
};

export default OtherTradesApp;
