/**
 * Entity Confirmation Panel Component
 *
 * Container panel for reviewing and confirming extracted entities.
 *
 * Features:
 * - Groups entities by type
 * - Shows overall extraction confidence
 * - Bulk confirm/reject actions
 * - Filter by needs confirmation
 * - Stats display (X of Y confirmed)
 *
 * Usage:
 * ```tsx
 * <EntityConfirmationPanel
 *   entities={extractedEntities}
 *   events={extractedEvents}
 *   overallConfidence={0.87}
 *   onConfirmAll={handleConfirmAll}
 *   onEntityConfirm={handleEntityConfirm}
 * />
 * ```
 */

import React, { useState } from 'react';
import type { Entity, Event } from '@hail-mary/shared/atlas-voice';
import { EntityChip } from './EntityChip';
import './EntityConfirmationPanel.css';

export interface EntityConfirmationPanelProps {
  /** Extracted entities */
  entities: Entity[];

  /** Extracted events */
  events?: Event[];

  /** Overall extraction confidence */
  overallConfidence?: number;

  /** Items needing confirmation count */
  itemsNeedingConfirmation?: number;

  /** Called when user confirms all entities */
  onConfirmAll?: () => void;

  /** Called when user confirms a single entity */
  onEntityConfirm?: (entity: Entity) => void;

  /** Called when user edits an entity */
  onEntityEdit?: (entity: Entity) => void;

  /** Called when user selects an alternative for an entity */
  onSelectAlternative?: (entity: Entity, alternative: any) => void;

  /** Show events (default: false) */
  showEvents?: boolean;

  /** Custom className */
  className?: string;
}

/**
 * Group entities by type
 */
function groupEntitiesByType(entities: Entity[]): Record<string, Entity[]> {
  const groups: Record<string, Entity[]> = {};

  entities.forEach((entity) => {
    if (!groups[entity.type]) {
      groups[entity.type] = [];
    }
    groups[entity.type].push(entity);
  });

  return groups;
}

/**
 * Get display name for entity type group
 */
function getEntityTypeGroupName(type: string): string {
  const nameMap: Record<string, string> = {
    boiler: 'Boilers',
    fault_code: 'Fault Codes',
    component: 'Components',
    measurement: 'Measurements',
    control_system: 'Control Systems',
    material: 'Materials',
  };

  return nameMap[type] || type;
}

/**
 * Calculate confirmation stats
 */
function calculateStats(entities: Entity[]): {
  total: number;
  confirmed: number;
  needsConfirmation: number;
  percentConfirmed: number;
} {
  const total = entities.length;
  const needsConfirmation = entities.filter((e) => e.metadata.needs_confirmation).length;
  const confirmed = total - needsConfirmation;
  const percentConfirmed = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  return {
    total,
    confirmed,
    needsConfirmation,
    percentConfirmed,
  };
}

export const EntityConfirmationPanel: React.FC<EntityConfirmationPanelProps> = ({
  entities,
  events = [],
  overallConfidence,
  itemsNeedingConfirmation: _itemsNeedingConfirmation, // Unused but kept for API compatibility
  onConfirmAll,
  onEntityConfirm,
  onEntityEdit,
  onSelectAlternative,
  showEvents = false,
  className = '',
}) => {
  const [filterNeedsConfirmation, setFilterNeedsConfirmation] = useState(false);

  const stats = calculateStats(entities);

  const filteredEntities = filterNeedsConfirmation
    ? entities.filter((e) => e.metadata.needs_confirmation)
    : entities;

  const filteredGroups = groupEntitiesByType(filteredEntities);

  const hasAnyNeedingConfirmation = stats.needsConfirmation > 0;

  return (
    <div className={`entity-confirmation-panel ${className}`}>
      {/* Header */}
      <div className="panel-header">
        <h3 className="panel-title">Review Extracted Information</h3>

        {overallConfidence !== undefined && (
          <div className="overall-confidence">
            <span className="confidence-label">Overall Confidence:</span>
            <span className={`confidence-value confidence-${overallConfidence >= 0.8 ? 'high' : overallConfidence >= 0.5 ? 'medium' : 'low'}`}>
              {Math.round(overallConfidence * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total Items</span>
        </div>

        <div className="stat">
          <span className="stat-value confirmed">{stats.confirmed}</span>
          <span className="stat-label">Confirmed</span>
        </div>

        {hasAnyNeedingConfirmation && (
          <div className="stat">
            <span className="stat-value needs-confirmation">{stats.needsConfirmation}</span>
            <span className="stat-label">Need Review</span>
          </div>
        )}

        <div className="stat-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${stats.percentConfirmed}%` }}
            />
          </div>
          <span className="progress-label">{stats.percentConfirmed}% confirmed</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        {hasAnyNeedingConfirmation && (
          <>
            <button
              className="filter-button"
              onClick={() => setFilterNeedsConfirmation(!filterNeedsConfirmation)}
            >
              {filterNeedsConfirmation ? '📋 Show All' : '❓ Show Needs Review Only'}
            </button>

            {onConfirmAll && (
              <button className="confirm-all-button" onClick={onConfirmAll}>
                ✓ Confirm All
              </button>
            )}
          </>
        )}
      </div>

      {/* Entity Groups */}
      <div className="entity-groups">
        {Object.entries(filteredGroups).map(([type, groupEntities]) => (
          <div key={type} className="entity-group">
            <h4 className="group-title">
              {getEntityTypeGroupName(type)}
              <span className="group-count">({groupEntities.length})</span>
            </h4>

            <div className="entity-list">
              {groupEntities.map((entity, index) => (
                <EntityChip
                  key={`${entity.type}-${index}`}
                  entity={entity}
                  onConfirm={onEntityConfirm}
                  onEdit={onEntityEdit}
                  onSelectAlternative={onSelectAlternative}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredEntities.length === 0 && (
        <div className="empty-state">
          {filterNeedsConfirmation ? (
            <>
              <div className="empty-icon">✓</div>
              <div className="empty-title">All items confirmed!</div>
              <div className="empty-description">
                No items need review. Everything looks good.
              </div>
            </>
          ) : (
            <>
              <div className="empty-icon">📋</div>
              <div className="empty-title">No entities extracted</div>
              <div className="empty-description">
                Start recording to extract entities from your voice notes.
              </div>
            </>
          )}
        </div>
      )}

      {/* Events Section (Optional) */}
      {showEvents && events.length > 0 && (
        <div className="events-section">
          <h4 className="section-title">
            Diagnostic Events
            <span className="group-count">({events.length})</span>
          </h4>

          <div className="events-list">
            {events.map((event, index) => (
              <div key={index} className="event-item">
                <div className="event-type">{event.type}</div>
                <div className="event-description">
                  {(event as any).observation || (event as any).description || 'Event'}
                </div>
                {(event as any).severity && (
                  <span className={`event-severity severity-${(event as any).severity}`}>
                    {(event as any).severity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityConfirmationPanel;
