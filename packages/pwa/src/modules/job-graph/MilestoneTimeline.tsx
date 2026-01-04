/**
 * Milestone Timeline
 *
 * Visual timeline showing milestone progress with confidence and blockers
 */

import type { Milestone } from '@hail-mary/shared';
import { ConfidenceIndicator } from './ConfidenceIndicator';

interface MilestoneTimelineProps {
  milestones: Milestone[];
}

export function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  // Group by status for better organization
  const completed = milestones.filter((m) => m.status === 'complete');
  const inProgress = milestones.filter((m) => m.status === 'in_progress');
  const blocked = milestones.filter((m) => m.status === 'blocked');
  const pending = milestones.filter((m) => m.status === 'pending');

  return (
    <div className="milestone-timeline">
      {/* Progress Bar */}
      <div className="timeline-progress">
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{
              width: `${(completed.length / milestones.length) * 100}%`,
            }}
          />
        </div>
        <div className="progress-text">
          {completed.length} / {milestones.length} complete
        </div>
      </div>

      {/* Milestone Cards */}
      <div className="milestone-cards">
        {milestones.map((milestone) => (
          <MilestoneCard key={milestone.id} milestone={milestone} />
        ))}
      </div>

      {/* Summary */}
      <div className="milestone-summary">
        <div className="summary-item">
          <span className="summary-count complete">{completed.length}</span>
          <span className="summary-label">Complete</span>
        </div>
        <div className="summary-item">
          <span className="summary-count in-progress">{inProgress.length}</span>
          <span className="summary-label">In Progress</span>
        </div>
        <div className="summary-item">
          <span className="summary-count blocked">{blocked.length}</span>
          <span className="summary-label">Blocked</span>
        </div>
        <div className="summary-item">
          <span className="summary-count pending">{pending.length}</span>
          <span className="summary-label">Pending</span>
        </div>
      </div>
    </div>
  );
}

interface MilestoneCardProps {
  milestone: Milestone;
}

function MilestoneCard({ milestone }: MilestoneCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return '✓';
      case 'in_progress':
        return '⟳';
      case 'blocked':
        return '✗';
      case 'pending':
        return '○';
      default:
        return '○';
    }
  };

  const getCriticalityColor = (level: string | undefined) => {
    switch (level) {
      case 'critical':
        return '#dc2626';
      case 'important':
        return '#f59e0b';
      case 'optional':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const criticalityLevel = milestone.metadata?.criticalityLevel as string | undefined;
  const description = milestone.metadata?.description as string | undefined;

  return (
    <div className={`milestone-card status-${milestone.status}`}>
      <div className="milestone-header">
        <div className="milestone-status-icon">{getStatusIcon(milestone.status)}</div>
        <div className="milestone-info">
          <h4 className="milestone-label">{milestone.label}</h4>
          <div className="milestone-meta">
            <span className="milestone-key">{milestone.key}</span>
            {criticalityLevel && (
              <span
                className="milestone-criticality"
                style={{ color: getCriticalityColor(criticalityLevel) }}
              >
                {criticalityLevel}
              </span>
            )}
          </div>
        </div>
        <div className="milestone-confidence">
          <ConfidenceIndicator confidence={milestone.confidence} size="small" />
        </div>
      </div>

      {description && (
        <p className="milestone-description">{description}</p>
      )}

      {milestone.blockers.length > 0 && (
        <div className="milestone-blockers">
          <strong>Blockers:</strong>
          <ul>
            {milestone.blockers.map((blocker, index) => (
              <li key={index}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      {milestone.completedAt && (
        <div className="milestone-completed">
          Completed: {new Date(milestone.completedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
