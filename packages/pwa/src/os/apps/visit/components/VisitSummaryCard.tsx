/**
 * Visit Summary Card
 *
 * Displays generated visit summary with sections for:
 * - Overview
 * - Key Findings
 * - Work Required
 * - Next Actions
 */

import React from 'react';
import type { VisitSummary } from '../../../../utils/visitSummaryGenerator';
import './VisitSummaryCard.css';

interface VisitSummaryCardProps {
  summary: VisitSummary | null;
  onGenerate?: () => void;
  isGenerating?: boolean;
}

export const VisitSummaryCard: React.FC<VisitSummaryCardProps> = ({
  summary,
  onGenerate,
  isGenerating = false,
}) => {
  if (!summary) {
    return (
      <div className="visit-summary-card visit-summary-empty">
        <div className="summary-empty-state">
          <div className="summary-empty-icon">📋</div>
          <h3>No Summary Yet</h3>
          <p>Generate a summary after recording visit notes</p>
          {onGenerate && (
            <button
              className="btn-generate-summary"
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Summary'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="visit-summary-card">
      <div className="summary-header">
        <h3>📋 Visit Summary</h3>
        <span className="summary-timestamp">
          {new Date(summary.generatedAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        {onGenerate && (
          <button
            className="btn-regenerate"
            onClick={onGenerate}
            disabled={isGenerating}
            title="Regenerate summary"
          >
            🔄
          </button>
        )}
      </div>

      <div className="summary-body">
        {/* Overview */}
        <div className="summary-section">
          <h4>Overview</h4>
          <p className="summary-overview">{summary.overview}</p>
        </div>

        {/* Key Findings */}
        {summary.keyFindings.length > 0 && (
          <div className="summary-section">
            <h4>Key Findings</h4>
            <ul className="summary-list">
              {summary.keyFindings.map((finding, idx) => (
                <li key={idx}>{finding}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Work Required */}
        {summary.workRequired.length > 0 && (
          <div className="summary-section">
            <h4>Work Required</h4>
            <ul className="summary-list summary-work-list">
              {summary.workRequired.map((work, idx) => (
                <li key={idx}>{work}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Next Actions */}
        {summary.nextActions.length > 0 && (
          <div className="summary-section">
            <h4>Next Actions</h4>
            <ul className="summary-list summary-actions-list">
              {summary.nextActions.map((action, idx) => (
                <li key={idx}>{action}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
