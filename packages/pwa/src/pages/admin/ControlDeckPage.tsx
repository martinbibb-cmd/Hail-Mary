/**
 * Control Deck - Mobile-First Admin Dashboard
 *
 * Simple, functional dashboard for managing Hail Mary / Atlas from a phone.
 * Shows traffic light status indicators and provides quick actions.
 */

import React, { useState, useEffect } from 'react';
import './ControlDeckPage.css';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  summary: string;
  checks: {
    database: {
      connected: boolean;
      latency?: number;
      version?: string;
      error?: string;
    };
    migrations: {
      appliedCount: number;
      availableCount: number;
      pendingMigrations: string[];
    };
    schema: {
      tablesFound: number;
      missingTables: string[];
      extraTables: string[];
    };
    containers?: {
      inDocker: boolean;
      containers?: Array<{
        name: string;
        status: string;
        health?: string;
      }>;
    };
    services: {
      api: ServiceStatus;
      assistant: ServiceStatus;
      pwa: ServiceStatus;
    };
  };
  diagnostics: Array<{
    severity: 'critical' | 'warning' | 'info';
    component: string;
    issue: string;
    fix: string;
  }>;
}

interface ServiceStatus {
  reachable: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

interface DetailedHealthResponse {
  status: string;
  version?: string;
  uptime?: number;
  config?: {
    googleAuthEnabled: boolean;
    nasAuthMode: boolean;
    configSource: string;
  };
  database?: {
    connected: boolean;
    latency: number;
  };
  degraded?: boolean;
  degradedNotes?: string[];
}

export const ControlDeckPage: React.FC = () => {
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [detailedHealth, setDetailedHealth] = useState<DetailedHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');

  useEffect(() => {
    loadHealth();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        loadHealth();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadHealth = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load Rocky health check
      const rockyRes = await fetch('/api/rocky/health', {
        credentials: 'include',
      });

      if (rockyRes.ok) {
        const rockyData = await rockyRes.json();
        setHealth(rockyData);
      } else {
        setError('Failed to load health check');
      }

      // Load detailed health
      const detailedRes = await fetch('/health/detailed', {
        credentials: 'include',
      });

      if (detailedRes.ok) {
        const detailedData = await detailedRes.json();
        setDetailedHealth(detailedData);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Error loading health:', err);
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status?: 'healthy' | 'degraded' | 'unhealthy' | boolean): string => {
    if (typeof status === 'boolean') {
      return status ? 'status-green' : 'status-red';
    }
    switch (status) {
      case 'healthy':
        return 'status-green';
      case 'degraded':
        return 'status-yellow';
      case 'unhealthy':
        return 'status-red';
      default:
        return 'status-gray';
    }
  };

  const getStatusIcon = (status?: 'healthy' | 'degraded' | 'unhealthy' | boolean): string => {
    if (typeof status === 'boolean') {
      return status ? '●' : '●';
    }
    switch (status) {
      case 'healthy':
        return '●';
      case 'degraded':
        return '▲';
      case 'unhealthy':
        return '●';
      default:
        return '○';
    }
  };

  const viewLogs = async (container: string) => {
    setShowLogs(container);
    setLogs('Loading logs...');

    try {
      // In a production environment, you'd have an API endpoint to fetch logs
      // For now, we'll show a placeholder
      setLogs(`Logs for ${container}:\n\nThis feature requires server-side implementation to fetch Docker logs.\n\nTo view logs manually, run:\n  docker logs ${container}`);
    } catch (err) {
      setLogs(`Error loading logs: ${err}`);
    }
  };

  const restartService = async (service: string) => {
    if (!confirm(`Are you sure you want to restart ${service}?`)) {
      return;
    }

    alert(`Restart feature requires server-side implementation.\n\nTo restart manually, run:\n  docker compose restart ${service}`);
  };

  const runBackup = async () => {
    if (!confirm('Are you sure you want to run a backup now?')) {
      return;
    }

    alert('Backup feature requires server-side implementation.\n\nTo backup manually, run:\n  /data/backups/backup.sh');
  };

  if (loading && !health) {
    return (
      <div className="control-deck">
        <div className="control-deck-header">
          <h1>Control Deck</h1>
        </div>
        <div className="control-deck-loading">
          <div className="spinner"></div>
          <p>Loading system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="control-deck">
      <div className="control-deck-header">
        <h1>Control Deck</h1>
        <div className="header-actions">
          <button
            className={`btn-refresh ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
          >
            {autoRefresh ? '🔄' : '⏸'}
          </button>
          <button className="btn-refresh" onClick={loadHealth}>
            Refresh
          </button>
        </div>
      </div>

      {lastUpdated && (
        <div className="last-updated">
          Last updated: {lastUpdated}
        </div>
      )}

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      {health && (
        <>
          {/* Overall Status */}
          <div className={`status-card overall ${getStatusColor(health.status)}`}>
            <div className="status-icon">
              {getStatusIcon(health.status)}
            </div>
            <div className="status-content">
              <h2>{health.status.toUpperCase()}</h2>
              <p>{health.summary}</p>
            </div>
          </div>

          {/* Services Status */}
          <div className="section">
            <h3>Services</h3>

            <div className={`service-card ${getStatusColor(health.checks.services.api.reachable)}`}>
              <div className="service-header">
                <div className="service-name">
                  <span className="status-icon">{getStatusIcon(health.checks.services.api.reachable)}</span>
                  API
                </div>
                {health.checks.services.api.reachable && (
                  <span className="response-time">{health.checks.services.api.responseTime}ms</span>
                )}
              </div>
              <div className="service-actions">
                <button className="btn-small" onClick={() => viewLogs('hailmary-api')}>
                  Logs
                </button>
                <button className="btn-small" onClick={() => restartService('api')}>
                  Restart
                </button>
              </div>
            </div>

            <div className={`service-card ${getStatusColor(health.checks.services.assistant.reachable)}`}>
              <div className="service-header">
                <div className="service-name">
                  <span className="status-icon">{getStatusIcon(health.checks.services.assistant.reachable)}</span>
                  Assistant
                </div>
                {health.checks.services.assistant.reachable && (
                  <span className="response-time">{health.checks.services.assistant.responseTime}ms</span>
                )}
              </div>
              <div className="service-actions">
                <button className="btn-small" onClick={() => viewLogs('hailmary-assistant')}>
                  Logs
                </button>
                <button className="btn-small" onClick={() => restartService('assistant')}>
                  Restart
                </button>
              </div>
            </div>

            <div className={`service-card ${getStatusColor(health.checks.services.pwa.reachable)}`}>
              <div className="service-header">
                <div className="service-name">
                  <span className="status-icon">{getStatusIcon(health.checks.services.pwa.reachable)}</span>
                  PWA
                </div>
                {health.checks.services.pwa.reachable && (
                  <span className="response-time">{health.checks.services.pwa.responseTime}ms</span>
                )}
              </div>
              <div className="service-actions">
                <button className="btn-small" onClick={() => viewLogs('hailmary-pwa')}>
                  Logs
                </button>
                <button className="btn-small" onClick={() => restartService('pwa')}>
                  Restart
                </button>
              </div>
            </div>
          </div>

          {/* Database Status */}
          <div className="section">
            <h3>Database</h3>
            <div className={`info-card ${getStatusColor(health.checks.database.connected)}`}>
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className="info-value">
                  {health.checks.database.connected ? (
                    <>Connected ({health.checks.database.latency}ms)</>
                  ) : (
                    <>Disconnected</>
                  )}
                </span>
              </div>
              {health.checks.database.version && (
                <div className="info-row">
                  <span className="info-label">Version:</span>
                  <span className="info-value">{health.checks.database.version.split(' ').slice(0, 2).join(' ')}</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">Tables:</span>
                <span className="info-value">{health.checks.schema.tablesFound}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Migrations:</span>
                <span className="info-value">
                  {health.checks.migrations.appliedCount} / {health.checks.migrations.availableCount}
                </span>
              </div>
              {health.checks.migrations.pendingMigrations.length > 0 && (
                <div className="warning-box">
                  ⚠ {health.checks.migrations.pendingMigrations.length} pending migrations
                </div>
              )}
            </div>
          </div>

          {/* Containers Status (if available) */}
          {health.checks.containers?.containers && (
            <div className="section">
              <h3>Containers</h3>
              {health.checks.containers.containers.map(container => (
                <div
                  key={container.name}
                  className={`info-card ${getStatusColor(container.status === 'running')}`}
                >
                  <div className="info-row">
                    <span className="info-label">{container.name}:</span>
                    <span className="info-value">
                      {container.status}
                      {container.health && ` (${container.health})`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Diagnostics */}
          {health.diagnostics.length > 0 && (
            <div className="section">
              <h3>Diagnostics</h3>
              {health.diagnostics.map((diag, idx) => (
                <div
                  key={idx}
                  className={`diagnostic-card ${
                    diag.severity === 'critical' ? 'diagnostic-critical' :
                    diag.severity === 'warning' ? 'diagnostic-warning' :
                    'diagnostic-info'
                  }`}
                >
                  <div className="diagnostic-header">
                    <span className="diagnostic-component">{diag.component}</span>
                    <span className="diagnostic-severity">{diag.severity}</span>
                  </div>
                  <div className="diagnostic-issue">{diag.issue}</div>
                  <div className="diagnostic-fix">
                    <strong>Fix:</strong>
                    <pre>{diag.fix}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* System Actions */}
          <div className="section">
            <h3>System Actions</h3>
            <div className="actions-grid">
              <button className="btn-action" onClick={runBackup}>
                💾 Backup Now
              </button>
              <button className="btn-action" onClick={() => window.open('/health/detailed', '_blank')}>
                📊 Detailed Health
              </button>
              <button className="btn-action" onClick={() => alert('Not implemented')}>
                🔄 Update Images
              </button>
              <button className="btn-action btn-danger" onClick={() => {
                if (confirm('Are you sure you want to restart all services?')) {
                  alert('Restart all requires server-side implementation.\n\nTo restart manually:\n  docker compose restart');
                }
              }}>
                ⚠️ Restart All
              </button>
            </div>
          </div>

          {/* Additional System Info */}
          {detailedHealth && (
            <div className="section">
              <h3>System Info</h3>
              <div className="info-card">
                {detailedHealth.version && (
                  <div className="info-row">
                    <span className="info-label">Version:</span>
                    <span className="info-value">{detailedHealth.version}</span>
                  </div>
                )}
                {detailedHealth.uptime && (
                  <div className="info-row">
                    <span className="info-label">Uptime:</span>
                    <span className="info-value">{Math.floor(detailedHealth.uptime / 3600)}h</span>
                  </div>
                )}
                {detailedHealth.config && (
                  <>
                    <div className="info-row">
                      <span className="info-label">Config:</span>
                      <span className="info-value">{detailedHealth.config.configSource}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Google Auth:</span>
                      <span className="info-value">{detailedHealth.config.googleAuthEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div className="modal-overlay" onClick={() => setShowLogs(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Logs: {showLogs}</h3>
              <button className="btn-close" onClick={() => setShowLogs(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <pre className="logs-content">{logs}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
