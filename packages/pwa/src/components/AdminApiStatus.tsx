import React, { useEffect, useMemo, useState } from 'react';
import type { AdminSystemStatus, AdminSystemStatusResponse } from '../types/admin';
import './AdminApiStatus.css';

interface AdminApiStatusProps {
  status?: AdminSystemStatus | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  /** When true (default) the component will fetch status if no status prop is provided */
  fetchOnMount?: boolean;
  /** Compact layout for embedding inside other admin cards */
  compact?: boolean;
}

const formatUptime = (seconds?: number) => {
  if (!seconds && seconds !== 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const AdminApiStatus: React.FC<AdminApiStatusProps> = ({
  status,
  loading,
  error,
  onRefresh,
  fetchOnMount = true,
  compact = false,
}) => {
  const [internalStatus, setInternalStatus] = useState<AdminSystemStatus | null>(null);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const shouldSelfFetch = !status && fetchOnMount;

  const fetchStatus = async () => {
    if (!shouldSelfFetch) {
      onRefresh?.();
      return;
    }

    setInternalLoading(true);
    setInternalError(null);
    try {
      const res = await fetch('/api/admin/system/status', { credentials: 'include' });
      const data: AdminSystemStatusResponse = await res.json();
      if (!res.ok || !data.success) {
        setInternalError(data.error || 'Failed to load admin API status');
        setInternalStatus(null);
        return;
      }
      setInternalStatus(data.data || null);
    } catch (err) {
      setInternalError('Unable to reach admin API');
      setInternalStatus(null);
    } finally {
      setInternalLoading(false);
    }
  };

  useEffect(() => {
    if (shouldSelfFetch) {
      fetchStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldSelfFetch]);

  const effectiveStatus = status ?? internalStatus;
  const effectiveLoading = loading ?? internalLoading;
  const effectiveError = error ?? internalError;

  const apiHealthy = Boolean(effectiveStatus?.api?.version) && effectiveStatus?.degradedSubsystems?.length !== undefined
    ? (effectiveStatus.degradedSubsystems?.length || 0) === 0
    : true;
  const dbHealthy = effectiveStatus?.db?.ok !== false;
  const migrationHealthy = effectiveStatus?.migrations?.ok !== false;
  const warnings = effectiveStatus?.warnings ?? [];

  const statusTone = useMemo<'ok' | 'warning' | 'error' | 'loading'>(() => {
    if (effectiveLoading) return 'loading';
    if (effectiveError) return 'error';
    if (!apiHealthy || !dbHealthy || !migrationHealthy || warnings.length > 0) return 'warning';
    return 'ok';
  }, [apiHealthy, dbHealthy, migrationHealthy, warnings.length, effectiveError, effectiveLoading]);

  const toneLabel = {
    ok: 'Online',
    warning: 'Degraded',
    error: 'Offline',
    loading: 'Checking…',
  }[statusTone];

  return (
    <div className={`admin-api-status ${compact ? 'admin-api-status--compact' : ''}`}>
      <div className="admin-api-status__header">
        <div>
          <p className="admin-api-status__eyebrow">Admin API</p>
          <h4 className="admin-api-status__title">Runtime status</h4>
        </div>
        <div className={`admin-api-status__pill admin-api-status__pill--${statusTone}`}>
          <span className="admin-api-status__dot" />
          {toneLabel}
        </div>
      </div>

      {effectiveError && (
        <div className="admin-api-status__error">
          <p>{effectiveError}</p>
        </div>
      )}

      {!effectiveError && (
        <div className="admin-api-status__grid">
          <div>
            <p className="admin-api-status__label">API version</p>
            <p className="admin-api-status__value">
              {effectiveStatus?.api?.version || effectiveStatus?.app?.version || 'Unknown'}
            </p>
            <p className="admin-api-status__hint">
              Node {effectiveStatus?.api?.nodeVersion || 'n/a'}
            </p>
          </div>
          <div>
            <p className="admin-api-status__label">Uptime</p>
            <p className="admin-api-status__value">
              {formatUptime(effectiveStatus?.api?.uptimeSeconds)}
            </p>
            <p className="admin-api-status__hint">
              {effectiveStatus?.timestamp ? `Checked ${new Date(effectiveStatus.timestamp).toLocaleTimeString()}` : 'Recent'}
            </p>
          </div>
          <div>
            <p className="admin-api-status__label">Database</p>
            <p className="admin-api-status__value">
              {dbHealthy ? 'Connected' : 'Disconnected'}
            </p>
            <p className="admin-api-status__hint">
              {effectiveStatus?.db?.latencyMs !== undefined ? `${effectiveStatus.db.latencyMs}ms latency` : 'Latency n/a'}
            </p>
          </div>
          <div>
            <p className="admin-api-status__label">Migrations</p>
            <p className="admin-api-status__value">
              {migrationHealthy ? 'Initialized' : 'Needs attention'}
            </p>
            <p className="admin-api-status__hint">
              {effectiveStatus?.migrations?.lastRunAt
                ? `Last run ${new Date(effectiveStatus.migrations.lastRunAt).toLocaleString()}`
                : 'No runs recorded'}
            </p>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="admin-api-status__warnings">
          {warnings.map((warning, idx) => (
            <p key={idx}>⚠️ {warning}</p>
          ))}
        </div>
      )}

      <div className="admin-api-status__footer">
        <button
          className="admin-api-status__refresh"
          onClick={fetchStatus}
          disabled={effectiveLoading}
        >
          {effectiveLoading ? 'Refreshing…' : 'Refresh status'}
        </button>
        <span className="admin-api-status__footer-hint">
          Checks /api/admin/system/status
        </span>
      </div>
    </div>
  );
};
