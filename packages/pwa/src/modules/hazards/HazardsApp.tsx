/**
 * HazardsApp - Hazards Module
 * 
 * Phase: 1 (Live)
 * 
 * Purpose:
 * - Log scary stuff: asbestos, monkey muck, legacy materials, access restrictions
 * - Critical for safety - affects CH outcomes
 */

import React, { useState } from 'react';
import type { 
  SystemSpecDraft,
  SurveySlot,
} from '@hail-mary/shared';
import './HazardsApp.css';

interface HazardsAppProps {
  specDraft?: SystemSpecDraft;
  onSpecUpdate?: (path: string, value: unknown) => void;
  readOnly?: boolean;
}

const emptySpec: SystemSpecDraft = {
  activeModules: ['hazards'],
  hazards: {},
};

export const HazardsApp: React.FC<HazardsAppProps> = ({
  specDraft = emptySpec,
  onSpecUpdate,
  readOnly = false,
}) => {
  const [currentSlot, setCurrentSlot] = useState<SurveySlot | null>(null);

  const hazards = specDraft.hazards || {};
  const asbestos = hazards.asbestos || {};

  const updateField = (path: string, value: unknown) => {
    if (onSpecUpdate && !readOnly) {
      onSpecUpdate(path, value);
    }
  };

  const showHelper = (_slotId: string) => {
    // TODO: Connect to SurveyHelper service
    console.log('Helper requested for:', _slotId);
  };

  const handleChipSelect = (slot: SurveySlot, value: unknown) => {
    updateField(slot.path, value);
    setCurrentSlot(null);
  };

  // Check if any hazards are flagged
  const hasHazards = () => {
    const suspected = asbestos.suspectedLocations || [];
    const monkeyMuck = asbestos.monkeyMuckObserved;
    const legacy = hazards.legacyMaterials || [];
    const access = hazards.accessRestrictions || [];
    
    return suspected.length > 0 || 
           (monkeyMuck && monkeyMuck !== 'no') ||
           legacy.length > 0 ||
           access.length > 0;
  };

  return (
    <div className="hazards-app">
      <div className="hazards-app-header">
        <h2>⚠️ Hazards</h2>
        <span className="module-badge live">Phase 1 - Live</span>
      </div>

      {/* Warning Banner */}
      {hasHazards() && (
        <div className="hazard-warning-banner">
          <span className="warning-icon">🚨</span>
          <span>Hazards detected - review before proceeding</span>
        </div>
      )}

      {/* Asbestos Section */}
      <div className="hazard-section">
        <div className="section-header">
          <h3>☢️ Asbestos</h3>
          <span className="section-badge critical">Critical</span>
        </div>

        <div className="hazard-field">
          <div className="field-header">
            <label>Suspected Locations</label>
            <button 
              className="helper-btn"
              onClick={() => showHelper('haz.asbestos.suspected')}
              disabled={readOnly}
            >
              Ask Helper
            </button>
          </div>
          <div className="chip-options">
            {[
              { value: ['known'], label: 'Yes - Known' },
              { value: ['suspected'], label: 'Yes - Suspected' },
              { value: [], label: 'No / None obvious' },
            ].map((opt, idx) => (
              <button
                key={idx}
                className={`chip ${JSON.stringify(asbestos.suspectedLocations) === JSON.stringify(opt.value) ? 'selected' : ''} ${opt.value.length > 0 ? 'warning' : ''}`}
                onClick={() => updateField('hazards.asbestos.suspectedLocations', opt.value)}
                disabled={readOnly}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hazard-field">
          <div className="field-header">
            <label>Surveys on File?</label>
          </div>
          <div className="chip-options">
            {[
              { value: true, label: 'Yes' },
              { value: false, label: 'No' },
            ].map(opt => (
              <button
                key={String(opt.value)}
                className={`chip ${asbestos.surveysOnFile === opt.value ? 'selected' : ''}`}
                onClick={() => updateField('hazards.asbestos.surveysOnFile', opt.value)}
                disabled={readOnly}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Monkey Muck Section - Rare Hazard */}
      <div className="hazard-section monkey-muck">
        <div className="section-header">
          <h3>🧪 Monkey Muck</h3>
          <span className="section-badge rare">Rare Hazard</span>
        </div>

        <p className="section-description">
          Asbestos-containing paste sometimes found on old heating systems.
          <strong> Only show this if you've observed or suspect it.</strong>
        </p>

        <div className="hazard-field">
          <div className="field-header">
            <label>Monkey Muck Observed?</label>
            <button 
              className="helper-btn"
              onClick={() => showHelper('haz.asbestos.monkey_muck')}
              disabled={readOnly}
            >
              Confirm
            </button>
          </div>
          <div className="chip-options">
            {[
              { value: 'confirmed', label: '✓ Yes, Confirmed' },
              { value: 'suspected', label: '? Suspected Only' },
              { value: 'no', label: '✗ No' },
              { value: null, label: 'Not Checked' },
            ].map((opt, idx) => (
              <button
                key={idx}
                className={`chip ${asbestos.monkeyMuckObserved === opt.value ? 'selected' : ''} ${opt.value === 'confirmed' ? 'danger' : ''} ${opt.value === 'suspected' ? 'warning' : ''}`}
                onClick={() => updateField('hazards.asbestos.monkeyMuckObserved', opt.value)}
                disabled={readOnly}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legacy Materials Section */}
      <div className="hazard-section">
        <div className="section-header">
          <h3>🏚️ Legacy Materials</h3>
          <span className="section-badge">Important</span>
        </div>

        <div className="hazard-field">
          <div className="field-header">
            <label>Legacy Materials Present?</label>
            <button 
              className="helper-btn"
              onClick={() => showHelper('haz.legacy.passivated_steel_rads')}
              disabled={readOnly}
            >
              Ask Helper
            </button>
          </div>
          <div className="chip-options column">
            {[
              { value: ['passivated_steel_radiators'], label: 'Passivated steel radiators' },
              { value: ['other_legacy'], label: 'Other legacy kit' },
              { value: [], label: 'Nothing notable' },
            ].map((opt, idx) => (
              <button
                key={idx}
                className={`chip wide ${JSON.stringify(hazards.legacyMaterials) === JSON.stringify(opt.value) ? 'selected' : ''}`}
                onClick={() => updateField('hazards.legacyMaterials', opt.value)}
                disabled={readOnly}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Access Restrictions Section */}
      <div className="hazard-section">
        <div className="section-header">
          <h3>🚧 Access Restrictions</h3>
          <span className="section-badge">Important</span>
        </div>

        <div className="hazard-field">
          <div className="field-header">
            <label>Any Off-Limits Areas?</label>
            <button 
              className="helper-btn"
              onClick={() => showHelper('haz.access.restrictions')}
              disabled={readOnly}
            >
              Ask Helper
            </button>
          </div>
          <div className="chip-options">
            {[
              { value: ['noted'], label: 'Yes - noted in text' },
              { value: [], label: 'No restrictions' },
            ].map((opt, idx) => (
              <button
                key={idx}
                className={`chip ${JSON.stringify(hazards.accessRestrictions) === JSON.stringify(opt.value) ? 'selected' : ''}`}
                onClick={() => updateField('hazards.accessRestrictions', opt.value)}
                disabled={readOnly}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes for access restrictions */}
        {hazards.accessRestrictions && hazards.accessRestrictions.length > 0 && (
          <div className="hazard-field">
            <div className="field-header">
              <label>Access Restriction Notes</label>
            </div>
            <textarea 
              className="notes-input"
              placeholder="Describe access restrictions..."
              disabled={readOnly}
            />
          </div>
        )}
      </div>

      {/* Helper Question Modal */}
      {currentSlot && (
        <div className="helper-modal-overlay" onClick={() => setCurrentSlot(null)}>
          <div className="helper-modal" onClick={e => e.stopPropagation()}>
            <div className="helper-modal-header">
              <h3>⚠️ Safety Check</h3>
              <button className="close-btn" onClick={() => setCurrentSlot(null)}>×</button>
            </div>
            <p className="helper-question">{currentSlot.question}</p>
            <div className="helper-chips">
              {currentSlot.chipOptions.map((opt, idx) => (
                <button
                  key={idx}
                  className="helper-chip"
                  onClick={() => handleChipSelect(currentSlot, opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {currentSlot.allowSkip && (
              <button 
                className="skip-btn"
                onClick={() => setCurrentSlot(null)}
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HazardsApp;
