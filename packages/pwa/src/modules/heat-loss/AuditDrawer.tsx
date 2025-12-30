/**
 * AuditDrawer (v2)
 *
 * Opens to latest change + copy snippet functionality
 */

import React, { useState } from 'react';
import type { AuditTrailEntry } from '@hail-mary/shared';
import { getSourceBadgeLabel } from './confidence';
import './bottomSheet.css';

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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Filter audit entries for this surface
  const relevantEntries = auditEntries.filter((entry) =>
    entry.field_name.includes(surfaceId)
  );

  // Sort by timestamp descending (latest first)
  const sortedEntries = [...relevantEntries].sort((a, b) => {
    const dateA = typeof a.timestamp === 'string' ? new Date(a.timestamp) : a.timestamp;
    const dateB = typeof b.timestamp === 'string' ? new Date(b.timestamp) : b.timestamp;
    return dateB.getTime() - dateA.getTime();
  });

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

  const copyAuditSnippet = (entry: AuditTrailEntry, index: number) => {
    const snippet = [
      `Field: ${entry.field_name}`,
      `Value: ${typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}`,
      `Source: ${getSourceBadgeLabel(entry.source_type)}`,
      `Confidence: ${entry.confidence_score}`,
      `Timestamp: ${formatTimestamp(entry.timestamp)}`,
      entry.notes ? `Notes: ${entry.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(snippet).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
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
          {sortedEntries.length === 0 && (
            <div className="audit-empty">
              <p>No audit trail entries for this surface.</p>
              <p className="audit-hint">
                Audit entries are automatically generated when data is entered
                or measured.
              </p>
            </div>
          )}

          {sortedEntries.length > 0 && (
            <div className="audit-latest-badge">
              📌 Latest entry shown first
            </div>
          )}

          {sortedEntries.map((entry, index) => (
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

              <div className="audit-entry-actions">
                <button
                  className="copy-snippet-btn"
                  onClick={() => copyAuditSnippet(entry, index)}
                >
                  {copiedIndex === index ? '✅ Copied!' : '📋 Copy Snippet'}
                </button>
              </div>
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
