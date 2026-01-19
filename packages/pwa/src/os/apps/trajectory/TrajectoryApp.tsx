/**
 * Trajectory App - Carbon & Cost Projections
 *
 * Shows retrofit journeys with carbon and cost projections
 * Integrates with trajectory engine backend API
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../auth';
import { useSpineStore } from '../../../stores/spineStore';
import { API_BASE } from '../../../config/endpoints';
import './TrajectoryApp.css';

interface Scenario {
  id: string;
  leadId: number;
  name: string;
  description: string | null;
  createdAt: string;
}

interface Journey {
  id: string;
  scenarioId: string;
  name: string;
  description: string | null;
  stages: any;
  createdAt: string;
}

export const TrajectoryApp: React.FC = () => {
  const { user } = useAuth();
  const activeAddress = useSpineStore((s) => s.activeAddress);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'scenarios' | 'journeys' | 'create'>('scenarios');

  useEffect(() => {
    if (user) {
      fetchScenarios();
    }
  }, [user]);

  const fetchScenarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/trajectory/scenarios`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch scenarios');
      }

      const data = await response.json();
      setScenarios(data.data.scenarios || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenarios');
      console.error('Error fetching scenarios:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchJourneysForScenario = async (scenarioId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/trajectory/scenarios/${scenarioId}/journeys`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch journeys');
      }

      const data = await response.json();
      setJourneys(data.data.journeys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journeys');
      console.error('Error fetching journeys:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectScenario = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    fetchJourneysForScenario(scenario.id);
    setView('journeys');
  };

  if (!user) {
    return (
      <div className="trajectory-app">
        <div className="trajectory-error">
          <p>Please log in to view carbon and cost projections.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trajectory-app">
      <div className="trajectory-header">
        <h2>🌱 Carbon & Cost Journey</h2>
        {activeAddress && (
          <div className="trajectory-active-address">
            <span className="label">Active Address:</span>
            <span className="value">{activeAddress.line1}, {activeAddress.postcode}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="trajectory-error">
          <p>{error}</p>
        </div>
      )}

      <div className="trajectory-nav">
        <button
          className={`nav-btn ${view === 'scenarios' ? 'active' : ''}`}
          onClick={() => setView('scenarios')}
        >
          📊 Scenarios
        </button>
        <button
          className={`nav-btn ${view === 'journeys' ? 'active' : ''}`}
          onClick={() => setView('journeys')}
          disabled={!selectedScenario}
        >
          🛤️ Journeys
        </button>
        <button
          className={`nav-btn ${view === 'create' ? 'active' : ''}`}
          onClick={() => setView('create')}
        >
          ➕ Create New
        </button>
      </div>

      {loading ? (
        <div className="trajectory-loading">
          <span className="loading-spinner">⏳</span>
          <p>Loading...</p>
        </div>
      ) : (
        <>
          {view === 'scenarios' && (
            <div className="trajectory-content">
              <div className="section-header">
                <h3>Retrofit Scenarios</h3>
                <p className="section-desc">
                  Select a scenario to view associated retrofit journeys and carbon projections.
                </p>
              </div>

              {scenarios.length === 0 ? (
                <div className="trajectory-empty">
                  <p>No scenarios found. Create a new scenario to get started.</p>
                  <button className="btn-primary" onClick={() => setView('create')}>
                    Create Scenario
                  </button>
                </div>
              ) : (
                <div className="scenarios-grid">
                  {scenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className={`scenario-card ${selectedScenario?.id === scenario.id ? 'selected' : ''}`}
                      onClick={() => handleSelectScenario(scenario)}
                    >
                      <h4>{scenario.name}</h4>
                      {scenario.description && <p className="scenario-desc">{scenario.description}</p>}
                      <div className="scenario-meta">
                        <span className="meta-label">Lead ID:</span>
                        <span className="meta-value">{scenario.leadId}</span>
                      </div>
                      <div className="scenario-meta">
                        <span className="meta-label">Created:</span>
                        <span className="meta-value">{new Date(scenario.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'journeys' && selectedScenario && (
            <div className="trajectory-content">
              <div className="section-header">
                <h3>Retrofit Journeys for "{selectedScenario.name}"</h3>
                <p className="section-desc">
                  View staged retrofit journeys with carbon and cost projections over time.
                </p>
              </div>

              {journeys.length === 0 ? (
                <div className="trajectory-empty">
                  <p>No journeys found for this scenario. Create a journey to see projections.</p>
                  <button className="btn-primary" onClick={() => setView('create')}>
                    Create Journey
                  </button>
                </div>
              ) : (
                <div className="journeys-list">
                  {journeys.map((journey) => (
                    <div key={journey.id} className="journey-card">
                      <h4>{journey.name}</h4>
                      {journey.description && <p className="journey-desc">{journey.description}</p>}
                      <div className="journey-meta">
                        <span className="meta-label">Stages:</span>
                        <span className="meta-value">{journey.stages?.length || 0}</span>
                      </div>
                      <div className="journey-meta">
                        <span className="meta-label">Created:</span>
                        <span className="meta-value">{new Date(journey.createdAt).toLocaleDateString()}</span>
                      </div>
                      <button className="btn-secondary journey-view-btn">
                        View Projections →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'create' && (
            <div className="trajectory-content">
              <div className="section-header">
                <h3>Create New Scenario or Journey</h3>
                <p className="section-desc">
                  Define a retrofit scenario and associated journeys to model carbon and cost projections.
                </p>
              </div>

              <div className="create-placeholder">
                <p>🚧 Scenario and Journey creation UI coming soon.</p>
                <p>
                  Use the trajectory API endpoints directly or wait for the full UI implementation.
                </p>
                <div className="api-info">
                  <h4>Available API Endpoints:</h4>
                  <ul>
                    <li>POST /api/trajectory/scenarios - Create scenario</li>
                    <li>POST /api/trajectory/scenarios/:id/journeys - Create journey</li>
                    <li>POST /api/trajectory/projections/journey - Get projections</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TrajectoryApp;
