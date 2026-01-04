/**
 * Job Graph View
 *
 * Main "Bring it together" hub showing:
 * - Timeline of captured assets
 * - Extracted facts
 * - Missing data / conflicts
 * - Confidence indicators
 * - "Generate outputs" buttons
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { JobGraphState, JobGraphSummary, CompletenessAssessment } from '@hail-mary/shared';
import {
  getJobGraphByVisit,
  initializeJobGraph,
  processJobGraph,
  getJobGraphSummary,
} from '../../services/jobGraph.service';
import { MilestoneTimeline } from './MilestoneTimeline';
import { FactsPanel } from './FactsPanel';
import { ConflictsPanel } from './ConflictsPanel';
import { DecisionLog } from './DecisionLog';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import './JobGraphView.css';

export function JobGraphView() {
  const { visitId } = useParams<{ visitId: string }>();
  const [state, setState] = useState<JobGraphState | null>(null);
  const [summary, setSummary] = useState<JobGraphSummary | null>(null);
  const [completeness, setCompleteness] = useState<CompletenessAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'facts' | 'decisions' | 'conflicts'>('facts');

  useEffect(() => {
    if (visitId) {
      loadJobGraph();
    }
  }, [visitId]);

  const loadJobGraph = async () => {
    if (!visitId) return;

    try {
      setLoading(true);
      setError(null);

      // Try to load existing job graph
      let jobGraphState = await getJobGraphByVisit(visitId);

      // If not found, initialize it
      if (!jobGraphState) {
        const init = await initializeJobGraph(visitId);
        if (init) {
          // Reload after initialization
          jobGraphState = await getJobGraphByVisit(visitId);
        }
      }

      if (jobGraphState) {
        setState(jobGraphState);
        // Load summary
        const summaryData = await getJobGraphSummary(jobGraphState.graph.id);
        setSummary(summaryData);
      } else {
        setError('Failed to load or initialize job graph');
      }
    } catch (err) {
      setError('Failed to load job graph');
      console.error('Error loading job graph:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!state) return;

    try {
      setProcessing(true);
      const result = await processJobGraph(state.graph.id);
      if (result) {
        setSummary(result.summary);
        setCompleteness(result.completeness);
        // Reload full state
        await loadJobGraph();
      }
    } catch (err) {
      console.error('Error processing job graph:', err);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="job-graph-loading">
        <div className="loading-spinner">Loading job graph...</div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="job-graph-error">
        <h2>Error</h2>
        <p>{error || 'Job graph not found'}</p>
        <Link to="/spine/feed" className="btn-secondary">
          ← Back to Feed
        </Link>
      </div>
    );
  }

  const { graph, milestones, facts, decisions, conflicts } = state;

  return (
    <div className="job-graph-view">
      {/* Header */}
      <div className="job-graph-header">
        <div>
          <Link to="/spine/feed" className="back-link">
            ← Back to Feed
          </Link>
          <h1>Job Graph: Property {graph.propertyId.substring(0, 8)}</h1>
          <div className="header-meta">
            <span className={`status-badge status-${graph.status}`}>{graph.status}</span>
            <span className="visit-id">Visit: {graph.visitId.substring(0, 8)}</span>
          </div>
        </div>
        <div className="header-actions">
          <button
            onClick={handleProcess}
            disabled={processing}
            className="btn-primary"
          >
            {processing ? 'Processing...' : 'Run Validation'}
          </button>
        </div>
      </div>

      {/* Overall Confidence */}
      <div className="confidence-section">
        <h3>Overall Confidence</h3>
        <ConfidenceIndicator
          confidence={graph.overallConfidence}
          size="large"
        />
        {summary && (
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-value">{summary.completedMilestones}</span>
              <span className="stat-label">/ {summary.totalMilestones} milestones</span>
            </div>
            <div className="stat">
              <span className="stat-value critical">{summary.criticalConflicts}</span>
              <span className="stat-label">critical conflicts</span>
            </div>
            <div className="stat">
              <span className="stat-value warning">{summary.warningConflicts}</span>
              <span className="stat-label">warnings</span>
            </div>
          </div>
        )}
      </div>

      {/* Milestone Timeline */}
      <div className="milestone-section">
        <h2>Progress</h2>
        <MilestoneTimeline milestones={milestones} />
      </div>

      {/* Tabbed Panels */}
      <div className="panels-section">
        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'facts' ? 'active' : ''}`}
            onClick={() => setActivePanel('facts')}
          >
            Facts ({facts.length})
          </button>
          <button
            className={`panel-tab ${activePanel === 'decisions' ? 'active' : ''}`}
            onClick={() => setActivePanel('decisions')}
          >
            Decisions ({decisions.length})
          </button>
          <button
            className={`panel-tab ${activePanel === 'conflicts' ? 'active' : ''}`}
            onClick={() => setActivePanel('conflicts')}
          >
            Conflicts ({conflicts.filter((c) => !c.resolvedAt).length})
          </button>
        </div>

        <div className="panel-content">
          {activePanel === 'facts' && (
            <FactsPanel facts={facts} jobGraphId={graph.id} onFactAdded={loadJobGraph} />
          )}
          {activePanel === 'decisions' && (
            <DecisionLog decisions={decisions} facts={facts} />
          )}
          {activePanel === 'conflicts' && (
            <ConflictsPanel conflicts={conflicts} />
          )}
        </div>
      </div>

      {/* Completeness & Output Actions */}
      {completeness && (
        <div className="output-section">
          <h2>Ready for Outputs?</h2>
          <div className="readiness-grid">
            <div className={`readiness-card ${completeness.readyForQuote ? 'ready' : 'not-ready'}`}>
              <h3>Quote</h3>
              <div className="readiness-status">
                {completeness.readyForQuote ? '✓ Ready' : '✗ Not Ready'}
              </div>
              {completeness.readyForQuote && (
                <button className="btn-primary">Generate Quote Options</button>
              )}
            </div>

            <div className={`readiness-card ${completeness.readyForPDF ? 'ready' : 'not-ready'}`}>
              <h3>PDF Report</h3>
              <div className="readiness-status">
                {completeness.readyForPDF ? '✓ Ready' : '✗ Not Ready'}
              </div>
              {completeness.readyForPDF && (
                <button className="btn-primary">Generate PDF</button>
              )}
            </div>

            <div className={`readiness-card ${completeness.readyForPortal ? 'ready' : 'not-ready'}`}>
              <h3>Customer Portal</h3>
              <div className="readiness-status">
                {completeness.readyForPortal ? '✓ Ready' : '✗ Not Ready'}
              </div>
              {completeness.readyForPortal && (
                <button className="btn-primary">Generate Portal</button>
              )}
            </div>
          </div>

          {/* Missing Critical Facts */}
          {completeness.missingCriticalFacts.length > 0 && (
            <div className="missing-facts-section">
              <h3>Missing Critical Facts</h3>
              <ul className="missing-facts-list">
                {completeness.missingCriticalFacts.map((missing, index) => (
                  <li key={index}>
                    <strong>{missing.description}</strong>
                    <span className="fact-category">({missing.category}:{missing.key})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
