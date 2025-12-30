/**
 * AuditDrawer - Legal shield + Sarah's fuel
 *
 * Shows audit trail for any field with source, confidence, timestamp, and notes
 */

import React from 'react';
import type { AuditTrailEntry } from '@hail-mary/shared';
import { getSourceBadgeLabel } from './confidenceUtils';
import './HeatLoss.css';

interface AuditDrawerProps {
  surfaceId: string;
  auditEntries: AuditTrailEntry[];
  onClose: () => void;
}

export const AuditDrawer: React.FC<AuditDrawerProps> = ({
  surfaceId,
  auditEntries,
  onClose,
}) => {
  // Filter audit entries for this surface
  const relevantEntries = auditEntries.filter((entry) =>
    entry.field_name.includes(surfaceId)
  );

  const formatTimestamp = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleString();
  };

  const getConfidenceBadgeClass = (score: string) => {
    switch (score) {
      case 'high':
        return 'confidence-green';
      case 'medium':
        return 'confidence-amber';
      case 'low':
        return 'confidence-red';
      default:
        return 'confidence-red';
    }
  };

  return (
    <div className="audit-drawer-overlay" onClick={onClose}>
      <div className="audit-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="audit-drawer-header">
          <h3>Audit Trail</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="audit-drawer-content">
          {relevantEntries.length === 0 && (
            <div className="audit-empty">
              <p>No audit trail entries for this surface.</p>
              <p className="audit-hint">
                Audit entries are automatically generated when data is entered
                or measured.
              </p>
            </div>
          )}

          {relevantEntries.map((entry, index) => (
            <div key={index} className="audit-entry">
              <div className="audit-entry-header">
                <span className="audit-field-name">{entry.field_name}</span>
                <span
                  className={`audit-confidence ${getConfidenceBadgeClass(
                    entry.confidence_score
                  )}`}
                >
                  {entry.confidence_score}
                </span>
              </div>

              <div className="audit-entry-value">
                <strong>Value:</strong>{' '}
                {typeof entry.value === 'number'
                  ? entry.value.toFixed(2)
                  : entry.value}
              </div>

              <div className="audit-entry-source">
                <strong>Source:</strong>{' '}
                <span className={`source-badge ${entry.source_type}`}>
                  {getSourceBadgeLabel(entry.source_type)}
                </span>
              </div>

              <div className="audit-entry-timestamp">
                <strong>Timestamp:</strong> {formatTimestamp(entry.timestamp)}
              </div>

              {entry.notes && (
                <div className="audit-entry-notes">
                  <strong>Notes:</strong> {entry.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="audit-drawer-footer">
          <p className="audit-footer-note">
            This audit trail provides transparency for every assumption and
            measurement, ensuring you can defend your calculations.
          </p>
        </div>
      </div>
    </div>
  );
};
