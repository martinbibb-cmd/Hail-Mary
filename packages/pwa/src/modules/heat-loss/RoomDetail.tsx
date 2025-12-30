/**
 * RoomDetail (v2)
 *
 * The "money screen" with instant flow temp toggle
 */

import React, { useState } from 'react';
import { useHeatLossStore } from './heatLossStore';
import { AuditDrawer } from './AuditDrawer';
import { getSourceBadgeLabel } from './confidence';
import type { SurfaceRow } from './types';
import type { RoomHeatLoss, Wall } from '@hail-mary/shared';
import { FlowTempToggle } from './FlowTempToggle';
import './RoomDetail.css';

interface RoomDetailProps {
  roomId: string;
  onBack: () => void;
}

export const RoomDetail: React.FC<RoomDetailProps> = ({ roomId, onBack }) => {
  const { calculations, rooms, walls, roomSummaries, selectedFlowTemp, setFlowTemp } = useHeatLossStore();
  const [selectedSurface, setSelectedSurface] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  if (!calculations || !calculations.room_heat_losses) {
    return (
      <div className="room-detail">
        <button onClick={onBack}>← Back</button>
        <p>No calculation data available</p>
      </div>
    );
  }

  const roomHeatLoss = calculations.room_heat_losses.find(
    (r: RoomHeatLoss) => r.room_id === roomId
  );

  if (!roomHeatLoss) {
    return (
      <div className="room-detail">
        <button onClick={onBack}>← Back</button>
        <p>Room not found</p>
      </div>
    );
  }

  const room = rooms.find((r) => r.room_id === roomId);
  const roomWalls = walls.filter((w: Wall) => (w as any).room_id === roomId);
  const roomSummary = roomSummaries.find((rs) => rs.room_id === roomId);

  // Build surface rows
  const surfaceRows: SurfaceRow[] = roomWalls.map((wall) => ({
    surface_id: wall.wall_id,
    surface_name: `${wall.orientation || 'Unknown'} Wall`,
    surface_type: 'wall',
    classification: wall.surface_classification || 'EXTERNAL',
    heat_loss_w: 0, // TODO: Calculate from wall
    source_badge: wall.source_type || 'ASSUMED',
    confidence_score: wall.confidence_score ? 70 : 20, // Simplified
    u_value: wall.u_value_measured || wall.u_value_calculated,
    area_m2: wall.area_m2,
  }));

  // Get adequacy for current flow temp (instant - from pre-computed data)
  const adequacy = roomSummary?.adequacy_at_all_temps;
  const currentAdequacy =
    selectedFlowTemp === 45
      ? adequacy?.at_45c
      : selectedFlowTemp === 55
      ? adequacy?.at_55c
      : adequacy?.at_75c;

  const handleSurfaceClick = (surfaceId: string) => {
    setSelectedSurface(surfaceId);
    setShowAudit(true);
  };

  const handleCloseAudit = () => {
    setShowAudit(false);
    setSelectedSurface(null);
  };

  return (
    <div className="room-detail">
      {/* Header */}
      <div className="room-detail-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h2>{room?.name || roomId}</h2>
      </div>

      {/* Result & Adequacy */}
      <div className="room-result-card">
        <div className="result-value">
          <span className="result-number">
            {((roomHeatLoss.total_loss_w || 0) / 1000).toFixed(2)}
          </span>
          <span className="result-unit">kW</span>
        </div>

        {/* Flow Temp Toggle (Instant) */}
        <FlowTempToggle
          selectedTemp={selectedFlowTemp}
          onTempChange={setFlowTemp}
        />

        {/* Adequacy Strip */}
        <div className="adequacy-strip">
          <div className="adequacy-item">
            <span className="adequacy-temp">45°C</span>
            <span
              className={`adequacy-badge ${
                adequacy?.at_45c?.adequate ? 'adequacy-ok' : 'adequacy-upsize'
              }`}
            >
              {adequacy?.at_45c?.adequate ? '✅' : '❌'}
            </span>
          </div>
          <div className="adequacy-item">
            <span className="adequacy-temp">55°C</span>
            <span
              className={`adequacy-badge ${
                adequacy?.at_55c?.adequate ? 'adequacy-ok' : 'adequacy-upsize'
              }`}
            >
              {adequacy?.at_55c?.adequate ? '✅' : '❌'}
            </span>
          </div>
          <div className="adequacy-item">
            <span className="adequacy-temp">75°C</span>
            <span
              className={`adequacy-badge ${
                adequacy?.at_75c?.adequate ? 'adequacy-ok' : 'adequacy-upsize'
              }`}
            >
              {adequacy?.at_75c?.adequate ? '✅' : '❌'}
            </span>
          </div>
        </div>
      </div>

      {/* Heat Loss Breakdown */}
      <div className="heat-loss-breakdown">
        <h3>Heat Loss Breakdown</h3>
        <div className="breakdown-bars">
          <div className="breakdown-item">
            <span className="breakdown-label">Transmission</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill transmission"
                style={{
                  width: `${
                    ((roomHeatLoss.fabric_loss_w || 0) /
                      (roomHeatLoss.total_loss_w || 1)) *
                    100
                  }%`,
                }}
              />
            </div>
            <span className="breakdown-value">
              {(roomHeatLoss.fabric_loss_w || 0).toFixed(0)} W
            </span>
          </div>

          <div className="breakdown-item">
            <span className="breakdown-label">Ventilation</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill ventilation"
                style={{
                  width: `${
                    ((roomHeatLoss.ventilation_loss_w || 0) /
                      (roomHeatLoss.total_loss_w || 1)) *
                    100
                  }%`,
                }}
              />
            </div>
            <span className="breakdown-value">
              {(roomHeatLoss.ventilation_loss_w || 0).toFixed(0)} W
            </span>
          </div>

          {(roomHeatLoss.thermal_bridging_w || 0) > 0 && (
            <div className="breakdown-item">
              <span className="breakdown-label">Thermal Bridging</span>
              <div className="breakdown-bar">
                <div
                  className="breakdown-fill thermal-bridge"
                  style={{
                    width: `${
                      ((roomHeatLoss.thermal_bridging_w || 0) /
                        (roomHeatLoss.total_loss_w || 1)) *
                      100
                    }%`,
                  }}
                />
              </div>
              <span className="breakdown-value">
                {(roomHeatLoss.thermal_bridging_w || 0).toFixed(0)} W
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Surfaces List */}
      <div className="surfaces-section">
        <h3>Surfaces</h3>
        <div className="surfaces-list">
          {surfaceRows.map((surface) => (
            <div
              key={surface.surface_id}
              className="surface-row"
              onClick={() => handleSurfaceClick(surface.surface_id)}
            >
              <div className="surface-main">
                <span className="surface-name">{surface.surface_name}</span>
                <span className="surface-classification">
                  {surface.classification}
                </span>
              </div>
              <div className="surface-meta">
                <span className="surface-area">
                  {surface.area_m2?.toFixed(1)} m²
                </span>
                {surface.u_value && (
                  <span className="surface-u-value">
                    U: {surface.u_value.toFixed(2)} W/m²K
                  </span>
                )}
                <span className={`source-badge ${surface.source_badge}`}>
                  {getSourceBadgeLabel(surface.source_badge)}
                </span>
              </div>
              <button className="audit-btn" title="View audit trail">
                ℹ️
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="room-actions">
        <button className="action-btn primary">Upgrade Confidence</button>
        <button className="action-btn secondary">Add/Confirm Emitter</button>
        <button className="action-btn secondary">Attach Evidence</button>
      </div>

      {/* Audit Drawer */}
      {showAudit && selectedSurface && (
        <AuditDrawer
          surfaceId={selectedSurface}
          auditEntries={calculations.audit_trail || []}
          onClose={handleCloseAudit}
        />
      )}
    </div>
  );
};
