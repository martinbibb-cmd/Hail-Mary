/**
 * Auto-Populated Badge Component
 *
 * Visual indicator that shows when a field has been automatically populated
 * by the background transcription processor.
 *
 * Usage:
 * ```tsx
 * <div>
 *   Property Type: {propertyType}
 *   {isAutoPopulated && <AutoPopulatedBadge />}
 * </div>
 * ```
 */

import React from 'react';
import './AutoPopulatedBadge.css';

export interface AutoPopulatedBadgeProps {
  /**
   * Optional tooltip text to explain where the data came from
   */
  tooltip?: string;

  /**
   * Confidence score (0-1) - shows as color indicator
   */
  confidence?: number;

  /**
   * Compact mode for inline display
   */
  compact?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

export const AutoPopulatedBadge: React.FC<AutoPopulatedBadgeProps> = ({
  tooltip = 'Automatically populated from voice transcription',
  confidence = 1.0,
  compact = false,
  className = '',
}) => {
  const confidenceClass = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';

  return (
    <span
      className={`auto-populated-badge ${compact ? 'compact' : ''} confidence-${confidenceClass} ${className}`}
      title={tooltip}
      role="status"
      aria-label={tooltip}
    >
      <svg
        width={compact ? '12' : '16'}
        height={compact ? '12' : '16'}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="badge-icon"
      >
        <path
          d="M8 2L10 6L14 7L11 10L12 14L8 12L4 14L5 10L2 7L6 6L8 2Z"
          fill="currentColor"
        />
      </svg>
      {!compact && <span className="badge-text">Auto</span>}
    </span>
  );
};

export default AutoPopulatedBadge;
