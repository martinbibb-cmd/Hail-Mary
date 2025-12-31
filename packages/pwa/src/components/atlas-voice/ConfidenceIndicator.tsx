/**
 * Confidence Indicator Component
 *
 * Visual indicator showing confidence level for extracted entities.
 *
 * Displays:
 * - Icon (✔️, ❓, ⚠️)
 * - Color coding (green, yellow, red)
 * - Percentage (optional)
 *
 * Usage:
 * ```tsx
 * <ConfidenceIndicator confidence={0.95} showPercentage />
 * <ConfidenceIndicator confidence={0.65} />
 * ```
 */

import React from 'react';
import type { ConfidenceLevel } from '@hail-mary/shared/atlas-voice';
import './ConfidenceIndicator.css';

export interface ConfidenceIndicatorProps {
  /** Confidence score 0.0-1.0 */
  confidence: number;

  /** Confidence level category */
  confidenceLevel: ConfidenceLevel;

  /** Show percentage number */
  showPercentage?: boolean;

  /** Compact mode (smaller) */
  compact?: boolean;

  /** Custom className */
  className?: string;
}

/**
 * Get icon for confidence level
 */
function getConfidenceIcon(confidenceLevel: ConfidenceLevel): string {
  switch (confidenceLevel) {
    case 'very_high':
    case 'high':
      return '✔️';
    case 'medium':
      return '❓';
    case 'low':
    case 'very_low':
      return '⚠️';
  }
}

/**
 * Get descriptive text for confidence level
 */
function getConfidenceText(confidenceLevel: ConfidenceLevel): string {
  switch (confidenceLevel) {
    case 'very_high':
      return 'Very High Confidence';
    case 'high':
      return 'High Confidence';
    case 'medium':
      return 'Medium Confidence';
    case 'low':
      return 'Low Confidence';
    case 'very_low':
      return 'Very Low Confidence';
  }
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  confidenceLevel,
  showPercentage = false,
  compact = false,
  className = '',
}) => {
  const icon = getConfidenceIcon(confidenceLevel);
  const text = getConfidenceText(confidenceLevel);
  const percentage = Math.round(confidence * 100);

  return (
    <span
      className={`confidence-indicator confidence-${confidenceLevel} ${compact ? 'compact' : ''} ${className}`}
      title={`${text} (${percentage}%)`}
      role="status"
      aria-label={`${text}: ${percentage}%`}
    >
      <span className="confidence-icon">{icon}</span>
      {showPercentage && !compact && <span className="confidence-percentage">{percentage}%</span>}
    </span>
  );
};

export default ConfidenceIndicator;
