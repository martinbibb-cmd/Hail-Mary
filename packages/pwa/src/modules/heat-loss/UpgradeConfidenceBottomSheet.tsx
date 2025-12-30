/**
 * UpgradeConfidenceBottomSheet - Context-aware confidence improvement actions
 *
 * Shows fastest ways to upgrade confidence based on what's missing
 */

import React from 'react';
import type { RoomSummary, UpgradeAction } from './types';
import { getNextBestActionMessage } from './confidenceUtils';
import './HeatLoss.css';

interface UpgradeConfidenceBottomSheetProps {
  room: RoomSummary;
  onClose: () => void;
  onActionSelect: (action: UpgradeAction) => void;
}

export const UpgradeConfidenceBottomSheet: React.FC<
  UpgradeConfidenceBottomSheetProps
> = ({ room, onClose, onActionSelect }) => {
  // Build context-aware actions based on risk icons
  const actions: UpgradeAction[] = [];

  if (room.risk_icons.includes('assumed_wall')) {
    actions.push({
      action_id: 'confirm_wall',
      type: 'confirm_wall',
      label: 'Confirm Wall Type',
      description: 'Solid / Cavity / Timber (10 sec)',
      estimated_time_sec: 10,
    });

    actions.push({
      action_id: 'confirm_insulation',
      type: 'confirm_insulation',
      label: 'Confirm Insulation Status',
      description: 'None / Filled / Partial / Unknown (10 sec)',
      estimated_time_sec: 10,
    });
  }

  if (room.risk_icons.includes('unknown_glazing')) {
    actions.push({
      action_id: 'scan_geometry',
      type: 'scan_geometry',
      label: 'Scan Geometry (RoomPlan)',
      description: 'Capture room dimensions and surfaces with LiDAR',
      estimated_time_sec: 60,
    });
  }

  if (room.risk_icons.includes('unheated_adjacent')) {
    actions.push({
      action_id: 'set_unheated_temp',
      type: 'set_unheated_temp',
      label: 'Set Unheated Adjacent Temp',
      description: 'Model garage/porch temperature (15 sec)',
      estimated_time_sec: 15,
    });
  }

  // Always offer photo attachment
  actions.push({
    action_id: 'attach_photo',
    type: 'attach_photo',
    label: 'Attach Photo Evidence',
    description: 'Photo / Thermal / Borescope',
    estimated_time_sec: 30,
  });

  const nextBestAction = getNextBestActionMessage(room.risk_icons);

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
                  <span className="action-description">
                    {action.description}
                  </span>
                </div>
                <div className="action-time">
                  {action.estimated_time_sec} sec
                </div>
              </button>
            ))}
          </div>
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
