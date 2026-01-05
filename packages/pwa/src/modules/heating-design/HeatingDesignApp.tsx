/**
 * Heating Design App - Heat Loss & Radiator Selection
 *
 * Mobile-first PWA interface for:
 * - Creating heating design projects
 * - Entering building construction data
 * - Calculating heat loss with full provenance
 * - Selecting radiators
 * - Viewing defensible calculations
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './HeatingDesignApp.css';

interface HeatingProject {
  id: string;
  name: string;
  status: string;
  leadId?: string;
  createdAt: string;
  updatedAt: string;
}

interface HeatLossResult {
  roomId: string;
  fabricLoss: number;
  ventilationLoss: number;
  totalLoss: number;
  requiredOutput: number;
  breakdown: any;
  provenance: any;
  calculatedAt: string;
}

export const HeatingDesignApp: React.FC = () => {
  const { projectId } = useParams();
  const [view, setView] = useState<'list' | 'project' | 'building-data' | 'heat-loss'>('list');
  const [projects, setProjects] = useState<HeatingProject[]>([]);
  const [currentProject, setCurrentProject] = useState<HeatingProject | null>(null);
  const [heatLossResults, setHeatLossResults] = useState<HeatLossResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/heating-design/projects', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to load projects');
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const loadProject = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/heating-design/projects/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to load project');
      const data = await response.json();
      setCurrentProject(data.project);
      setView('project');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    const name = prompt('Enter project name:');
    if (!name) return;

    try {
      setLoading(true);
      const response = await fetch('/api/heating-design/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Failed to create project');
      const project = await response.json();
      setProjects([project, ...projects]);
      setCurrentProject(project);
      setView('building-data');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const calculateHeatLoss = async () => {
    if (!currentProject) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/heating-design/projects/${currentProject.id}/calculate-heat-loss`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to calculate heat loss');
      }
      const data = await response.json();
      setHeatLossResults(data.results);
      setView('heat-loss');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate heat loss');
    } finally {
      setLoading(false);
    }
  };

  const renderProjectList = () => (
    <div className="heating-design-list">
      <div className="heating-design-header">
        <h2>🔥 Heating Design Projects</h2>
        <button className="btn-primary" onClick={createProject}>
          + New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <p className="empty-icon">🏗️</p>
          <p className="empty-title">No heating design projects yet</p>
          <p className="empty-subtitle">
            Create your first project to start designing a heating system
          </p>
          <button className="btn-primary" onClick={createProject}>
            Create First Project
          </button>
        </div>
      ) : (
        <div className="project-list">
          {projects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              onClick={() => loadProject(project.id)}
            >
              <div className="project-info">
                <h3>{project.name}</h3>
                <p className="project-status">{project.status.replace(/_/g, ' ')}</p>
                <p className="project-date">
                  Updated {new Date(project.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="project-action">
                →
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderProjectView = () => {
    if (!currentProject) return null;

    return (
      <div className="heating-design-project">
        <div className="heating-design-header">
          <button className="btn-back" onClick={() => setView('list')}>
            ← Back
          </button>
          <h2>{currentProject.name}</h2>
        </div>

        <div className="project-sections">
          <div className="section-card" onClick={() => setView('building-data')}>
            <div className="section-icon">🏠</div>
            <div className="section-info">
              <h3>Building Data</h3>
              <p>Construction details, U-values, design conditions</p>
            </div>
            <div className="section-action">→</div>
          </div>

          <div className="section-card" onClick={calculateHeatLoss}>
            <div className="section-icon">📊</div>
            <div className="section-info">
              <h3>Calculate Heat Loss</h3>
              <p>EN 12831 calculations with full provenance</p>
            </div>
            <div className="section-action">→</div>
          </div>

          <div className="section-card" onClick={() => setView('heat-loss')}>
            <div className="section-icon">📋</div>
            <div className="section-info">
              <h3>Results & Reports</h3>
              <p>View calculations, confidence scores, assumptions</p>
            </div>
            <div className="section-action">→</div>
          </div>
        </div>

        <div className="project-status-bar">
          <p>Status: <strong>{currentProject.status.replace(/_/g, ' ')}</strong></p>
          <p className="project-updated">
            Last updated: {new Date(currentProject.updatedAt).toLocaleString()}
          </p>
        </div>
      </div>
    );
  };

  const renderBuildingDataView = () => {
    if (!currentProject) return null;

    return (
      <div className="heating-design-building-data">
        <div className="heating-design-header">
          <button className="btn-back" onClick={() => setView('project')}>
            ← Back
          </button>
          <h2>Building Data</h2>
        </div>

        <div className="form-section">
          <h3>Address & Location</h3>
          <div className="form-group">
            <label>Address</label>
            <input type="text" placeholder="Street address" />
          </div>
          <div className="form-group">
            <label>Postcode</label>
            <input type="text" placeholder="Postcode" />
          </div>
        </div>

        <div className="form-section">
          <h3>Construction</h3>
          <div className="form-group">
            <label>Construction Year</label>
            <input type="number" placeholder="e.g., 1985" />
          </div>
          <div className="form-group">
            <label>Wall Construction</label>
            <select>
              <option value="">Select...</option>
              <option value="solid_brick_uninsulated">Solid brick (uninsulated)</option>
              <option value="cavity_uninsulated">Cavity (uninsulated)</option>
              <option value="cavity_full_fill">Cavity (full fill)</option>
              <option value="modern_insulated">Modern (insulated)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Roof Construction</label>
            <select>
              <option value="">Select...</option>
              <option value="uninsulated">Uninsulated</option>
              <option value="loft_insulation_100mm">100mm loft insulation</option>
              <option value="loft_insulation_270mm">270mm loft insulation</option>
            </select>
          </div>
          <div className="form-group">
            <label>Floor Construction</label>
            <select>
              <option value="">Select...</option>
              <option value="solid_uninsulated">Solid (uninsulated)</option>
              <option value="solid_insulated">Solid (insulated)</option>
              <option value="suspended_timber_uninsulated">Suspended timber (uninsulated)</option>
            </select>
          </div>
        </div>

        <div className="form-section">
          <h3>Design Conditions</h3>
          <div className="form-group">
            <label>Outside Design Temperature (°C)</label>
            <input type="number" defaultValue="-3" step="0.1" />
          </div>
          <div className="form-group">
            <label>Air Changes Per Hour</label>
            <input type="number" defaultValue="1.0" step="0.1" />
          </div>
          <div className="form-group">
            <label>Safety Margin (%)</label>
            <input type="number" defaultValue="15" />
          </div>
          <div className="form-group">
            <label>Flow/Return Temperature</label>
            <select>
              <option value="70/50">70/50°C (Traditional)</option>
              <option value="60/40">60/40°C</option>
              <option value="50/30">50/30°C</option>
              <option value="45/35">45/35°C (Heat Pump)</option>
              <option value="35/28">35/28°C (UFH)</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-secondary" onClick={() => setView('project')}>
            Cancel
          </button>
          <button className="btn-primary">
            Save Building Data
          </button>
        </div>
      </div>
    );
  };

  const renderHeatLossView = () => {
    if (!currentProject) return null;

    return (
      <div className="heating-design-heat-loss">
        <div className="heating-design-header">
          <button className="btn-back" onClick={() => setView('project')}>
            ← Back
          </button>
          <h2>Heat Loss Results</h2>
        </div>

        {heatLossResults.length === 0 ? (
          <div className="empty-state">
            <p className="empty-icon">📊</p>
            <p className="empty-title">No calculations yet</p>
            <p className="empty-subtitle">
              Calculate heat loss to see room-by-room results with full provenance
            </p>
            <button className="btn-primary" onClick={calculateHeatLoss}>
              Calculate Now
            </button>
          </div>
        ) : (
          <div className="heat-loss-results">
            <div className="results-summary">
              <div className="summary-card">
                <p className="summary-label">Total Heat Load</p>
                <p className="summary-value">
                  {heatLossResults
                    .reduce((sum, r) => sum + r.requiredOutput, 0)
                    .toFixed(0)} W
                </p>
              </div>
              <div className="summary-card">
                <p className="summary-label">Rooms</p>
                <p className="summary-value">{heatLossResults.length}</p>
              </div>
            </div>

            <div className="room-results">
              {heatLossResults.map((result, idx) => (
                <div key={result.roomId} className="room-result-card">
                  <div className="room-header">
                    <h3>Room {idx + 1}</h3>
                    <span className="room-output">
                      {result.requiredOutput.toFixed(0)} W
                    </span>
                  </div>
                  <div className="room-details">
                    <div className="detail-row">
                      <span>Fabric Loss:</span>
                      <span>{result.fabricLoss.toFixed(0)} W</span>
                    </div>
                    <div className="detail-row">
                      <span>Ventilation Loss:</span>
                      <span>{result.ventilationLoss.toFixed(0)} W</span>
                    </div>
                    <div className="detail-row">
                      <span>Total Loss:</span>
                      <span>{result.totalLoss.toFixed(0)} W</span>
                    </div>
                  </div>
                  {result.provenance && (
                    <details className="provenance-details">
                      <summary>📋 Calculation Provenance</summary>
                      <div className="provenance-content">
                        <div className="provenance-section">
                          <h4>Method</h4>
                          <p>
                            {result.provenance.method} v{result.provenance.methodVersion}
                          </p>
                        </div>
                        {result.provenance.assumptions?.length > 0 && (
                          <div className="provenance-section">
                            <h4>Assumptions ({result.provenance.assumptions.length})</h4>
                            {result.provenance.assumptions.map((a: any, i: number) => (
                              <div key={i} className={`assumption ${a.impact}`}>
                                <span className="assumption-icon">
                                  {a.impact === 'high' ? '⚠️' : a.impact === 'medium' ? '⚡' : 'ℹ️'}
                                </span>
                                <div>
                                  <p className="assumption-desc">{a.description}</p>
                                  <p className="assumption-code">{a.code}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {result.provenance.warnings?.length > 0 && (
                          <div className="provenance-section">
                            <h4>Warnings ({result.provenance.warnings.length})</h4>
                            {result.provenance.warnings.map((w: any, i: number) => (
                              <div key={i} className={`warning ${w.severity}`}>
                                <span className="warning-icon">
                                  {w.severity === 'error' ? '❌' : w.severity === 'warning' ? '⚠️' : 'ℹ️'}
                                </span>
                                <div>
                                  <p className="warning-message">{w.message}</p>
                                  {w.suggestedFix && (
                                    <p className="warning-fix">💡 {w.suggestedFix}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="provenance-section">
                          <h4>Calculated</h4>
                          <p>{new Date(result.calculatedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="heating-design-app">
      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          <span>❌ {error}</span>
          <button>✕</button>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">🔄</div>
        </div>
      )}

      {view === 'list' && renderProjectList()}
      {view === 'project' && renderProjectView()}
      {view === 'building-data' && renderBuildingDataView()}
      {view === 'heat-loss' && renderHeatLossView()}
    </div>
  );
};
