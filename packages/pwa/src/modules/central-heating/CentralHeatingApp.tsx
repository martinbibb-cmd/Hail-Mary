/**
 * CentralHeatingApp - Boiler/CH Survey Module
 * 
 * Phase: 1 (Live)
 * 
 * Purpose:
 * - Be the best boiler/CH survey UI in the UK
 * - Show existing boiler, flue, pipework, emitters, controls
 * - Context-aware helper questions
 */

import React, { useState } from 'react';
import type { 
  SystemSpecDraft,
  SurveySlot,
} from '@hail-mary/shared';
import './CentralHeatingApp.css';

interface CentralHeatingAppProps {
  specDraft?: SystemSpecDraft;
  onSpecUpdate?: (path: string, value: unknown) => void;
  readOnly?: boolean;
}

const emptySpec: SystemSpecDraft = {
  activeModules: ['central_heating'],
  centralHeating: {},
};

export const CentralHeatingApp: React.FC<CentralHeatingAppProps> = ({
  specDraft = emptySpec,
  onSpecUpdate,
  readOnly = false,
}) => {
  const [currentSlot, setCurrentSlot] = useState<SurveySlot | null>(null);
  const [activePanel, setActivePanel] = useState<string>('boiler');

  const ch = specDraft.centralHeating || {};
  const heatSource = ch.existingHeatSource || {};
  const emitters = ch.emitters || {};
  const waterQuality = ch.waterQuality || {};

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

  return (
    <div className="ch-app">
      <div className="ch-app-header">
        <h2>🔥 Central Heating</h2>
        <span className="module-badge live">Phase 1 - Live</span>
      </div>

      {/* Current Boiler Panel - Top Row */}
      <div className="ch-boiler-panel">
        <div className="panel-header">
          <h3>Current Boiler</h3>
        </div>
        <div className="boiler-summary">
          <div className="summary-item">
            <span className="label">Type</span>
            <span className="value">{heatSource.systemType || '-'}</span>
          </div>
          <div className="summary-item">
            <span className="label">Fuel</span>
            <span className="value">{heatSource.boilerFuel || '-'}</span>
          </div>
          <div className="summary-item">
            <span className="label">Age</span>
            <span className="value">{heatSource.boilerApproxAgeYears || '-'}</span>
          </div>
          <div className="summary-item">
            <span className="label">Condition</span>
            <span className={`value condition-${heatSource.generalCondition || 'unknown'}`}>
              {heatSource.generalCondition || '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="ch-tabs">
        <button 
          className={`tab ${activePanel === 'boiler' ? 'active' : ''}`}
          onClick={() => setActivePanel('boiler')}
        >
          Boiler & Flue
        </button>
        <button 
          className={`tab ${activePanel === 'pipework' ? 'active' : ''}`}
          onClick={() => setActivePanel('pipework')}
        >
          Pipework
        </button>
        <button 
          className={`tab ${activePanel === 'water' ? 'active' : ''}`}
          onClick={() => setActivePanel('water')}
        >
          Water Quality
        </button>
        <button 
          className={`tab ${activePanel === 'controls' ? 'active' : ''}`}
          onClick={() => setActivePanel('controls')}
        >
          Controls
        </button>
      </div>

      {/* Panel Content */}
      <div className="ch-panel-content">
        {/* Boiler & Flue Panel */}
        {activePanel === 'boiler' && (
          <div className="panel-section">
            {/* System Type */}
            <div className="ch-field">
              <div className="field-header">
                <label>System Type</label>
                <button 
                  className="helper-btn"
                  onClick={() => showHelper('ch.system.type')}
                  disabled={readOnly}
                >
                  Ask Helper
                </button>
              </div>
              <div className="chip-options">
                {['combi', 'storage_combi', 'system', 'regular', 'back_boiler', 'other'].map(opt => (
                  <button
                    key={opt}
                    className={`chip ${heatSource.systemType === opt ? 'selected' : ''}`}
                    onClick={() => updateField('centralHeating.existingHeatSource.systemType', opt)}
                    disabled={readOnly}
                  >
                    {opt.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Fuel Type */}
            <div className="ch-field">
              <div className="field-header">
                <label>Fuel Type</label>
                <button 
                  className="helper-btn"
                  onClick={() => showHelper('ch.system.fuel')}
                  disabled={readOnly}
                >
                  Ask Helper
                </button>
              </div>
              <div className="chip-options">
                {['mains_gas', 'lpg', 'oil', 'electric', 'other'].map(opt => (
                  <button
                    key={opt}
                    className={`chip ${heatSource.boilerFuel === opt ? 'selected' : ''}`}
                    onClick={() => updateField('centralHeating.existingHeatSource.boilerFuel', opt)}
                    disabled={readOnly}
                  >
                    {opt.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Boiler Age */}
            <div className="ch-field">
              <div className="field-header">
                <label>Boiler Age</label>
                <button 
                  className="helper-btn"
                  onClick={() => showHelper('ch.boiler.age_band')}
                  disabled={readOnly}
                >
                  Ask Helper
                </button>
              </div>
              <div className="chip-options">
                {['<10', '10-20', '20-30', '30-40', '40+'].map(opt => (
                  <button
                    key={opt}
                    className={`chip ${heatSource.boilerApproxAgeYears === opt ? 'selected' : ''}`}
                    onClick={() => updateField('centralHeating.existingHeatSource.boilerApproxAgeYears', opt)}
                    disabled={readOnly}
                  >
                    {opt} years
                  </button>
                ))}
              </div>
            </div>

            {/* Condition */}
            <div className="ch-field">
              <div className="field-header">
                <label>Condition</label>
                <button 
                  className="helper-btn"
                  onClick={() => showHelper('ch.boiler.condition')}
                  disabled={readOnly}
                >
                  Ask Helper
                </button>
              </div>
              <div className="chip-options">
                {['good', 'tired', 'poor', 'condemned'].map(opt => (
                  <button
                    key={opt}
                    className={`chip condition-${opt} ${heatSource.generalCondition === opt ? 'selected' : ''}`}
                    onClick={() => updateField('centralHeating.existingHeatSource.generalCondition', opt)}
                    disabled={readOnly}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Flue Category */}
            <div className="ch-field">
              <div className="field-header">
                <label>Flue Type</label>
                <button 
                  className="helper-btn"
                  onClick={() => showHelper('ch.flue.category')}
                  disabled={readOnly}
                >
                  Ask Helper
                </button>
              </div>
              <div className="chip-options">
                {['fanned_round', 'fanned_square', 'balanced', 'open_flue', 'back_boiler', 'unknown'].map(opt => (
                  <button
                    key={opt}
                    className={`chip ${heatSource.flueCategory === opt ? 'selected' : ''}`}
                    onClick={() => updateField('centralHeating.existingHeatSource.flueCategory', opt)}
                    disabled={readOnly}
                  >
                    {opt.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Flue Route */}
            <div className="ch-field">
              <div className="field-header">
                <label>Flue Route</label>
                <button 
                  className="helper-btn"
                  onClick={() => showHelper('ch.flue.route')}
                  disabled={readOnly}
                >
                  Ask Helper
                </button>
              </div>
              <div className="chip-options">
                {['horizontal_wall', 'vertical_pitched_roof', 'vertical_flat_roof', 'ridge_tile_vent', 'into_chimney', 'other'].map(opt => (
                  <button
                    key={opt}
                    className={`chip ${heatSource.flueRoute === opt ? 'selected' : ''}`}
                    onClick={() => updateField('centralHeating.existingHeatSource.flueRoute', opt)}
                    disabled={readOnly}
                  >
                    {opt.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Pipework Panel */}
        {activePanel === 'pipework' && (
          <div className="panel-section">
            <div className="ch-field">
              <div className="field-header">
                <label>Pipework Type</label>
                <button 
                  className="helper-btn"
                  onClick={() => showHelper('ch.pipework.type')}
                  disabled={readOnly}
                >
                  Ask Helper
                </button>
              </div>
              <div className="chip-options column">
                {[
                  { value: 'microbore', label: 'Mostly microbore (8-10mm)' },
                  { value: 'mixed', label: 'Mixed microbore and 15mm+' },
                  { value: 'standard_two_pipe', label: 'Mostly 15mm+ two-pipe' },
                  { value: 'single_pipe_present', label: 'Some single-pipe loops' },
                  { value: 'unknown', label: 'Not sure' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`chip wide ${emitters.microborePresence === opt.value ? 'selected' : ''}`}
                    onClick={() => updateField('centralHeating.emitters.microborePresence', opt.value)}
                    disabled={readOnly}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ch-field">
              <div className="field-header">
                <label>Pipework Notes</label>
              </div>
              <textarea 
                className="notes-input"
                value={emitters.pipeworkSummary || ''}
                onChange={(e) => updateField('centralHeating.emitters.pipeworkSummary', e.target.value)}
                placeholder="Any notable pipework details..."
                disabled={readOnly}
              />
            </div>
          </div>
        )}

        {/* Water Quality Panel */}
        {activePanel === 'water' && (
          <div className="panel-section">
            <div className="ch-field">
              <div className="field-header">
                <label>Sludge Level</label>
                <button 
                  className="helper-btn"
                  onClick={() => showHelper('ch.water.sludge_level')}
                  disabled={readOnly}
                >
                  Ask Helper
                </button>
              </div>
              <div className="chip-options">
                {['low', 'medium', 'high', 'unknown'].map(opt => (
                  <button
                    key={opt}
                    className={`chip sludge-${opt} ${waterQuality.sludgeSeverity === opt ? 'selected' : ''}`}
                    onClick={() => updateField('centralHeating.waterQuality.sludgeSeverity', opt)}
                    disabled={readOnly}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="ch-field">
              <div className="field-header">
                <label>Evidence of Sludge?</label>
              </div>
              <div className="chip-options">
                {[
                  { value: true, label: 'Yes' },
                  { value: false, label: 'No' },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    className={`chip ${waterQuality.evidenceOfSludge === opt.value ? 'selected' : ''}`}
                    onClick={() => updateField('centralHeating.waterQuality.evidenceOfSludge', opt.value)}
                    disabled={readOnly}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ch-field">
              <div className="field-header">
                <label>Magnetic Filter Fitted?</label>
                <button 
                  className="helper-btn"
                  onClick={() => showHelper('ch.water.filter_present')}
                  disabled={readOnly}
                >
                  Ask Helper
                </button>
              </div>
              <div className="chip-options">
                {[
                  { value: true, label: 'Yes' },
                  { value: false, label: 'No' },
                  { value: null, label: 'Not sure' },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    className={`chip ${waterQuality.filterFitted === opt.value ? 'selected' : ''}`}
                    onClick={() => updateField('centralHeating.waterQuality.filterFitted', opt.value)}
                    disabled={readOnly}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Controls Panel */}
        {activePanel === 'controls' && (
          <div className="panel-section">
            <div className="ch-field">
              <div className="field-header">
                <label>Control Level</label>
                <button 
                  className="helper-btn"
                  onClick={() => showHelper('ch.controls.level')}
                  disabled={readOnly}
                >
                  Ask Helper
                </button>
              </div>
              <div className="chip-options column">
                {[
                  { value: 'basic', label: 'Basic timer + boiler stat' },
                  { value: 'programmable', label: 'Programmable room stat' },
                  { value: 'smart', label: 'Smart controls (Hive/Nest/etc.)' },
                  { value: 'none', label: 'No real controls' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`chip wide ${ch.controlsSummary === opt.value ? 'selected' : ''}`}
                    onClick={() => updateField('centralHeating.controlsSummary', opt.value)}
                    disabled={readOnly}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Helper Question Modal */}
      {currentSlot && (
        <div className="helper-modal-overlay" onClick={() => setCurrentSlot(null)}>
          <div className="helper-modal" onClick={e => e.stopPropagation()}>
            <div className="helper-modal-header">
              <h3>💡 Helper Question</h3>
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

export default CentralHeatingApp;
