/**
 * HeatLossApp (v2)
 *
 * Main Heat Loss Module with v2 confidence architecture
 *
 * Phase: 1 (Live - Atlas v1.2 + v2 confidence)
 */

import React, { useState } from 'react';
import { HeatLossDashboard } from './HeatLossDashboard';
import { RoomDetail } from './RoomDetail';
import { UpgradeConfidenceBottomSheet } from './UpgradeConfidenceBottomSheet';
import { useHeatLossStore } from './heatLossStore';
import type { UpgradeAction } from './types';

export const HeatLossApp: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'room_detail'>('dashboard');
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);

  const { selectedRoomId, roomSummaries, walls } = useHeatLossStore();

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
    // - confirm_glazing: Show glazing picker
    // - attach_photo: Launch camera
    // - set_unheated_temp: Show temp model picker
    // - set_ach_method: Show airtightness picker
    setShowUpgradeSheet(false);
  };

  const currentRoom = selectedRoomId
    ? roomSummaries.find((r) => r.room_id === selectedRoomId)
    : null;

  const currentRoomWalls = selectedRoomId
    ? walls.filter((w: any) => w.room_id === selectedRoomId)
    : [];

  return (
    <div className="heat-loss-app">
      {view === 'dashboard' && <HeatLossDashboard />}

      {view === 'room_detail' && selectedRoomId && (
        <RoomDetail roomId={selectedRoomId} onBack={handleBackToDashboard} />
      )}

      {showUpgradeSheet && currentRoom && (
        <UpgradeConfidenceBottomSheet
          room={currentRoom}
          walls={currentRoomWalls}
          onClose={handleCloseUpgradeSheet}
          onActionSelect={handleActionSelect}
        />
      )}
    </div>
  );
};
