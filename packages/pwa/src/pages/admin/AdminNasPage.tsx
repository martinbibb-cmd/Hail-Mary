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
import type { AdminSystemStatus, AdminSystemStatusResponse } from '../../types/admin';
import './AdminNasPage.css';

export const AdminNasPage: React.FC = () => {
  const [status, setStatus] = useState<AdminSystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string; output?: string } | null>(null);
  const [runningMigration, setRunningMigration] = useState(false);

  useEffect(() => {
    loadSystemStatus();
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
    </div>
  );
};

export default AdminNasPage;
