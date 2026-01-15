/**
 * AdminSystem Component - NAS Management for Hail-Mary
 * 
 * Admin-only section showing system status and management controls
 * - Database connectivity and latency
 * - Migration status
 * - Configuration loader status
 * - Run migrations button (with confirmation)
 */

import React, { useState, useEffect } from 'react';
import { AdminApiStatus } from '../../../components/AdminApiStatus';
import type { AdminSystemStatus, AdminSystemStatusResponse } from '../../../types/admin';
import './AdminSystem.css';

interface MigrateResponse {
  success: boolean;
  message?: string;
  output?: string;
  error?: string;
  details?: string;
}

interface VersionResponse {
  hasUpdates: boolean;
  services: Array<{
    service: string;
    updateAvailable?: boolean;
    currentDigest?: string;
    latestDigest?: string;
    error?: string;
  }>;
  checkedAt: string;
}

interface HealthResponse {
  healthy: boolean;
  services: Array<{
    name: string;
    state: string;
    healthy: boolean;
  }>;
  checkedAt: string;
}

// Constants
const REFRESH_DELAY_MS = 1000;

export const AdminSystem: React.FC = () => {
  const [status, setStatus] = useState<AdminSystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // System update state
  const [versionInfo, setVersionInfo] = useState<VersionResponse | null>(null);
  const [checkingVersion, setCheckingVersion] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateComplete, setUpdateComplete] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [healthInfo, setHealthInfo] = useState<HealthResponse | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system/status', {
        credentials: 'include',
      });
      const data: AdminSystemStatusResponse = await res.json();
      
      if (data.success && data.data) {
        setStatus(data.data);
      } else {
        setError(data.error || 'Failed to load system status');
      }
    } catch (err) {
      console.error('Failed to fetch system status:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleMigrate = async () => {
    setShowConfirm(false);
    setMigrating(true);
    setMigrateResult(null);
    
    try {
      const res = await fetch('/api/admin/system/migrate', {
        method: 'POST',
        credentials: 'include',
      });
      const data: MigrateResponse = await res.json();
      
      if (data.success) {
        setMigrateResult({
          success: true,
          message: data.message || 'Migrations completed successfully',
        });
        // Refresh status after successful migration
        setTimeout(fetchStatus, REFRESH_DELAY_MS);
      } else {
        setMigrateResult({
          success: false,
          message: data.error || 'Migration failed',
        });
      }
    } catch (err) {
      console.error('Migration error:', err);
      setMigrateResult({
        success: false,
        message: 'Failed to run migrations',
      });
    } finally {
      setMigrating(false);
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const checkVersion = async () => {
    setCheckingVersion(true);
    try {
      const res = await fetch('/api/admin/system/version', {
        credentials: 'include',
      });
      const data: VersionResponse = await res.json();
      setVersionInfo(data);
    } catch (err) {
      console.error('Failed to check version:', err);
    } finally {
      setCheckingVersion(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setUpdateLogs([]);
    setUpdateComplete(false);
    setUpdateSuccess(false);
    setHealthInfo(null);
    setShowUpdateModal(true);

    try {
      const eventSource = new EventSource('/api/admin/system/update/stream', {
        withCredentials: true,
      });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'log') {
            setUpdateLogs(prev => [...prev, data.text]);
          } else if (data.type === 'error') {
            setUpdateLogs(prev => [...prev, `❌ ERROR: ${data.message}\n`]);
          } else if (data.type === 'complete') {
            setUpdateComplete(true);
            setUpdateSuccess(data.success);
            eventSource.close();

            // Check health after update
            if (data.success) {
              setTimeout(checkHealth, 2000);
            }
          }
        } catch (err) {
          console.error('Failed to parse SSE data:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE error:', err);
        setUpdateLogs(prev => [...prev, '❌ Connection error\n']);
        setUpdateComplete(true);
        setUpdateSuccess(false);
        eventSource.close();
      };
    } catch (err) {
      console.error('Update error:', err);
      setUpdateLogs(prev => [...prev, `❌ Failed to start update: ${err}\n`]);
      setUpdateComplete(true);
      setUpdateSuccess(false);
    } finally {
      setUpdating(false);
    }
  };

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/admin/system/health', {
        credentials: 'include',
      });
      const data: HealthResponse = await res.json();
      setHealthInfo(data);
    } catch (err) {
      console.error('Failed to check health:', err);
    }
  };

  const closeUpdateModal = () => {
    setShowUpdateModal(false);
    // Refresh status and version after closing modal
    setTimeout(() => {
      fetchStatus();
      checkVersion();
    }, REFRESH_DELAY_MS);
  };

  useEffect(() => {
    checkVersion();
  }, []);

  if (loading) {
    return (
      <div className="admin-system">
        <h3>🖥️ NAS Management</h3>
        <div className="admin-loading">Loading system status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-system">
        <h3>🖥️ NAS Management</h3>
        <div className="admin-error">
          <p className="admin-error-icon">⚠️</p>
          <p>{error}</p>
          <button className="admin-retry-btn" onClick={fetchStatus}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  // Helper to check if configuration is fully healthy
  const configStatus = status.config || {
    schemaLoadedFrom: 'unknown',
    schemaUsedFallback: false,
    checklistConfigLoadedFrom: 'unknown',
    checklistConfigUsedFallback: false,
  };
  const isConfigHealthy = !configStatus.schemaUsedFallback && !configStatus.checklistConfigUsedFallback;
  const warnings = status.warnings || [];
  const apiInfo = status.api || { version: 'Unknown', nodeVersion: 'n/a', uptimeSeconds: 0 };
  const dbInfo = status.db || { ok: false, urlMasked: 'not configured' };
  const migrationsInfo = status.migrations || { ok: false };

  return (
    <div className="admin-system">
      <div className="admin-header">
        <h3>🖥️ NAS Management</h3>
        <button 
          className="admin-refresh-btn" 
          onClick={fetchStatus}
          title="Refresh status"
        >
          🔄 Refresh
        </button>
      </div>

      <AdminApiStatus
        status={status}
        onRefresh={fetchStatus}
        fetchOnMount={false}
        compact
      />

      {/* Degraded Subsystems Banner */}
      {status.degradedSubsystems && status.degradedSubsystems.length > 0 && (
        <div className="admin-warnings-degraded">
          <p className="admin-warnings-title">⚠️ Degraded Subsystems</p>
          <ul className="admin-warnings-list">
            {status.degradedSubsystems.map((subsystem, idx) => (
              <li key={idx}>❌ {subsystem}</li>
            ))}
          </ul>
          {status.degradedNotes && status.degradedNotes.length > 0 && (
            <div className="admin-degraded-notes">
              <p className="admin-degraded-notes-title">📝 Details:</p>
              <ul className="admin-warnings-list">
                {status.degradedNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="admin-warnings">
          <p className="admin-warnings-title">⚠️ System Warnings</p>
          <ul className="admin-warnings-list">
            {warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Status Cards */}
      <div className="admin-cards">
        {/* API Card */}
        <div className="admin-card">
          <h4 className="admin-card-title">🚀 API Server</h4>
          <div className="admin-card-content">
            <div className="admin-stat">
              <span className="admin-stat-label">Version:</span>
              <span className="admin-stat-value">{apiInfo.version}</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-label">Node.js:</span>
              <span className="admin-stat-value">{apiInfo.nodeVersion}</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-label">Uptime:</span>
              <span className="admin-stat-value">{formatUptime(apiInfo.uptimeSeconds || 0)}</span>
            </div>
          </div>
        </div>

        {/* Database Card */}
        <div className={`admin-card ${dbInfo.ok ? 'healthy' : 'unhealthy'}`}>
          <h4 className="admin-card-title">
            {dbInfo.ok ? '✅' : '❌'} Database
          </h4>
          <div className="admin-card-content">
            <div className="admin-stat">
              <span className="admin-stat-label">Status:</span>
              <span className="admin-stat-value">
                {dbInfo.ok ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {dbInfo.latencyMs !== undefined && (
              <div className="admin-stat">
                <span className="admin-stat-label">Latency:</span>
                <span className="admin-stat-value">{dbInfo.latencyMs}ms</span>
              </div>
            )}
            <div className="admin-stat">
              <span className="admin-stat-label">URL:</span>
              <span className="admin-stat-value admin-stat-mono">{dbInfo.urlMasked}</span>
            </div>
          </div>
        </div>

        {/* Migrations Card */}
        <div className={`admin-card ${migrationsInfo.ok ? 'healthy' : 'warning'}`}>
          <h4 className="admin-card-title">
            {migrationsInfo.ok ? '✅' : '⚠️'} Migrations
          </h4>
          <div className="admin-card-content">
            <div className="admin-stat">
              <span className="admin-stat-label">Status:</span>
              <span className="admin-stat-value">
                {migrationsInfo.ok ? 'Initialized' : 'Not initialized'}
              </span>
            </div>
            {migrationsInfo.lastRunAt && (
              <div className="admin-stat">
                <span className="admin-stat-label">Last run:</span>
                <span className="admin-stat-value">
                  {new Date(migrationsInfo.lastRunAt).toLocaleString()}
                </span>
              </div>
            )}
            {migrationsInfo.notes && (
              <div className="admin-stat">
                <span className="admin-stat-label">Notes:</span>
                <span className="admin-stat-value admin-stat-notes">
                  {migrationsInfo.notes}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Configuration Card */}
        <div className={`admin-card ${isConfigHealthy ? 'healthy' : 'warning'}`}>
          <h4 className="admin-card-title">
            {isConfigHealthy ? '✅' : '⚠️'} Configuration
          </h4>
          <div className="admin-card-content">
            <div className="admin-stat">
              <span className="admin-stat-label">Atlas Schema:</span>
              <span className="admin-stat-value">
                {configStatus.schemaLoadedFrom}
                {configStatus.schemaUsedFallback && ' (default)'}
              </span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-label">Checklist Config:</span>
              <span className="admin-stat-value">
                {configStatus.checklistConfigLoadedFrom}
                {configStatus.checklistConfigUsedFallback && ' (default)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* System Update Actions */}
      <div className="admin-actions">
        <h4>🚀 System Updates</h4>
        <p className="admin-actions-desc">
          Pull latest Docker images and update all services. Updates are pulled from GHCR.
        </p>

        {versionInfo && (
          <div className="admin-version-info">
            {versionInfo.hasUpdates ? (
              <div className="admin-update-badge available">
                ✨ Update available
              </div>
            ) : (
              <div className="admin-update-badge current">
                ✅ Up to date
              </div>
            )}
            <div className="admin-version-details">
              {versionInfo.services.map((svc, idx) => (
                <div key={idx} className="admin-version-service">
                  <span className="admin-version-service-name">{svc.service}:</span>
                  {svc.updateAvailable ? (
                    <span className="admin-version-service-status update">
                      {svc.currentDigest} → {svc.latestDigest}
                    </span>
                  ) : svc.error ? (
                    <span className="admin-version-service-status error">
                      {svc.error}
                    </span>
                  ) : (
                    <span className="admin-version-service-status current">
                      {svc.currentDigest}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="admin-version-checked">
              Checked: {new Date(versionInfo.checkedAt).toLocaleString()}
            </p>
          </div>
        )}

        <div className="admin-update-actions">
          <button
            className="admin-check-btn"
            onClick={checkVersion}
            disabled={checkingVersion}
          >
            {checkingVersion ? '⏳ Checking...' : '🔍 Check for Updates'}
          </button>
          <button
            className="admin-update-btn"
            onClick={handleUpdate}
            disabled={updating || !versionInfo}
          >
            {updating ? '⏳ Updating...' : '⬇️ Update System'}
          </button>
        </div>
      </div>

      {/* Migration Actions */}
      <div className="admin-actions">
        <h4>🔧 Database Actions</h4>
        <p className="admin-actions-desc">
          Run database migrations to update the schema. This is safe to run multiple times.
        </p>

        {migrateResult && (
          <div className={`admin-migrate-result ${migrateResult.success ? 'success' : 'error'}`}>
            <p className="admin-migrate-icon">
              {migrateResult.success ? '✅' : '❌'}
            </p>
            <p>{migrateResult.message}</p>
          </div>
        )}

        <button
          className="admin-migrate-btn"
          onClick={() => setShowConfirm(true)}
          disabled={migrating}
        >
          {migrating ? '⏳ Running migrations...' : '▶️ Run Migrations'}
        </button>
      </div>

      {/* Update Modal */}
      {showUpdateModal && (
        <div className="admin-modal-overlay" onClick={updateComplete ? closeUpdateModal : undefined}>
          <div className="admin-modal admin-update-modal" onClick={(e) => e.stopPropagation()}>
            <h4>🚀 System Update</h4>

            <div className="admin-update-log">
              {updateLogs.map((log, idx) => (
                <div key={idx} className="admin-update-log-line">
                  {log}
                </div>
              ))}
            </div>

            {updateComplete && (
              <div className={`admin-update-status ${updateSuccess ? 'success' : 'error'}`}>
                <p className="admin-update-status-icon">
                  {updateSuccess ? '✅' : '❌'}
                </p>
                <p>
                  {updateSuccess
                    ? 'Update completed successfully'
                    : 'Update failed - check logs above'}
                </p>
              </div>
            )}

            {healthInfo && (
              <div className="admin-health-info">
                <h5>Service Health</h5>
                <div className="admin-health-services">
                  {healthInfo.services.map((svc, idx) => (
                    <div key={idx} className={`admin-health-service ${svc.healthy ? 'healthy' : 'unhealthy'}`}>
                      <span className="admin-health-service-icon">
                        {svc.healthy ? '✅' : '❌'}
                      </span>
                      <span className="admin-health-service-name">{svc.name}</span>
                      <span className="admin-health-service-state">{svc.state}</span>
                    </div>
                  ))}
                </div>
                <p className="admin-health-checked">
                  Checked: {new Date(healthInfo.checkedAt).toLocaleString()}
                </p>
              </div>
            )}

            {updateComplete && (
              <div className="admin-modal-actions">
                <button className="admin-modal-confirm" onClick={closeUpdateModal}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="admin-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Confirm Migration</h4>
            <p>
              Are you sure you want to run database migrations? This will update the database schema to the latest version.
            </p>
            <p className="admin-modal-note">
              This operation is generally safe and idempotent.
            </p>
            <div className="admin-modal-actions">
              <button 
                className="admin-modal-cancel"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="admin-modal-confirm"
                onClick={handleMigrate}
              >
                Run Migrations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
