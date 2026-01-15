/**
 * Admin NAS Page
 * 
 * Provides NAS management interface for admin users:
 * - System status overview
 * - Host-side deployment playbooks for Unraid
 * - Manual database migration fallback
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { APP_VERSION } from '../../constants';
import { AdminApiStatus } from '../../components/AdminApiStatus';
import type { 
  AdminSystemStatus, 
  AdminSystemStatusResponse,
  AdminVersionResponse,
  AdminHealthResponse 
} from '../../types/admin';
import './AdminNasPage.css';

export const AdminNasPage: React.FC = () => {
  const [status, setStatus] = useState<AdminSystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string; output?: string } | null>(null);
  const [runningMigration, setRunningMigration] = useState(false);
  
  // Admin agent capability detection
  const [agentAvailable, setAgentAvailable] = useState<boolean | null>(null);
  
  // System update state
  const [versionInfo, setVersionInfo] = useState<AdminVersionResponse | null>(null);
  const [checkingVersion, setCheckingVersion] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateComplete, setUpdateComplete] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [healthInfo, setHealthInfo] = useState<AdminHealthResponse | null>(null);

  useEffect(() => {
    loadSystemStatus();
    checkAdminAgentAvailability();
  }, []);

  const loadSystemStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system/status', {
        credentials: 'include',
      });
      const data: AdminSystemStatusResponse = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (data.success) {
        setStatus(data.data || null);
      } else {
        setError(data.error || 'Failed to get system status');
      }
    } catch (err) {
      setError('Failed to get system status');
      console.error('Error getting system status:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkAdminAgentAvailability = async () => {
    try {
      const res = await fetch('/api/admin/system/version', {
        credentials: 'include',
      });
      
      // If we get a 200 response, admin-agent is available
      if (res.ok) {
        setAgentAvailable(true);
        const data: AdminVersionResponse = await res.json();
        setVersionInfo(data);
      } else if (res.status === 503 || res.status === 502 || res.status === 404) {
        // Admin agent not configured or not reachable
        setAgentAvailable(false);
      } else {
        // Other errors (401, 403, etc.) - agent might be available but auth failed
        setAgentAvailable(false);
      }
    } catch (err) {
      console.error('Failed to check admin agent availability:', err);
      setAgentAvailable(false);
    }
  };

  const checkVersion = async () => {
    setCheckingVersion(true);
    try {
      const res = await fetch('/api/admin/system/version', {
        credentials: 'include',
      });
      
      if (res.ok) {
        const data: AdminVersionResponse = await res.json();
        setVersionInfo(data);
      } else {
        console.error('Failed to check version: HTTP', res.status);
      }
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
      
      if (res.ok) {
        const data: AdminHealthResponse = await res.json();
        setHealthInfo(data);
      } else {
        console.error('Failed to check health: HTTP', res.status);
      }
    } catch (err) {
      console.error('Failed to check health:', err);
    }
  };

  const closeUpdateModal = () => {
    setShowUpdateModal(false);
    // Refresh status and version after closing modal
    setTimeout(() => {
      loadSystemStatus();
      checkVersion();
    }, 1000);
  };

  const handleRunMigrations = async () => {
    if (!confirm('This will run database migrations. Continue?')) {
      return;
    }

    setRunningMigration(true);
    setError(null);
    setMigrationResult(null);

    try {
      const res = await fetch('/api/admin/system/migrate', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (data.success) {
        setMigrationResult({
          success: true,
          message: data.message,
          output: data.output || '',
        });
      } else {
        setMigrationResult({
          success: false,
          message: data.error || 'Failed to run migrations',
          output: data.output || data.details || '',
        });
      }
    } catch (err) {
      setError('Failed to run migrations');
      console.error('Error running migrations:', err);
    } finally {
      setRunningMigration(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <p>Loading system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="page-header">
          <h1>🖥️ NAS Management</h1>
          <Link to="/" className="btn-secondary">← Back to Dashboard</Link>
        </div>

        <p className="page-subtitle">Review NAS health and follow the host-level deployment playbooks.</p>

        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        <AdminApiStatus
          status={status}
          loading={loading}
          error={error}
          onRefresh={loadSystemStatus}
          fetchOnMount={false}
        />

        {status && (
          <div className="status-section">
            <h2>System Status</h2>
            <div className="status-grid">
              <div className="status-card">
                <h3>🗄️ Database</h3>
                <div className="status-icon">
                  {status.db?.ok ? '✅' : '❌'}
                </div>
                <div className="status-detail">
                  {status.db?.ok ? `Latency: ${status.db.latencyMs}ms` : 'Disconnected'}
                </div>
              </div>

              <div className="status-card">
                <h3>📦 API</h3>
                <div className="status-detail">
                  v{status.api?.version || status.app?.version || APP_VERSION}
                </div>
                <div className="status-detail">
                  Node {status.api?.nodeVersion || 'unknown'}
                </div>
                <div className="status-detail">
                  Uptime: {status.api?.uptimeSeconds ? Math.floor(status.api.uptimeSeconds / 60) + 'm' : 'unknown'}
                </div>
              </div>

              <div className="status-card">
                <h3>🔄 Migrations</h3>
                <div className="status-icon">
                  {status.migrations?.ok ? '✅' : '⚠️'}
                </div>
                <div className="status-detail">
                  {status.migrations?.ok ? 'Up to date' : 'Not initialized'}
                </div>
              </div>
            </div>

            {status.degradedSubsystems && status.degradedSubsystems.length > 0 && (
              <div className="alert alert-warning">
                <strong>⚠️ Degraded Subsystems:</strong>
                <ul>
                  {status.degradedSubsystems.map((subsystem, idx) => (
                    <li key={idx}>❌ {subsystem}</li>
                  ))}
                </ul>
                {status.degradedNotes && status.degradedNotes.length > 0 && (
                  <div>
                    <strong>📝 Details:</strong>
                    <ul>
                      {status.degradedNotes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {status.warnings && status.warnings.length > 0 && (
              <div className="alert alert-warning">
                <strong>⚠️ Warnings:</strong>
                <ul>
                  {status.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Environment:</span>
                <span className="info-value">{status.isDocker ? '🐳 Docker' : '💻 Native'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">NAS Auth Mode:</span>
                <span className="info-value">{status.nasAuthMode ? '✅ Enabled' : '❌ Disabled'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Last Check:</span>
                <span className="info-value">
                  {status.timestamp ? new Date(status.timestamp).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="actions-section">
          {agentAvailable === null ? (
            // Still checking agent availability
            <div className="alert alert-info">
              <strong>Checking system capabilities...</strong>
            </div>
          ) : agentAvailable ? (
            // Admin agent is available - show update UI
            <>
              <h2>🚀 System Updates</h2>
              <p className="playbook-copy">
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
                        <strong>{svc.service}:</strong>{' '}
                        {svc.updateAvailable && svc.currentDigest && svc.latestDigest ? (
                          <span className="admin-version-service-status update">
                            {svc.currentDigest} → {svc.latestDigest}
                          </span>
                        ) : svc.error ? (
                          <span className="admin-version-service-status error">
                            {svc.error}
                          </span>
                        ) : svc.currentDigest ? (
                          <span>
                            {svc.currentDigest}
                          </span>
                        ) : (
                          <span className="admin-version-service-status unknown">
                            Unknown
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
                  className="btn-secondary"
                  onClick={checkVersion}
                  disabled={checkingVersion}
                >
                  {checkingVersion ? '⏳ Checking...' : '🔍 Check for Updates'}
                </button>
                <button
                  className="btn-primary"
                  onClick={handleUpdate}
                  disabled={updating || !versionInfo}
                >
                  {updating ? '⏳ Updating...' : '⬇️ Update System'}
                </button>
              </div>
            </>
          ) : (
            // Admin agent not available - show host-first deployment message
            <>
              <div className="alert alert-warning">
                <strong>Host-first deployment</strong>
                <div>Updates now run on the NAS itself using the safe update/auto-update scripts. The web UI stays read-only to avoid docker-in-docker failures.</div>
              </div>

              <h2>Deployment Playbooks</h2>
              <div className="playbooks-grid">
                <div className="playbook-card">
                  <h3>⭐ Safe update (Unraid)</h3>
                  <p className="playbook-copy">Run the end-to-end updater that pulls images, runs migrations, restarts services, and performs health checks.</p>
                  <ol className="playbook-steps">
                    <li>Open an Unraid terminal or SSH into your NAS</li>
                    <li>cd /mnt/user/appdata/hailmary</li>
                    <li>bash ./scripts/unraid-safe-update.sh</li>
                  </ol>
                  <p className="playbook-note">Use after pushing new images or when you need a manual refresh.</p>
                </div>

                <div className="playbook-card">
                  <h3>♻️ Enable scheduled auto-updates</h3>
                  <p className="playbook-copy">Keep the NAS aligned with the roadmap by checking for fresh images on a schedule.</p>
                  <ol className="playbook-steps">
                    <li>cd /mnt/user/appdata/hailmary</li>
                    <li>bash ./scripts/setup-unraid-autoupdate.sh --interval "0 * * * *"</li>
                  </ol>
                  <p className="playbook-note">Installs the cron-backed updater that applies images and migrations hourly.</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="actions-section">
          <h2>Database Migrations</h2>
          <p className="playbook-copy">Safe update already runs migrations automatically. Use this button only for troubleshooting or if you need to re-run the latest migration set.</p>

          {migrationResult && (
            <div className={`alert ${migrationResult.success ? 'alert-success' : 'alert-error'}`}>
              {migrationResult.message}
            </div>
          )}

          <button
            className="btn-primary btn-block"
            onClick={handleRunMigrations}
            disabled={runningMigration}
          >
            {runningMigration ? '🔄 Running...' : '🗄️ Run Database Migrations'}
          </button>

          {migrationResult?.output && (
            <div className="output-section">
              <h3>Migration Output</h3>
              <pre className="output-display">{migrationResult.output}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Update Modal */}
      {showUpdateModal && (
        <div 
          className="admin-modal-overlay" 
          onClick={updateComplete ? closeUpdateModal : undefined}
        >
          <div 
            className="admin-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <h4>🚀 System Update</h4>

            <div className="admin-update-log">
              {updateLogs.map((log, idx) => (
                <div key={idx} className="admin-update-log-line">
                  {log}
                </div>
              ))}
            </div>

            {updateComplete && (
              <div 
                className={`admin-update-status ${updateSuccess ? 'success' : 'error'}`}
              >
                <p>
                  {updateSuccess ? '✅' : '❌'}
                  {' '}
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
                    <div 
                      key={idx} 
                      className={`admin-health-service ${svc.healthy ? 'healthy' : 'unhealthy'}`}
                    >
                      <span>{svc.healthy ? '✅' : '❌'}</span>
                      <span className="admin-health-service-name">{svc.name}</span>
                      <span className="admin-health-service-state">
                        {svc.state}
                      </span>
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
                <button 
                  className="btn-primary" 
                  onClick={closeUpdateModal}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNasPage;
