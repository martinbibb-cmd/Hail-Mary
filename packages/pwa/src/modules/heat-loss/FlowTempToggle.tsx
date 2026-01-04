/**
 * FlowTempToggle - Segmented control for flow temperature selection
 *
 * Allows switching between 45°C, 55°C, and 75°C flow temps
 */

import React from 'react';
import type { FlowTemp } from './types';
import './FlowTempToggle.css';

interface FlowTempToggleProps {
  selectedTemp: FlowTemp;
  onTempChange: (temp: FlowTemp) => void;
}

export const FlowTempToggle: React.FC<FlowTempToggleProps> = ({
  selectedTemp,
  onTempChange,
}) => {
  const temps: FlowTemp[] = [45, 55, 75];

  return (
    <div className="flow-temp-toggle">
      <label className="flow-temp-label">Design Flow Temperature:</label>
      <div className="flow-temp-buttons">
        {temps.map((temp) => (
          <button
            key={temp}
            className={`flow-temp-btn ${
              selectedTemp === temp ? 'active' : ''
            }`}
            onClick={() => onTempChange(temp)}
          >
            {temp}°C
          </button>
        ))}
      </div>
    </div>
  );
};
