/**
 * Diagnostics App - Backend Status and Health Monitor
 * 
 * Read-only diagnostic UI that shows:
 * - Health status tiles (API, Assistant, DB, Schema)
 * - Entity counts (users, leads, addresses, etc.)
 * - Recent activity
 * - Copy diagnostic bundle button
 * 
 * Admin-only access.
 */

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../services/apiClient';
import './DiagnosticsApp.css';

interface HealthData {
  apiOk: boolean;
  dbOk: boolean;
  assistantReachable: boolean | null;
  schemaVersion: string;
  buildSha: string;
  buildTime: string;
  serverTime: string;
  uptime: number;
  nodeVersion: string;
  environment: string;
}

interface SchemaData {
  tables: string[];
  expectedTables: string[];
  missingTables: string[];
  tableCount: number;
  migrations: Array<{
    id: number;
    hash: string;
    createdAt: string;
  }> | null;
}

interface StatsData {
  counts: {
    users: number;
    accounts: number;
    leads: number;
    addresses: number;
    addressAppointments: number;
    assets: number;
    visitEvents: number;
    photos: number;
    scans: number;
    files: number;
    spineProperties: number;
    spineVisits: number;
    spineTimelineEvents: number;
    presentationDrafts: number;
    bugReports: number;
  };
  recentActivity: {
    recentLeads: Array<{ id: number; name: string; createdAt: string }>;
    recentAddresses: Array<{ id: number; postcode: string; createdAt: string }>;
    recentVisits: Array<{ id: number; propertyId: number; createdAt: string }>;
  };
}

