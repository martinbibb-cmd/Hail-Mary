/**
 * UpgradeConfidenceBottomSheet (v2)
 *
 * Deterministic upgrade actions via getUpgradeActions()
 */

import React from 'react';
import type { RoomSummary, UpgradeAction } from './types';
import { getUpgradeActions, getNextBestActionMessage } from './upgradeActions';
import './bottomSheet.css';

interface UpgradeConfidenceBottomSheetProps {
  room: RoomSummary;
  onClose: () => void;
  onActionSelect: (action: UpgradeAction) => void;
}

export const UpgradeConfidenceBottomSheet: React.FC<
  UpgradeConfidenceBottomSheetProps
> = ({ room, onClose, onActionSelect }) => {
  // Generate deterministic actions based on risk flags
  const actions = getUpgradeActions(room.room_id, room.risk_flags);
  const nextBestAction = getNextBestActionMessage(room.risk_flags);

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />

        <div className="bottom-sheet-header">
          <h3>Upgrade Confidence: {room.room_name}</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="bottom-sheet-content">
          <div className="confidence-status">
            <span className="confidence-label">Current Confidence:</span>
            <span
              className={`confidence-badge confidence-${room.confidence_color}`}
            >
              {room.confidence_score}%
            </span>
          </div>

          <div className="next-best-action">
            <strong>Recommended:</strong> {nextBestAction}
          </div>

          <div className="upgrade-actions">
            <h4>Quick Actions</h4>
            {actions.map((action) => (
              <button
                key={action.action_id}
                className="upgrade-action-btn"
                onClick={() => onActionSelect(action)}
              >
                <div className="action-main">
                  <span className="action-label">{action.label}</span>
                  <span className="action-reason">{action.reason}</span>
                </div>
                <div className="action-time">{action.estimated_time_sec}s</div>
              </button>
            ))}
          </div>

          {actions.length === 0 && (
            <div className="no-actions">
              <p>✅ No urgent actions needed - confidence is high!</p>
            </div>
          )}
        </div>

        <div className="bottom-sheet-footer">
          <p className="sheet-footer-note">
            These actions will improve confidence and reduce assumptions in your
            heat loss calculation.
          </p>
        </div>
      </div>
    </div>
  );
};
