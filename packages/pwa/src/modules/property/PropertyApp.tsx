/**
 * PropertyApp - Core Property Module
 * 
 * Phase: 1 (Live)
 * 
 * Purpose:
 * - View & tweak HomeProfile: build era, property type, loft, glazing, occupancy
 * - Show what's been inferred from transcript
 * - Ask helper questions for property/fabric
 */

import React, { useState, useEffect } from 'react';
import type {
  SystemSpecDraft,
  SurveySlot,
} from '@hail-mary/shared';
import { useLeadStore } from '../../stores/leadStore';
import { clearAutoFilledField } from '../../services/visitCaptureOrchestrator';
import './PropertyApp.css';

interface PropertyAppProps {
  /** Current spec draft (if available) - DEPRECATED, use Lead store */
  specDraft?: SystemSpecDraft;
  /** Callback when spec is updated - DEPRECATED, use Lead store */
  onSpecUpdate?: (path: string, value: unknown) => void;
  /** Whether in read-only mode */
  readOnly?: boolean;
}

export const PropertyApp: React.FC<PropertyAppProps> = ({
  readOnly = false,
}) => {
  const [currentSlot, setCurrentSlot] = useState<SurveySlot | null>(null);

  // Connect to Lead store
  const currentLeadId = useLeadStore((state) => state.currentLeadId);
  const leadById = useLeadStore((state) => state.leadById);
  const updateLeadData = useLeadStore((state) => state.updateLeadData);

  const currentLead = currentLeadId ? leadById[currentLeadId] : null;

  // Extract property-related fields from lead
  const [localPropertyData, setLocalPropertyData] = useState({
    propertyType: currentLead?.propertyType || '',
    buildYearApprox: '',
    glazingType: '',
    loftInsulationDepthMm: '',
    homeAllDay: null as boolean | null,
    hotWaterProfile: '',
  });

  // Sync local state with lead when it changes
  useEffect(() => {
    if (currentLead) {
      setLocalPropertyData({
        propertyType: currentLead.propertyType || '',
        buildYearApprox: '',
        glazingType: '',
        loftInsulationDepthMm: '',
        homeAllDay: null,
        hotWaterProfile: '',
      });
    }
  }, [currentLead]);

  const property = localPropertyData;
  const occupancy = { homeAllDay: localPropertyData.homeAllDay, hotWaterProfile: localPropertyData.hotWaterProfile };

  // Helper to update a field - wired to Lead store
  const updateField = (fieldName: string, value: unknown) => {
    if (readOnly || !currentLeadId) return;

    // Update local state immediately for instant feedback
    setLocalPropertyData(prev => ({
      ...prev,
      [fieldName]: value,
    }));

    // Update Lead store (this triggers save queue + marks dirty)
    updateLeadData(currentLeadId, {
      propertyType: fieldName === 'propertyType' ? String(value) : currentLead?.propertyType,
      // Additional property fields can be added here as they're added to Lead schema
    });

    // Mark field as manual (prevents auto-extraction from overwriting)
    clearAutoFilledField(currentLeadId, fieldName);

    // Store manual field marker in localStorage
    const manualFieldsKey = `lead-${currentLeadId}-manual-fields`;
    const existingManual = localStorage.getItem(manualFieldsKey);
    const manualFields = existingManual ? JSON.parse(existingManual) : [];

    if (!manualFields.includes(fieldName)) {
      manualFields.push(fieldName);
      localStorage.setItem(manualFieldsKey, JSON.stringify(manualFields));
    }
  };

  // Get display text for a value
  const getDisplayText = (value: unknown): string => {
    if (value === null || value === undefined) return 'Not set';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  // Show helper for a specific slot (placeholder - to be connected to survey helper)
  const showHelper = (_slotId: string) => {
    // TODO: Connect to SurveyHelper service
    console.log('Helper requested for:', _slotId);
  };

  // Handle chip selection
  const handleChipSelect = (slot: SurveySlot, value: unknown) => {
    updateField(slot.path, value);
    setCurrentSlot(null);
  };

  return (
    <div className="property-app">
      <div className="property-app-header">
        <h2>🏠 Property Details</h2>
        <span className="module-badge live">Phase 1 - Live</span>
      </div>

      {/* Summary Card */}
      <div className="property-summary-card">
        <div className="summary-row">
          <span className="summary-label">Type:</span>
          <span className="summary-value">
            {property.propertyType || 'Unknown'} 
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Era:</span>
          <span className="summary-value">
            {property.buildYearApprox || 'Unknown'}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Glazing:</span>
          <span className="summary-value">
            {property.glazingType || 'Unknown'}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Loft:</span>
          <span className="summary-value">
            {property.loftInsulationDepthMm ? `~${property.loftInsulationDepthMm}mm` : 'Unknown'}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Home all day:</span>
          <span className="summary-value">
            {getDisplayText(occupancy.homeAllDay)}
          </span>
        </div>
      </div>

      {/* Editable Fields */}
      <div className="property-sections">
        {/* Property Type */}
        <div className="property-field">
          <div className="field-header">
            <label>Property Type</label>
            <button 
              className="helper-btn"
              onClick={() => showHelper('core.property.type')}
              disabled={readOnly}
            >
              Ask Helper
            </button>
          </div>
          <div className="chip-options">
            {['house', 'flat', 'bungalow', 'other'].map(opt => (
              <button
                key={opt}
                className={`chip ${property.propertyType === opt ? 'selected' : ''}`}
                onClick={() => updateField('propertyType', opt)}
                disabled={readOnly}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Build Era */}
        <div className="property-field">
          <div className="field-header">
            <label>Build Era</label>
            <button 
              className="helper-btn"
              onClick={() => showHelper('core.property.build_era')}
              disabled={readOnly}
            >
              Ask Helper
            </button>
          </div>
          <div className="chip-options">
            {['pre-1930', '1930-1950', '1950-1970', '1970-1990', '1990-2010', '2010+'].map(opt => (
              <button
                key={opt}
                className={`chip ${property.buildYearApprox === opt ? 'selected' : ''}`}
                onClick={() => updateField('buildYearApprox', opt)}
                disabled={readOnly}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Glazing */}
        <div className="property-field">
          <div className="field-header">
            <label>Glazing Type</label>
            <button 
              className="helper-btn"
              onClick={() => showHelper('core.fabric.glazing')}
              disabled={readOnly}
            >
              Ask Helper
            </button>
          </div>
          <div className="chip-options">
            {['single', 'double', 'triple', 'mixed'].map(opt => (
              <button
                key={opt}
                className={`chip ${property.glazingType === opt ? 'selected' : ''}`}
                onClick={() => updateField('glazingType', opt)}
                disabled={readOnly}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Loft Insulation */}
        <div className="property-field">
          <div className="field-header">
            <label>Loft Insulation</label>
            <button 
              className="helper-btn"
              onClick={() => showHelper('core.fabric.loft_insulation')}
              disabled={readOnly}
            >
              Ask Helper
            </button>
          </div>
          <div className="chip-options">
            {[
              { label: 'None/little', value: '<50' },
              { label: '50-149mm', value: '50-149' },
              { label: '150-249mm', value: '150-249' },
              { label: '250mm+', value: '250+' },
              { label: 'No loft', value: null },
            ].map(opt => (
              <button
                key={opt.label}
                className={`chip ${property.loftInsulationDepthMm === opt.value ? 'selected' : ''}`}
                onClick={() => updateField('loftInsulationDepthMm', opt.value)}
                disabled={readOnly}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Occupancy */}
        <div className="property-field">
          <div className="field-header">
            <label>Home All Day?</label>
            <button 
              className="helper-btn"
              onClick={() => showHelper('core.lifestyle.occupancy')}
              disabled={readOnly}
            >
              Ask Helper
            </button>
          </div>
          <div className="chip-options">
            {[
              { label: 'Yes, most days', value: true },
              { label: 'Evenings/weekends only', value: false },
              { label: 'Varies', value: null },
            ].map(opt => (
              <button
                key={String(opt.value)}
                className={`chip ${occupancy.homeAllDay === opt.value ? 'selected' : ''}`}
                onClick={() => updateField('homeAllDay', opt.value)}
                disabled={readOnly}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hot Water Profile */}
        <div className="property-field">
          <div className="field-header">
            <label>Hot Water Usage</label>
            <button 
              className="helper-btn"
              onClick={() => showHelper('core.lifestyle.hot_water_profile')}
              disabled={readOnly}
            >
              Ask Helper
            </button>
          </div>
          <div className="chip-options">
            {['low', 'medium', 'high'].map(opt => (
              <button
                key={opt}
                className={`chip ${occupancy.hotWaterProfile === opt ? 'selected' : ''}`}
                onClick={() => updateField('hotWaterProfile', opt)}
                disabled={readOnly}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>
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

export default PropertyApp;
