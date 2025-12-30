/**
 * RoomCard - Room summary card for dashboard grid
 *
 * Shows room name, heat loss, confidence color, and adequacy status
 */

import React from 'react';
import type { RoomSummary, FlowTemp } from './types';
import {
  getConfidenceColorClass,
  getRiskIconLabel,
} from './confidenceUtils';
import './HeatLoss.css';

interface RoomCardProps {
  room: RoomSummary;
  selectedFlowTemp: FlowTemp;
  onRoomClick: () => void;
  onConfidenceClick: () => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  selectedFlowTemp,
  onRoomClick,
  onConfidenceClick,
}) => {
  // Get adequacy for selected flow temp
  const adequacy =
    selectedFlowTemp === 45
      ? room.adequacy_45
      : selectedFlowTemp === 55
      ? room.adequacy_55
      : room.adequacy_75;

  const adequacyLabel =
    adequacy === 'ok'
      ? '✅ OK'
      : adequacy === 'upsize'
      ? '⚠️ Upsize'
      : adequacy === 'major_upsize'
      ? '❌ Major'
      : '❓ Unknown';

  const adequacyClass = `adequacy-${adequacy}`;

  return (
    <div className="room-card" onClick={onRoomClick}>
      {/* Room Header */}
      <div className="room-card-header">
        <h4 className="room-name">{room.room_name}</h4>
        <div
          className={`confidence-chip ${getConfidenceColorClass(
            room.confidence_color
          )}`}
          onClick={(e) => {
            e.stopPropagation();
            onConfidenceClick();
          }}
          title="Click to upgrade confidence"
        >
          {room.confidence_score}%
        </div>
      </div>

      {/* Heat Loss Value */}
      <div className="room-heat-loss">
        <span className="heat-loss-value">
          {(room.heat_loss_w / 1000).toFixed(2)}
        </span>
        <span className="heat-loss-unit">kW</span>
      </div>

      {/* Adequacy Badge */}
      <div className={`room-adequacy ${adequacyClass}`}>
        <span>{adequacyLabel}</span>
        <span className="adequacy-temp">@ {selectedFlowTemp}°C</span>
      </div>

      {/* Risk Icons */}
      {room.risk_icons.length > 0 && (
        <div className="room-risk-icons">
          {room.risk_icons.map((icon) => (
            <span
              key={icon}
              className="risk-icon"
              title={getRiskIconLabel(icon)}
            >
              {icon === 'assumed_wall' && '🧱'}
              {icon === 'unknown_glazing' && '🪟'}
              {icon === 'unheated_adjacent' && '❄️'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
