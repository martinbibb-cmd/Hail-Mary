/**
 * Entity Chip Component
 *
 * Displays an extracted entity as a chip/badge with confidence indicator.
 *
 * Features:
 * - Entity type icon and label
 * - Confidence indicator
 * - Interactive (tap to edit/confirm)
 * - Alternative suggestions dropdown
 *
 * Usage:
 * ```tsx
 * <EntityChip
 *   entity={boilerEntity}
 *   onConfirm={handleConfirm}
 *   onEdit={handleEdit}
 * />
 * ```
 */

import React, { useState } from 'react';
import type { Entity, BoilerEntity, FaultCodeEntity, ComponentEntity } from '@hail-mary/shared/atlas-voice';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import './EntityChip.css';

export interface EntityChipProps {
  /** The entity to display */
  entity: Entity;

  /** Called when user confirms the entity */
  onConfirm?: (entity: Entity) => void;

  /** Called when user wants to edit the entity */
  onEdit?: (entity: Entity) => void;

  /** Called when user selects an alternative */
  onSelectAlternative?: (entity: Entity, alternative: any) => void;

  /** Compact mode */
  compact?: boolean;

  /** Custom className */
  className?: string;
}

/**
 * Get human-readable label for entity
 */
function getEntityLabel(entity: Entity): string {
  switch (entity.type) {
    case 'boiler': {
      const boiler = entity as BoilerEntity;
      return `${boiler.make} ${boiler.model || ''}`.trim();
    }

    case 'fault_code': {
      const code = entity as FaultCodeEntity;
      return `Code ${code.code}`;
    }

    case 'component': {
      const component = entity as ComponentEntity;
      return component.name;
    }

    case 'measurement': {
      const measurement = entity as any;
      return `${measurement.measurement_type}: ${measurement.value}${measurement.unit}`;
    }

    case 'control_system': {
      const control = entity as any;
      return control.name;
    }

    case 'material': {
      const material = entity as any;
      return material.name;
    }

    default:
      return 'Unknown';
  }
}

/**
 * Get entity type display name
 */
function getEntityTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    boiler: 'Boiler',
    fault_code: 'Fault Code',
    component: 'Component',
    measurement: 'Measurement',
    control_system: 'Control System',
    material: 'Material',
  };

  return typeMap[type] || type;
}

/**
 * Get emoji icon for entity type
 */
function getEntityIcon(type: string): string {
  const iconMap: Record<string, string> = {
    boiler: '🔥',
    fault_code: '⚠️',
    component: '🔧',
    measurement: '📏',
    control_system: '🎛️',
    material: '📦',
  };

  return iconMap[type] || '📋';
}

export const EntityChip: React.FC<EntityChipProps> = ({
  entity,
  onConfirm,
  onEdit,
  onSelectAlternative,
  compact = false,
  className = '',
}) => {
  const [showAlternatives, setShowAlternatives] = useState(false);

  const label = getEntityLabel(entity);
  const typeName = getEntityTypeName(entity.type);
  const icon = getEntityIcon(entity.type);

  const hasAlternatives =
    entity.metadata.alternatives && entity.metadata.alternatives.length > 0;

  const handleChipClick = () => {
    if (entity.metadata.needs_confirmation && hasAlternatives) {
      setShowAlternatives(!showAlternatives);
    } else if (entity.metadata.needs_confirmation && onEdit) {
      onEdit(entity);
    }
  };

  const handleConfirmClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onConfirm) {
      onConfirm(entity);
    }
  };

  const handleAlternativeClick = (alternative: any) => {
    setShowAlternatives(false);
    if (onSelectAlternative) {
      onSelectAlternative(entity, alternative);
    }
  };

  return (
    <div className={`entity-chip-container ${className}`}>
      <div
        className={`entity-chip ${entity.metadata.needs_confirmation ? 'needs-confirmation' : 'confirmed'} ${compact ? 'compact' : ''}`}
        onClick={handleChipClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleChipClick();
          }
        }}
      >
        <span className="entity-icon">{icon}</span>

        <div className="entity-content">
          <div className="entity-type">{typeName}</div>
          <div className="entity-label">{label}</div>
        </div>

        <ConfidenceIndicator
          confidence={entity.metadata.confidence}
          confidenceLevel={entity.metadata.confidence_level}
          compact={compact}
        />

        {entity.metadata.needs_confirmation && !compact && (
          <button
            className="confirm-button"
            onClick={handleConfirmClick}
            title="Confirm this entity"
            aria-label="Confirm entity"
          >
            ✓
          </button>
        )}

        {hasAlternatives && (
          <span className="alternatives-indicator" title={`${entity.metadata.alternatives!.length} alternatives`}>
            ▼
          </span>
        )}
      </div>

      {showAlternatives && hasAlternatives && (
        <div className="alternatives-dropdown">
          <div className="alternatives-header">Did you mean:</div>
          {entity.metadata.alternatives!.map((alt, index) => (
            <button
              key={index}
              className="alternative-option"
              onClick={() => handleAlternativeClick(alt)}
            >
              <span className="alternative-value">{JSON.stringify(alt.value)}</span>
              <span className="alternative-confidence">
                {Math.round(alt.confidence * 100)}% confident
              </span>
              {alt.reason && <span className="alternative-reason">{alt.reason}</span>}
            </button>
          ))}
          <button
            className="alternative-option custom"
            onClick={() => onEdit && onEdit(entity)}
          >
            ✏️ Enter manually
          </button>
        </div>
      )}

      {!compact && entity.metadata.notes && (
        <div className="entity-notes">{entity.metadata.notes}</div>
      )}
    </div>
  );
};

export default EntityChip;
