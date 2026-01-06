/**
 * System Recommendation Card Component
 *
 * Displays heating system recommendations with support for:
 * - Educational exclusion badges (🚫 Not Recommended)
 * - Clear exclusion reasons with visual warnings
 * - Dimmed styling for excluded options
 * - Strikethrough scores for unsuitable systems
 */

import React from 'react';
import type { SystemRecommendation } from '@hail-mary/shared';
import './SystemRecommendationCard.css';

interface SystemRecommendationCardProps {
  recommendation: SystemRecommendation;
  index: number;
}

export const SystemRecommendationCard: React.FC<SystemRecommendationCardProps> = ({
  recommendation,
  index,
}) => {
  const {
    excluded,
    exclusionReason,
    title,
    description,
    estimatedCost,
    annualSavings,
    annualRunningCost,
    benefits,
    considerations,
    grants,
    confidence,
    confidenceLevel,
    rationale,
    originalScore,
  } = recommendation;

  // Option letter (A, B, C, etc.)
  const optionLetter = String.fromCharCode(65 + index);

  return (
    <div className={`system-recommendation-card ${excluded ? 'excluded' : ''}`}>
      {/* Header with badge */}
      <div className="card-header">
        <div className="header-left">
          <span className="option-label">Option {optionLetter}</span>
          <h3 className="system-title">{title}</h3>
        </div>
        <div className="header-right">
          {excluded ? (
            <span className="badge badge-excluded">🚫 Not Recommended</span>
          ) : (
            <span className="badge badge-recommended">✅ Recommended</span>
          )}
        </div>
      </div>

      {/* Exclusion warning banner (only for excluded options) */}
      {excluded && exclusionReason && (
        <div className="exclusion-banner">
          <div className="exclusion-icon">⚠️</div>
          <div className="exclusion-content">
            <h4 className="exclusion-title">Why this isn't suitable:</h4>
            <p className="exclusion-reason">{exclusionReason}</p>
            <p className="exclusion-note">
              <em>We show this option for transparency and education, but it's not recommended for your needs.</em>
            </p>
          </div>
        </div>
      )}

      {/* Description */}
      <p className="system-description">{description}</p>

      {/* Key specs */}
      <div className="specs-grid">
        <div className="spec-item">
          <span className="spec-label">Installation Cost</span>
          <span className="spec-value">
            £{estimatedCost.low.toLocaleString()} - £{estimatedCost.high.toLocaleString()}
          </span>
        </div>
        {annualRunningCost && (
          <div className="spec-item">
            <span className="spec-label">Annual Running Cost</span>
            <span className="spec-value">£{annualRunningCost.toLocaleString()}</span>
          </div>
        )}
        {annualSavings && (
          <div className="spec-item">
            <span className="spec-label">Annual Savings</span>
            <span className="spec-value savings">£{annualSavings.toLocaleString()}</span>
          </div>
        )}
        <div className="spec-item">
          <span className="spec-label">Confidence Score</span>
          <span className={`spec-value confidence-${confidenceLevel}`}>
            {excluded && originalScore ? (
              <>
                <span className="original-score">{originalScore}</span>
                <span className="arrow">→</span>
                <span className="penalty-score">{confidence}</span>
              </>
            ) : (
              <span>{confidence}/100</span>
            )}
          </span>
        </div>
      </div>

      {/* Grants */}
      {grants && grants.length > 0 && (
        <div className="grants-section">
          <div className="grants-icon">💰</div>
          <div className="grants-content">
            <strong>Available Grants:</strong>
            <ul className="grants-list">
              {grants.map((grant, i) => (
                <li key={i}>{grant}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Benefits and Considerations */}
      <div className="pros-cons-grid">
        <div className="pros-section">
          <h4 className="section-title">✅ Benefits</h4>
          <ul className="benefits-list">
            {benefits.map((benefit, i) => (
              <li key={i}>{benefit}</li>
            ))}
          </ul>
        </div>
        <div className="cons-section">
          <h4 className="section-title">⚠️ Considerations</h4>
          <ul className="considerations-list">
            {considerations.map((consideration, i) => (
              <li
                key={i}
                className={consideration.startsWith('❌') ? 'exclusion-item' : ''}
              >
                {consideration}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Rationale */}
      {rationale && rationale.length > 0 && (
        <div className="rationale-section">
          <h4 className="section-title">💡 Why This Option?</h4>
          <ul className="rationale-list">
            {rationale.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
