/**
 * HeatLossDashboard (v2)
 *
 * Confidence-led dashboard with validation state banner
 */

import React from 'react';
import { useHeatLossStore } from './heatLossStore';
import { RoomCard } from './RoomCard';
import { FlowTempToggle } from './FlowTempToggle';
import { getConfidenceColorClass } from './confidence';
import { getTopPriorityAction } from './upgradeActions';
import type { ValidationState } from './types';
import './HeatLossDashboard.css';

export const HeatLossDashboard: React.FC = () => {
  const {
    calculations,
    roomSummaries,
    wholeHouseConfidence,
    validationState,
    selectedFlowTemp,
    isCalculating,
    error,
    lastCalculatedAt,
    walls,
    setFlowTemp,
    selectRoom,
  } = useHeatLossStore();

  const wholeHouseKw = calculations?.whole_house_heat_loss_kw || 0;
  const wholeHouseW = calculations?.whole_house_heat_loss_w || 0;
  const confidenceColor =
    wholeHouseConfidence >= 80
      ? 'green'
      : wholeHouseConfidence >= 50
      ? 'amber'
      : 'red';

  const handleRoomClick = (roomId: string) => {
    selectRoom(roomId);
    // TODO: Navigate to room detail view
    console.log('Navigate to room detail:', roomId);
  };

  const handleUpgradeTopRisk = () => {
    // Find room with lowest confidence
    const lowestConfidenceRoom = roomSummaries.reduce((lowest, room) =>
      room.confidence_score < lowest.confidence_score ? room : lowest
    );

    if (lowestConfidenceRoom) {
      const roomWalls = walls.filter(
        (w: any) => w.room_id === lowestConfidenceRoom.room_id
      );
      const topAction = getTopPriorityAction(
        lowestConfidenceRoom.room_id,
        lowestConfidenceRoom.risk_flags,
        roomWalls
      );

      console.log('Top priority action:', topAction);
      // TODO: Open upgrade confidence sheet pre-filtered to top action
    }
  };

  return (
    <div className="heat-loss-dashboard">
      {/* Header */}
      <div className="hl-header">
        <div className="hl-title-section">
          <h2>🔥 Heat Loss Analysis</h2>
          <span className="module-badge live">Atlas v1.2</span>
        </div>

        {lastCalculatedAt && (
          <div className="hl-last-calc">
            Last calculated: {lastCalculatedAt.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Validation State Banner */}
      {validationState !== 'READY' && roomSummaries.length > 0 && (
        <ValidationBanner
          validationState={validationState}
          onUpgradeTopRisk={handleUpgradeTopRisk}
        />
      )}

      {/* Whole House Summary */}
      <div className="hl-summary-card">
        <div className="hl-summary-header">
          <h3>Whole House Heat Loss</h3>
          <div
            className={`confidence-badge ${getConfidenceColorClass(
              confidenceColor
            )}`}
          >
            Confidence: {wholeHouseConfidence}%
          </div>
        </div>

        <div className="hl-summary-value">
          <span className="hl-big-number">{wholeHouseKw.toFixed(1)}</span>
          <span className="hl-unit">kW</span>
          <span className="hl-small-value">({wholeHouseW.toFixed(0)} W)</span>
        </div>

        {/* Flow Temp Toggle */}
        <FlowTempToggle
          selectedTemp={selectedFlowTemp}
          onTempChange={setFlowTemp}
        />

        {calculations?.heat_loss_per_m2 && (
          <div className="hl-summary-meta">
            <span>
              {calculations.heat_loss_per_m2.toFixed(0)} W/m² heat loss density
            </span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="hl-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {isCalculating && (
        <div className="hl-loading">
          <div className="spinner" />
          <span>Calculating heat loss...</span>
        </div>
      )}

      {/* Rooms Grid */}
      {!isCalculating && roomSummaries.length > 0 && (
        <div className="hl-rooms-section">
          <h3>Room-by-Room Breakdown</h3>
          <div className="hl-rooms-grid">
            {roomSummaries.map((room) => (
              <RoomCard
                key={room.room_id}
                room={room}
                selectedFlowTemp={selectedFlowTemp}
                onRoomClick={() => handleRoomClick(room.room_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isCalculating && roomSummaries.length === 0 && !error && (
        <div className="hl-empty-state">
          <p>No heat loss calculations yet.</p>
          <p>Add rooms and walls to get started.</p>
        </div>
      )}

      {/* Disclaimer Footer */}
      <div className="hl-disclaimer">
        ⚠️ Not a compliance certificate - for formal MCS certification, consult
        an accredited assessor.
      </div>
    </div>
  );
};

/**
 * Validation State Banner Component
 */
interface ValidationBannerProps {
  validationState: ValidationState;
  onUpgradeTopRisk: () => void;
}

const ValidationBanner: React.FC<ValidationBannerProps> = ({
  validationState,
  onUpgradeTopRisk,
}) => {
  if (validationState === 'READY') return null;

  const isProvisional = validationState === 'PROVISIONAL';

  return (
    <div className={`validation-banner ${validationState.toLowerCase()}`}>
      <div className="banner-icon">
        {isProvisional ? '⚠️' : '⛔'}
      </div>
      <div className="banner-content">
        <div className="banner-title">
          {isProvisional ? 'Provisional Result' : 'Incomplete Data'}
        </div>
        <div className="banner-message">
          {isProvisional
            ? 'Can calculate, but important drivers assumed'
            : 'Cannot calculate safely - missing required data'}
        </div>
      </div>
      {isProvisional && (
        <button className="banner-action" onClick={onUpgradeTopRisk}>
          Upgrade Top Risk
        </button>
      )}
    </div>
  );
};