export const DiagnosticsApp: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [schema, setSchema] = useState<SchemaData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const loadDiagnostics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all diagnostic data in parallel
      const [healthRes, schemaRes, statsRes] = await Promise.all([
        apiFetch<{ success: boolean; data: HealthData }>('/api/diagnostics/health'),
        apiFetch<{ success: boolean; data: SchemaData }>('/api/diagnostics/schema'),
        apiFetch<{ success: boolean; data: StatsData }>('/api/diagnostics/stats'),
      ]);

      setHealth(healthRes.data);
      setSchema(schemaRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load diagnostics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  };

  const copyDiagnosticBundle = () => {
    const bundle = {
      timestamp: new Date().toISOString(),
      health,
      schema,
      stats,
    };

    navigator.clipboard.writeText(JSON.stringify(bundle, null, 2)).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }).catch((err) => {
      console.error('Failed to copy:', err);
      alert('Failed to copy diagnostic bundle');
    });
  };

  if (loading) {
    return (
      <div className="diagnostics-app">
        <div className="diagnostics-loading">
          <span className="loading-spinner">⏳</span>
          <p>Loading diagnostics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="diagnostics-app">
        <div className="diagnostics-error">
          <h2>❌ Error Loading Diagnostics</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={loadDiagnostics}>
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (isOk: boolean | null): string => {
    if (isOk === null) return 'amber';
    return isOk ? 'green' : 'red';
  };

  const getStatusEmoji = (isOk: boolean | null): string => {
    if (isOk === null) return '⚠️';
    return isOk ? '✅' : '❌';
  };

  return (
    <div className="diagnostics-app">
      <div className="diagnostics-header">
        <h1>🔍 System Diagnostics</h1>
        <p className="diagnostics-subtitle">Backend health and data presence monitor</p>
      </div>

      {/* Status Tiles */}
      <div className="status-tiles">
        <div className={`status-tile status-${getStatusColor(health?.apiOk || false)}`}>
          <div className="status-icon">{getStatusEmoji(health?.apiOk || false)}</div>
          <div className="status-label">API</div>
          <div className="status-value">{health?.apiOk ? 'Online' : 'Offline'}</div>
        </div>

        <div className={`status-tile status-${getStatusColor(health?.dbOk || false)}`}>
          <div className="status-icon">{getStatusEmoji(health?.dbOk || false)}</div>
          <div className="status-label">Database</div>
          <div className="status-value">{health?.dbOk ? 'Connected' : 'Disconnected'}</div>
        </div>

        <div className={`status-tile status-${getStatusColor(health?.assistantReachable)}`}>
          <div className="status-icon">{getStatusEmoji(health?.assistantReachable)}</div>
          <div className="status-label">Assistant</div>
          <div className="status-value">
            {health?.assistantReachable === null
              ? 'Unknown'
              : health?.assistantReachable
              ? 'Reachable'
              : 'Unreachable'}
          </div>
        </div>

        <div className={`status-tile status-${getStatusColor(schema?.missingTables?.length === 0)}`}>
          <div className="status-icon">
            {getStatusEmoji(schema?.missingTables?.length === 0 || false)}
          </div>
          <div className="status-label">Schema</div>
          <div className="status-value">
            {schema?.missingTables?.length === 0
              ? 'Complete'
              : `${schema?.missingTables?.length || 0} missing`}
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="diagnostics-section">
        <h2>📊 System Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Environment:</span>
            <span className="info-value">{health?.environment}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Node Version:</span>
            <span className="info-value">{health?.nodeVersion}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Uptime:</span>
            <span className="info-value">{Math.floor((health?.uptime || 0) / 60)} minutes</span>
          </div>
          <div className="info-item">
            <span className="info-label">Build SHA:</span>
            <span className="info-value">{health?.buildSha?.slice(0, 8) || 'unknown'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Build Time:</span>
            <span className="info-value">{health?.buildTime || 'unknown'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Schema Version:</span>
            <span className="info-value">{health?.schemaVersion}</span>
          </div>
        </div>
      </div>

      {/* Schema Info */}
      {schema && (
        <div className="diagnostics-section">
          <h2>📋 Database Schema</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Total Tables:</span>
              <span className="info-value">{schema.tableCount}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Expected Tables:</span>
              <span className="info-value">{schema.expectedTables.length}</span>
            </div>
            {schema.missingTables.length > 0 && (
              <div className="info-item warning">
                <span className="info-label">Missing Tables:</span>
                <span className="info-value">{schema.missingTables.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Entity Counts */}
      {stats && (
        <div className="diagnostics-section">
          <h2>📈 Entity Counts</h2>
          <div className="counts-grid">
            <div className="count-item">
              <span className="count-label">👥 Users</span>
              <span className="count-value">{stats.counts.users}</span>
            </div>
            <div className="count-item">
              <span className="count-label">🏢 Accounts</span>
              <span className="count-value">{stats.counts.accounts}</span>
            </div>
            <div className="count-item">
              <span className="count-label">📋 Leads</span>
              <span className="count-value">{stats.counts.leads}</span>
            </div>
            <div className="count-item">
              <span className="count-label">🏠 Addresses</span>
              <span className="count-value">{stats.counts.addresses}</span>
            </div>
            <div className="count-item">
              <span className="count-label">📅 Appointments</span>
              <span className="count-value">{stats.counts.addressAppointments}</span>
            </div>
            <div className="count-item">
              <span className="count-label">📷 Photos</span>
              <span className="count-value">{stats.counts.photos}</span>
            </div>
            <div className="count-item">
              <span className="count-label">📸 Scans</span>
              <span className="count-value">{stats.counts.scans}</span>
            </div>
            <div className="count-item">
              <span className="count-label">📁 Files</span>
              <span className="count-value">{stats.counts.files}</span>
            </div>
            <div className="count-item">
              <span className="count-label">🎬 Assets</span>
              <span className="count-value">{stats.counts.assets}</span>
            </div>
            <div className="count-item">
              <span className="count-label">🏘️ Properties</span>
              <span className="count-value">{stats.counts.spineProperties}</span>
            </div>
            <div className="count-item">
              <span className="count-label">🚪 Visits</span>
              <span className="count-value">{stats.counts.spineVisits}</span>
            </div>
            <div className="count-item">
              <span className="count-label">📝 Timeline Events</span>
              <span className="count-value">{stats.counts.spineTimelineEvents}</span>
            </div>
            <div className="count-item">
              <span className="count-label">📊 Presentations</span>
              <span className="count-value">{stats.counts.presentationDrafts}</span>
            </div>
            <div className="count-item">
              <span className="count-label">🐛 Bug Reports</span>
              <span className="count-value">{stats.counts.bugReports}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {stats && (
        <div className="diagnostics-section">
          <h2>🕒 Recent Activity</h2>
          
          {stats.recentActivity.recentLeads.length > 0 && (
            <div className="activity-section">
              <h3>Recent Leads</h3>
              <div className="activity-list">
                {stats.recentActivity.recentLeads.map((lead) => (
                  <div key={lead.id} className="activity-item">
                    <span className="activity-name">{lead.name}</span>
                    <span className="activity-date">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.recentActivity.recentAddresses.length > 0 && (
            <div className="activity-section">
              <h3>Recent Addresses</h3>
              <div className="activity-list">
                {stats.recentActivity.recentAddresses.map((address) => (
                  <div key={address.id} className="activity-item">
                    <span className="activity-name">{address.postcode}</span>
                    <span className="activity-date">
                      {new Date(address.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.recentActivity.recentVisits.length > 0 && (
            <div className="activity-section">
              <h3>Recent Visits</h3>
              <div className="activity-list">
                {stats.recentActivity.recentVisits.map((visit) => (
                  <div key={visit.id} className="activity-item">
                    <span className="activity-name">Property #{visit.propertyId}</span>
                    <span className="activity-date">
                      {new Date(visit.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.recentActivity.recentLeads.length === 0 &&
           stats.recentActivity.recentAddresses.length === 0 &&
           stats.recentActivity.recentVisits.length === 0 && (
            <p className="empty-state">No recent activity recorded.</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="diagnostics-actions">
        <button className="btn-primary" onClick={loadDiagnostics}>
          🔄 Refresh
        </button>
        <button
          className="btn-secondary"
          onClick={copyDiagnosticBundle}
          disabled={copySuccess}
        >
          {copySuccess ? '✅ Copied!' : '📋 Copy Diagnostic Bundle'}
        </button>
      </div>
    </div>
  );
};

export default DiagnosticsApp;
