/**
 * Conflicts Panel
 *
 * Displays detected conflicts with MI vs Building Regs highlighting
 * Shows resolution status and affected facts/decisions
 */

import type { Conflict } from '@hail-mary/shared';

interface ConflictsPanelProps {
  conflicts: Conflict[];
}

export function ConflictsPanel({ conflicts }: ConflictsPanelProps) {
  // Filter by status
  const unresolved = conflicts.filter((c) => !c.resolvedAt);
  const resolved = conflicts.filter((c) => c.resolvedAt);

  // Group by severity
  const critical = unresolved.filter((c) => c.severity === 'critical');
  const warnings = unresolved.filter((c) => c.severity === 'warning');
  const info = unresolved.filter((c) => c.severity === 'info');

  return (
    <div className="conflicts-panel">
      {/* Summary */}
      <div className="conflicts-summary">
        <div className="summary-stat critical">
          <span className="stat-count">{critical.length}</span>
          <span className="stat-label">Critical</span>
        </div>
        <div className="summary-stat warning">
          <span className="stat-count">{warnings.length}</span>
          <span className="stat-label">Warnings</span>
        </div>
        <div className="summary-stat info">
          <span className="stat-count">{info.length}</span>
          <span className="stat-label">Info</span>
        </div>
        <div className="summary-stat resolved">
          <span className="stat-count">{resolved.length}</span>
          <span className="stat-label">Resolved</span>
        </div>
      </div>

      {/* Unresolved Conflicts */}
      {unresolved.length > 0 && (
        <div className="conflicts-section">
          <h3>Unresolved Conflicts</h3>
          <div className="conflicts-list">
            {unresolved.map((conflict) => (
              <ConflictCard key={conflict.id} conflict={conflict} />
            ))}
          </div>
        </div>
      )}

      {/* Resolved Conflicts */}
      {resolved.length > 0 && (
        <div className="conflicts-section">
          <h3>Resolved Conflicts ({resolved.length})</h3>
          <details>
            <summary>Show resolved conflicts</summary>
            <div className="conflicts-list">
              {resolved.map((conflict) => (
                <ConflictCard key={conflict.id} conflict={conflict} />
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Empty State */}
      {conflicts.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✓</div>
          <h3>No Conflicts Detected</h3>
          <p>All validations passed successfully</p>
        </div>
      )}
    </div>
  );
}

interface ConflictCardProps {
  conflict: Conflict;
}

function ConflictCard({ conflict }: ConflictCardProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '⚠️';
      case 'warning':
        return '⚡';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#dc2626';
      case 'warning':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getConflictTypeLabel = (type: string) => {
    switch (type) {
      case 'mi_vs_regs':
        return 'MI vs Building Regs';
      case 'fact_contradiction':
        return 'Contradictory Facts';
      case 'validation_failure':
        return 'Validation Failure';
      case 'incompatibility':
        return 'Incompatibility';
      case 'missing_data':
        return 'Missing Data';
      case 'risk_unmitigated':
        return 'Unmitigated Risk';
      default:
        return type;
    }
  };

  return (
    <div
      className={`conflict-card severity-${conflict.severity} ${conflict.resolvedAt ? 'resolved' : ''}`}
      style={{ borderLeftColor: getSeverityColor(conflict.severity) }}
    >
      <div className="conflict-header">
        <div className="conflict-icon">{getSeverityIcon(conflict.severity)}</div>
        <div className="conflict-info">
          <div className="conflict-type">{getConflictTypeLabel(conflict.conflictType)}</div>
          <div className="conflict-severity" style={{ color: getSeverityColor(conflict.severity) }}>
            {conflict.severity.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="conflict-description">{conflict.description}</div>

      {/* Rules */}
      {(conflict.rule1 || conflict.rule2) && (
        <div className="conflict-rules">
          {conflict.rule1 && (
            <div className="rule-card">
              <div className="rule-source">{conflict.rule1.source}</div>
              <div className="rule-standard">{conflict.rule1.standard}</div>
              {conflict.rule1.section && <div className="rule-section">{conflict.rule1.section}</div>}
              <div className="rule-description">{conflict.rule1.description}</div>
              {conflict.rule1.restrictiveness && (
                <div className={`rule-restrictiveness ${conflict.rule1.restrictiveness}`}>
                  {conflict.rule1.restrictiveness === 'more' && '▲ More restrictive'}
                  {conflict.rule1.restrictiveness === 'less' && '▼ Less restrictive'}
                  {conflict.rule1.restrictiveness === 'equal' && '= Equal'}
                </div>
              )}
            </div>
          )}

          {conflict.rule2 && (
            <div className="rule-card">
              <div className="rule-source">{conflict.rule2.source}</div>
              <div className="rule-standard">{conflict.rule2.standard}</div>
              {conflict.rule2.section && <div className="rule-section">{conflict.rule2.section}</div>}
              <div className="rule-description">{conflict.rule2.description}</div>
              {conflict.rule2.restrictiveness && (
                <div className={`rule-restrictiveness ${conflict.rule2.restrictiveness}`}>
                  {conflict.rule2.restrictiveness === 'more' && '▲ More restrictive'}
                  {conflict.rule2.restrictiveness === 'less' && '▼ Less restrictive'}
                  {conflict.rule2.restrictiveness === 'equal' && '= Equal'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resolution */}
      {conflict.resolution && (
        <div className="conflict-resolution">
          <strong>Resolution:</strong> {conflict.resolution}
        </div>
      )}

      {/* Affected Items */}
      {(conflict.affectedFactIds.length > 0 || conflict.affectedDecisionIds.length > 0) && (
        <div className="conflict-affected">
          {conflict.affectedFactIds.length > 0 && (
            <div>
              <strong>Affected Facts:</strong> {conflict.affectedFactIds.length}
            </div>
          )}
          {conflict.affectedDecisionIds.length > 0 && (
            <div>
              <strong>Affected Decisions:</strong> {conflict.affectedDecisionIds.length}
            </div>
          )}
        </div>
      )}

      {/* Timestamps */}
      <div className="conflict-timestamps">
        <div>Created: {new Date(conflict.createdAt).toLocaleString()}</div>
        {conflict.resolvedAt && (
          <div className="resolved-timestamp">
            Resolved: {new Date(conflict.resolvedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
