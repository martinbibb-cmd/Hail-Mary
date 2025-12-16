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
import './AdminSystem.css';

interface SystemStatus {
  api: {
    version: string;
    nodeVersion: string;
    uptimeSeconds: number;
  };
  db: {
    ok: boolean;
    urlMasked: string;
    latencyMs?: number;
  };
  migrations: {
    ok: boolean;
    lastRunAt?: string | null;
    notes?: string | null;
  };
  config: {
    depotSchemaLoadedFrom: string;
    depotSchemaUsedFallback: boolean;
    checklistConfigLoadedFrom: string;
    checklistConfigUsedFallback: boolean;
  };
  degraded?: {
    [key: string]: boolean;
  };
  degradedSubsystems?: string[];
  degradedNotes?: string[];
  warnings: string[];
}

interface StatusResponse {
  success: boolean;
  data?: SystemStatus;
  error?: string;
}

interface MigrateResponse {
  success: boolean;
  message?: string;
  output?: string;
  error?: string;
  details?: string;
}

// Constants
const REFRESH_DELAY_MS = 1000;

export const AdminSystem: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system/status', {
        credentials: 'include',
      });
      const data: StatusResponse = await res.json();
      
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
  const isConfigHealthy = !status.config.depotSchemaUsedFallback && !status.config.checklistConfigUsedFallback;

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

      {/* Degraded Subsystems Banner */}
      {status.degradedSubsystems && status.degradedSubsystems.length > 0 && (
        <div className="admin-warnings" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
          <p className="admin-warnings-title">⚠️ Degraded Subsystems</p>
          <ul className="admin-warnings-list">
            {status.degradedSubsystems.map((subsystem, idx) => (
              <li key={idx}>❌ {subsystem}</li>
            ))}
          </ul>
          {status.degradedNotes && status.degradedNotes.length > 0 && (
            <>
              <p className="admin-warnings-title" style={{ marginTop: '10px' }}>📝 Details:</p>
              <ul className="admin-warnings-list" style={{ fontSize: '12px', color: '#856404' }}>
                {status.degradedNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Warnings Banner */}
      {status.warnings.length > 0 && (
        <div className="admin-warnings">
          <p className="admin-warnings-title">⚠️ System Warnings</p>
          <ul className="admin-warnings-list">
            {status.warnings.map((warning, idx) => (
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
              <span className="admin-stat-value">{status.api.version}</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-label">Node.js:</span>
              <span className="admin-stat-value">{status.api.nodeVersion}</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-label">Uptime:</span>
              <span className="admin-stat-value">{formatUptime(status.api.uptimeSeconds)}</span>
            </div>
          </div>
        </div>

        {/* Database Card */}
        <div className={`admin-card ${status.db.ok ? 'healthy' : 'unhealthy'}`}>
          <h4 className="admin-card-title">
            {status.db.ok ? '✅' : '❌'} Database
          </h4>
          <div className="admin-card-content">
            <div className="admin-stat">
              <span className="admin-stat-label">Status:</span>
              <span className="admin-stat-value">
                {status.db.ok ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {status.db.latencyMs !== undefined && (
              <div className="admin-stat">
                <span className="admin-stat-label">Latency:</span>
                <span className="admin-stat-value">{status.db.latencyMs}ms</span>
              </div>
            )}
            <div className="admin-stat">
              <span className="admin-stat-label">URL:</span>
              <span className="admin-stat-value admin-stat-mono">{status.db.urlMasked}</span>
            </div>
          </div>
        </div>

        {/* Migrations Card */}
        <div className={`admin-card ${status.migrations.ok ? 'healthy' : 'warning'}`}>
          <h4 className="admin-card-title">
            {status.migrations.ok ? '✅' : '⚠️'} Migrations
          </h4>
          <div className="admin-card-content">
            <div className="admin-stat">
              <span className="admin-stat-label">Status:</span>
              <span className="admin-stat-value">
                {status.migrations.ok ? 'Initialized' : 'Not initialized'}
              </span>
            </div>
            {status.migrations.lastRunAt && (
              <div className="admin-stat">
                <span className="admin-stat-label">Last run:</span>
                <span className="admin-stat-value">
                  {new Date(status.migrations.lastRunAt).toLocaleString()}
                </span>
              </div>
            )}
            {status.migrations.notes && (
              <div className="admin-stat">
                <span className="admin-stat-label">Notes:</span>
                <span className="admin-stat-value admin-stat-notes">
                  {status.migrations.notes}
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
              <span className="admin-stat-label">Depot Schema:</span>
              <span className="admin-stat-value">
                {status.config.depotSchemaLoadedFrom}
                {status.config.depotSchemaUsedFallback && ' (fallback)'}
              </span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-label">Checklist Config:</span>
              <span className="admin-stat-value">
                {status.config.checklistConfigLoadedFrom}
                {status.config.checklistConfigUsedFallback && ' (fallback)'}
              </span>
            </div>
          </div>
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
