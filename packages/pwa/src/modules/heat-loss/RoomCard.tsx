/**
 * RoomCard (v2)
 *
 * Room summary card with risk flags and instant adequacy toggle
 */

import React from 'react';
import type { RoomSummary, FlowTemp } from './types';
import {
  getConfidenceColorClass,
  getRiskFlagLabel,
  getRiskFlagIcon,
} from './confidence';
import './RoomCard.css';

interface RoomCardProps {
  room: RoomSummary;
  selectedFlowTemp: FlowTemp;
  onRoomClick: () => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  selectedFlowTemp,
  onRoomClick,
}) => {
  // Get adequacy for selected flow temp (instant - no API call)
  const adequacy =
    selectedFlowTemp === 45
      ? room.adequacy_at_all_temps.at_45c
      : selectedFlowTemp === 55
      ? room.adequacy_at_all_temps.at_55c
      : room.adequacy_at_all_temps.at_75c;

  const getAdequacyDisplay = () => {
    if (!adequacy) return { label: '❓ Unknown', className: 'adequacy-unknown' };

    if (adequacy.adequate) {
      return { label: '✅ OK', className: 'adequacy-ok' };
    }

    // Shortfall > 500W is major
    if (adequacy.shortfall_w > 500) {
      return { label: '❌ Major', className: 'adequacy-major_upsize' };
    }

    return { label: '⚠️ Upsize', className: 'adequacy-upsize' };
  };

  const { label: adequacyLabel, className: adequacyClass } = getAdequacyDisplay();

  return (
    <div className="room-card" onClick={onRoomClick}>
      {/* Room Header */}
      <div className="room-card-header">
        <h4 className="room-name">{room.room_name}</h4>
        <div
          className={`confidence-chip ${getConfidenceColorClass(
            room.confidence_color
          )}`}
          title={`Confidence: ${room.confidence_score}%`}
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

      {/* Risk Flags */}
      {room.risk_flags.length > 0 && (
        <div className="room-risk-flags">
          {room.risk_flags.map((flag) => (
            <span
              key={flag}
              className="risk-flag"
              title={getRiskFlagLabel(flag)}
            >
              {getRiskFlagIcon(flag)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
