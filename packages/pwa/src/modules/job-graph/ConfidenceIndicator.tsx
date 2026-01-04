/**
 * Confidence Indicator
 *
 * Visual indicator for confidence level (0-100)
 * - 0-30: Low confidence (red)
 * - 31-70: Medium confidence (amber)
 * - 71-100: High confidence (green)
 */

import type { Confidence } from '@hail-mary/shared';

interface ConfidenceIndicatorProps {
  confidence: Confidence;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export function ConfidenceIndicator({
  confidence,
  size = 'medium',
  showLabel = true,
}: ConfidenceIndicatorProps) {
  const getConfidenceLevel = (conf: number): 'low' | 'medium' | 'high' => {
    if (conf < 31) return 'low';
    if (conf < 71) return 'medium';
    return 'high';
  };

  const getConfidenceColor = (level: 'low' | 'medium' | 'high'): string => {
    switch (level) {
      case 'low':
        return '#dc2626'; // red
      case 'medium':
        return '#f59e0b'; // amber
      case 'high':
        return '#16a34a'; // green
    }
  };

  const level = getConfidenceLevel(confidence);
  const color = getConfidenceColor(level);

  const sizeMap = {
    small: { width: 60, height: 60, strokeWidth: 4 },
    medium: { width: 80, height: 80, strokeWidth: 6 },
    large: { width: 120, height: 120, strokeWidth: 8 },
  };

  const { width, height, strokeWidth } = sizeMap[size];
  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (confidence / 100) * circumference;

  return (
    <div className={`confidence-indicator size-${size}`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background circle */}
        <circle
          cx={width / 2}
          cy={height / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={width / 2}
          cy={height / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${width / 2} ${height / 2})`}
        />
        {/* Percentage text */}
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size === 'small' ? 16 : size === 'medium' ? 20 : 28}
          fontWeight="bold"
          fill={color}
        >
          {confidence}%
        </text>
      </svg>
      {showLabel && (
        <div className="confidence-label" style={{ color }}>
          {level.charAt(0).toUpperCase() + level.slice(1)} Confidence
        </div>
      )}
    </div>
  );
}
