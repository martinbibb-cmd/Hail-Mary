/**
 * Decision Log
 *
 * Displays all decisions with evidence trails
 * Shows decision reasoning, confidence, and linked facts
 */

import { useState } from 'react';
import type { Decision, Fact } from '@hail-mary/shared';
import { ConfidenceIndicator } from './ConfidenceIndicator';

interface DecisionLogProps {
  decisions: Decision[];
  facts: Fact[];
}

export function DecisionLog({ decisions, facts }: DecisionLogProps) {
  const [expandedDecision, setExpandedDecision] = useState<string | null>(null);

  // Group by decision type
  const decisionsByType = decisions.reduce((acc, decision) => {
    if (!acc[decision.decisionType]) {
      acc[decision.decisionType] = [];
    }
    acc[decision.decisionType].push(decision);
    return acc;
  }, {} as Record<string, Decision[]>);

  const toggleExpanded = (id: string) => {
    setExpandedDecision(expandedDecision === id ? null : id);
  };

  return (
    <div className="decision-log">
      {/* Summary */}
      <div className="decision-summary">
        <div className="summary-item">
          <span className="summary-count">{decisions.length}</span>
          <span className="summary-label">Total Decisions</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{decisions.filter((d) => d.createdBy === 'engineer').length}</span>
          <span className="summary-label">Engineer</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{decisions.filter((d) => d.createdBy === 'ai').length}</span>
          <span className="summary-label">AI</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{decisions.filter((d) => d.createdBy === 'system').length}</span>
          <span className="summary-label">System</span>
        </div>
      </div>

      {/* Decisions List */}
      <div className="decisions-list">
        {decisions.length === 0 ? (
          <div className="empty-state">No decisions recorded yet</div>
        ) : (
          decisions.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              facts={facts}
              isExpanded={expandedDecision === decision.id}
              onToggle={() => toggleExpanded(decision.id)}
            />
          ))
        )}
      </div>

      {/* Group by Type */}
      {Object.keys(decisionsByType).length > 1 && (
        <div className="decision-groups">
          <h3>By Type</h3>
          {Object.entries(decisionsByType).map(([type, typeDecisions]) => (
            <div key={type} className="decision-group">
              <h4>{type} ({typeDecisions.length})</h4>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DecisionCardProps {
  decision: Decision;
  facts: Fact[];
  isExpanded: boolean;
  onToggle: () => void;
}

function DecisionCard({ decision, facts, isExpanded, onToggle }: DecisionCardProps) {
  const getDecisionTypeIcon = (type: string) => {
    switch (type) {
      case 'system_selection':
        return '🔧';
      case 'compliance':
        return '📋';
      case 'upgrade_path':
        return '⬆️';
      case 'specification':
        return '📐';
      case 'risk_mitigation':
        return '🛡️';
      case 'customer_option':
        return '👤';
      default:
        return '📝';
    }
  };

  const getCreatorBadge = (creator: string) => {
    switch (creator) {
      case 'engineer':
        return '👷';
      case 'ai':
        return '🤖';
      case 'system':
        return '⚙️';
      default:
        return '?';
    }
  };

  // Get evidence facts
  const evidenceFacts = facts.filter((f) => decision.evidenceFactIds.includes(f.id));

  return (
    <div className="decision-card">
      <div className="decision-header" onClick={onToggle}>
        <div className="decision-icon">{getDecisionTypeIcon(decision.decisionType)}</div>
        <div className="decision-info">
          <div className="decision-type-label">{decision.decisionType}</div>
          <div className="decision-text">{decision.decision}</div>
        </div>
        <div className="decision-meta">
          <div className="decision-creator">{getCreatorBadge(decision.createdBy)}</div>
          <ConfidenceIndicator confidence={decision.confidence} size="small" showLabel={false} />
        </div>
        <button className="expand-btn">{isExpanded ? '▼' : '▶'}</button>
      </div>

      {isExpanded && (
        <div className="decision-details">
          {/* Reasoning */}
          <div className="decision-reasoning">
            <strong>Reasoning:</strong>
            <p>{decision.reasoning}</p>
          </div>

          {/* Rule Applied */}
          {decision.ruleApplied && (
            <div className="decision-rule">
              <strong>Rule Applied:</strong>
              <div className="rule-info">
                <div className="rule-source">{decision.ruleApplied.source}</div>
                <div className="rule-standard">{decision.ruleApplied.standard}</div>
                {decision.ruleApplied.section && (
                  <div className="rule-section">{decision.ruleApplied.section}</div>
                )}
                <div className="rule-description">{decision.ruleApplied.description}</div>
              </div>
            </div>
          )}

          {/* Evidence Facts */}
          {evidenceFacts.length > 0 && (
            <div className="decision-evidence">
              <strong>Evidence ({evidenceFacts.length} facts):</strong>
              <div className="evidence-facts">
                {evidenceFacts.map((fact) => (
                  <div key={fact.id} className="evidence-fact">
                    <span className="fact-category">{fact.category}</span>
                    <span className="fact-key">{fact.key}</span>
                    <span className="fact-value">
                      {JSON.stringify(fact.value)} {fact.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {decision.risks.length > 0 && (
            <div className="decision-risks">
              <strong>Risks & Assumptions:</strong>
              <ul>
                {decision.risks.map((risk, index) => (
                  <li key={index}>{risk}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Metadata */}
          <div className="decision-metadata">
            <div>
              <strong>Created:</strong> {new Date(decision.createdAt).toLocaleString()}
            </div>
            <div>
              <strong>Created by:</strong> {decision.createdBy}
            </div>
            {decision.milestoneId && (
              <div>
                <strong>Milestone:</strong> {decision.milestoneId.substring(0, 8)}...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
