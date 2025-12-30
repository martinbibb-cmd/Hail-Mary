/**
 * HeatLossApp - Main Heat Loss Module
 *
 * Phase: 1 (Live - Atlas v1.2)
 *
 * Purpose:
 * - Confidence-led heat loss calculations
 * - Room-by-room breakdown with audit trail
 * - Emitter adequacy checking at multiple flow temps
 * - "No-friction" field interface with voice support (Sarah)
 */

import React, { useState } from 'react';
import { HeatLossDashboard } from './HeatLossDashboard';
import { RoomDetail } from './RoomDetail';
import { UpgradeConfidenceBottomSheet } from './UpgradeConfidenceBottomSheet';
import { useHeatLossStore } from './heatLossStore';
import type { UpgradeAction } from './types';
import './HeatLoss.css';

export const HeatLossApp: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'room_detail'>('dashboard');
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);

  const { selectedRoomId, roomSummaries } = useHeatLossStore();

  const handleBackToDashboard = () => {
    useHeatLossStore.getState().selectRoom(null);
    setView('dashboard');
  };

  const handleCloseUpgradeSheet = () => {
    setShowUpgradeSheet(false);
  };

  const handleActionSelect = (action: UpgradeAction) => {
    console.log('Selected action:', action);
    // TODO: Implement action handlers
    // - scan_geometry: Launch RoomPlan
    // - confirm_wall: Show wall type picker
    // - confirm_insulation: Show insulation picker
    // - attach_photo: Launch camera
    // - set_unheated_temp: Show temp model picker
    setShowUpgradeSheet(false);
  };

  const currentRoom = selectedRoomId
    ? roomSummaries.find((r) => r.room_id === selectedRoomId)
    : null;

  return (
    <div className="heat-loss-app">
      {view === 'dashboard' && <HeatLossDashboard />}

      {view === 'room_detail' && selectedRoomId && (
        <RoomDetail roomId={selectedRoomId} onBack={handleBackToDashboard} />
      )}

      {showUpgradeSheet && currentRoom && (
        <UpgradeConfidenceBottomSheet
          room={currentRoom}
          onClose={handleCloseUpgradeSheet}
          onActionSelect={handleActionSelect}
        />
      )}
    </div>
  );
};
