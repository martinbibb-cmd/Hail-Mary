import React from 'react';
import './KeyDetailsForm.css';

export interface KeyDetails {
  propertyType?: string;
  occupancy?: string;
  bedrooms?: number;
  currentSystem?: string;
  boilerAge?: number;
  issues?: string[];
  proposedSystem?: string;
  [key: string]: any;
}

interface KeyDetailsFormProps {
  details: KeyDetails;
  onChange?: (details: KeyDetails) => void;
  autoFilledFields?: string[];
}

/**
 * KeyDetailsForm - Structured facts form (right panel)
 * 
 * Shows key property and system details that get populated from Rocky extraction.
 * Fields that were auto-filled from transcript are visually indicated.
 */
export const KeyDetailsForm: React.FC<KeyDetailsFormProps> = ({
  details,
  onChange,
  autoFilledFields = [],
}) => {
  const handleChange = (field: string, value: any) => {
    if (onChange) {
      onChange({ ...details, [field]: value });
    }
  };

  const isAutoFilled = (field: string) => autoFilledFields.includes(field);

  return (
    <div className="key-details-form">
      <div className="key-details-header">
        <h3>📋 Key Details</h3>
      </div>

      <div className="key-details-content">
        <div className="form-section">
          <h4>Property</h4>
          
          <div className="form-field">
            <label htmlFor="propertyType">
              Property Type
              {isAutoFilled('propertyType') && <span className="auto-badge">Auto</span>}
            </label>
            <select
              id="propertyType"
              value={details.propertyType || ''}
              onChange={(e) => handleChange('propertyType', e.target.value)}
              className={isAutoFilled('propertyType') ? 'auto-filled' : ''}
            >
              <option value="">Select...</option>
              <option value="house">House</option>
              <option value="flat">Flat</option>
              <option value="bungalow">Bungalow</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="occupancy">
              Occupancy
              {isAutoFilled('occupancy') && <span className="auto-badge">Auto</span>}
            </label>
            <input
              id="occupancy"
              type="text"
              value={details.occupancy || ''}
              onChange={(e) => handleChange('occupancy', e.target.value)}
              placeholder="e.g., Family with 2 children"
              className={isAutoFilled('occupancy') ? 'auto-filled' : ''}
            />
          </div>

          <div className="form-field">
            <label htmlFor="bedrooms">
              Bedrooms
              {isAutoFilled('bedrooms') && <span className="auto-badge">Auto</span>}
            </label>
            <input
              id="bedrooms"
              type="number"
              value={details.bedrooms || ''}
              onChange={(e) => handleChange('bedrooms', parseInt(e.target.value) || undefined)}
              placeholder="0"
              min="0"
              className={isAutoFilled('bedrooms') ? 'auto-filled' : ''}
            />
          </div>
        </div>

        <div className="form-section">
          <h4>Current System</h4>
          
          <div className="form-field">
            <label htmlFor="currentSystem">
              System Type
              {isAutoFilled('currentSystem') && <span className="auto-badge">Auto</span>}
            </label>
            <input
              id="currentSystem"
              type="text"
              value={details.currentSystem || ''}
              onChange={(e) => handleChange('currentSystem', e.target.value)}
              placeholder="e.g., Combi boiler"
              className={isAutoFilled('currentSystem') ? 'auto-filled' : ''}
            />
          </div>

          <div className="form-field">
            <label htmlFor="boilerAge">
              Boiler Age (years)
              {isAutoFilled('boilerAge') && <span className="auto-badge">Auto</span>}
            </label>
            <input
              id="boilerAge"
              type="number"
              value={details.boilerAge || ''}
              onChange={(e) => handleChange('boilerAge', parseInt(e.target.value) || undefined)}
              placeholder="0"
              min="0"
              className={isAutoFilled('boilerAge') ? 'auto-filled' : ''}
            />
          </div>

          <div className="form-field">
            <label htmlFor="issues">
              Issues / Concerns
              {isAutoFilled('issues') && <span className="auto-badge">Auto</span>}
            </label>
            <textarea
              id="issues"
              value={details.issues?.join('\n') || ''}
              onChange={(e) => handleChange('issues', e.target.value.split('\n').filter(line => line.trim()))}
              placeholder="List any issues or concerns..."
              rows={3}
              className={isAutoFilled('issues') ? 'auto-filled' : ''}
            />
          </div>
        </div>

        <div className="form-section">
          <h4>Proposed System</h4>
          
          <div className="form-field">
            <label htmlFor="proposedSystem">
              Proposed System
              {isAutoFilled('proposedSystem') && <span className="auto-badge">Auto</span>}
            </label>
            <input
              id="proposedSystem"
              type="text"
              value={details.proposedSystem || ''}
              onChange={(e) => handleChange('proposedSystem', e.target.value)}
              placeholder="e.g., New combi boiler"
              className={isAutoFilled('proposedSystem') ? 'auto-filled' : ''}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
