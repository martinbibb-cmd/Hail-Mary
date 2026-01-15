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
import { safeCopyToClipboard } from '../../../utils/clipboard';
import { downloadTextFile, bytesOf, formatBytes } from '../../../utils/download';
import './DiagnosticsApp.css';

interface ConfigProvenance {
  used: 'custom' | 'default' | 'unknown';
  source: 'db' | 'file' | 'env' | 'builtin' | 'unknown';
  expected: string[];
  reason: string;
}

// Type guard to check if error has HTTP error properties (status codes or message)
const hasHttpErrorProps = (err: unknown): err is { status?: number; statusCode?: number; message?: string } => {
  return typeof err === 'object' && err !== null && ('status' in err || 'statusCode' in err || 'message' in err);
};

interface AdminStatusResponse {
  api: {
    version: string;
    nodeVersion: string;
    uptimeSeconds: number;
  };
  db: {
    ok: boolean;
    urlMasked?: string;
    latencyMs?: number;
  };
  migrations: {
    ok: boolean;
    lastRunAt: string | null;
    notes: string | null;
  };
  config: {
    schemaLoadedFrom: string;
    schemaUsedFallback: boolean;
    checklistConfigLoadedFrom: string;
    checklistConfigUsedFallback: boolean;
  };
  degraded: boolean;
  degradedSubsystems: string[];
  degradedNotes: string[];
  warnings: string[];
}

// Union type for API errors that can come from fetch or axios
type ApiError = Error | {
  status?: number;
  statusCode?: number;
  message?: string;
};

interface HealthData {
  apiOk: boolean;
  dbOk: boolean;
  assistantReachable: boolean | null;
  schemaVersion: string | null;
  schemaAligned: boolean;
  missingTables: string[];
  missingColumns: Record<string, string[]>;
  pendingMigrations: string[];
  buildSha: string;
  buildTime: string;
  serverTime: string;
  uptime: number;
  nodeVersion: string;
  environment: string;
  config?: {
    schema: ConfigProvenance;
    checklist: ConfigProvenance;
  };
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
  schemaAligned?: boolean;
  missingColumns?: Record<string, string[]>;
  config?: {
    schema: ConfigProvenance;
    checklist: ConfigProvenance;
  };
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

// Choose a conservative clipboard threshold; iOS can choke on big strings
const CLIPBOARD_MAX_BYTES = 120_000;

export const DiagnosticsApp: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [schema, setSchema] = useState<SchemaData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showConfigDetails, setShowConfigDetails] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  // Memoize the diagnostic bundle to avoid duplicate computation
  const diagnosticBundle = React.useMemo(() => ({
    timestamp: new Date().toISOString(),
    health,
    schema,
    stats,
    configProvenance: health?.config || null,
  }), [health, schema, stats]);

  // Memoize the bundle size check
  const bundleSize = React.useMemo(() => {
    return bytesOf(JSON.stringify(diagnosticBundle, null, 2));
  }, [diagnosticBundle]);

  useEffect(() => {
    loadDiagnostics();
  }, []);

  /**
   * Helper to safely cast error to ApiError type
   */
  const toApiError = (error: unknown): ApiError => {
    if (!error || typeof error !== 'object') {
      return { message: String(error) };
    }
    return error as ApiError;
  };

  /**
   * Helper to check if error message contains specific terms (case-insensitive)
   */
  const errorMessageContains = (err: ApiError, ...terms: string[]): boolean => {
    if (!err) return false;
    const message = err.message?.toLowerCase();
    if (!message) return false;
    return terms.some(term => message.includes(term));
  };

  /**
   * Helper to determine if an error is a 404 Not Found error
   */
  const isNotFoundError = (error: unknown): boolean => {
    if (!error) return false;
    const err = toApiError(error);
    if (hasHttpErrorProps(err)) {
      return err.status === 404 || 
             err.statusCode === 404 ||
             errorMessageContains(err, '404', 'not found');
    }
    return errorMessageContains(err, '404', 'not found');
  };

  /**
   * Helper to determine if an error is an authentication/authorization error
   */
  const isAuthError = (error: unknown): boolean => {
    if (!error) return false;
    const err = toApiError(error);
    if (hasHttpErrorProps(err)) {
      return err.status === 401 || 
             err.status === 403 ||
             err.statusCode === 401 || 
             err.statusCode === 403 ||
             errorMessageContains(err, '401', '403', 'unauthorized', 'forbidden');
    }
    return errorMessageContains(err, '401', '403', 'unauthorized', 'forbidden');
  };

  /**
   * Map admin system status response to diagnostics health data structure
   */
  const mapAdminStatusToHealth = (adminStatus: AdminStatusResponse): HealthData => {
    // Determine source based on whether custom config was used
    const schemaSource: ConfigProvenance['source'] = adminStatus.config?.schemaUsedFallback ? 'builtin' : 'file';
    const checklistSource: ConfigProvenance['source'] = adminStatus.config?.checklistConfigUsedFallback ? 'builtin' : 'file';
    
    return {
      apiOk: true,
      dbOk: adminStatus.db?.ok || false,
      assistantReachable: null, // Admin status doesn't include assistant info
      schemaVersion: null, // Admin status doesn't include schema version
      schemaAligned: false, // Admin status doesn't include schema alignment
      missingTables: [],
      missingColumns: {},
      pendingMigrations: [],
      buildSha: 'unknown',
      buildTime: 'unknown',
      serverTime: new Date().toISOString(),
      uptime: adminStatus.api?.uptimeSeconds || 0,
      nodeVersion: adminStatus.api?.nodeVersion || 'unknown',
      environment: 'unknown',
      config: {
        schema: {
          used: adminStatus.config?.schemaUsedFallback ? 'default' : 'custom',
          source: schemaSource,
          expected: [],
          reason: adminStatus.config?.schemaLoadedFrom || 'unknown',
        },
        checklist: {
          used: adminStatus.config?.checklistConfigUsedFallback ? 'default' : 'custom',
          source: checklistSource,
          expected: [],
          reason: adminStatus.config?.checklistConfigLoadedFrom || 'unknown',
        },
      },
    };
  };

  const loadDiagnostics = async () => {
    setLoading(true);
    setError(null);
    setWarnings([]);
    setUsingFallback(false);

    try {
      // Try diagnostics endpoints first
      try {
        const [healthRes, schemaRes, statsRes] = await Promise.all([
          apiFetch<{ success: boolean; data: HealthData; errors?: Array<{ component: string; message: string }> }>('/api/diagnostics/health'),
          apiFetch<{ success: boolean; data: SchemaData; warnings?: string[] }>('/api/diagnostics/schema'),
          apiFetch<{ success: boolean; data: StatsData; warnings?: string[] }>('/api/diagnostics/stats'),
        ]);

        setHealth(healthRes.data);
        setSchema(schemaRes.data);
        setStats(statsRes.data);

        // Collect warnings from all endpoints
        const allWarnings: string[] = [];
        if (healthRes.errors && healthRes.errors.length > 0) {
          healthRes.errors.forEach(err => allWarnings.push(`${err.component}: ${err.message}`));
        }
        if (schemaRes.warnings && schemaRes.warnings.length > 0) {
          allWarnings.push(...schemaRes.warnings);
        }
        if (statsRes.warnings && statsRes.warnings.length > 0) {
          allWarnings.push(...statsRes.warnings);
        }
        setWarnings(allWarnings);
        return; // Success - don't try fallback
      } catch (diagnosticsError: unknown) {
        // If diagnostics endpoints return 404, try fallback to admin status
        if (isNotFoundError(diagnosticsError)) {
          console.warn('Diagnostics endpoints not available, falling back to admin status endpoint');
          setUsingFallback(true);
          
          // Fall back to admin system status endpoint
          const adminStatusRes = await apiFetch<{ success: boolean; data: AdminStatusResponse }>('/api/admin/system/status');
          
          if (adminStatusRes.success && adminStatusRes.data) {
            // Map admin status to health data structure
            const mappedHealth = mapAdminStatusToHealth(adminStatusRes.data);
            setHealth(mappedHealth);
            
            // Set warnings from admin status
            if (adminStatusRes.data.warnings && adminStatusRes.data.warnings.length > 0) {
              setWarnings([
                'ℹ️ Using fallback endpoint: /api/admin/system/status (diagnostics endpoints not deployed)',
                ...adminStatusRes.data.warnings
              ]);
            } else {
              setWarnings(['ℹ️ Using fallback endpoint: /api/admin/system/status (diagnostics endpoints not deployed)']);
            }
            
            // Note: Schema and stats are not available from admin status
            // Set minimal data to avoid null errors
            setSchema(null);
            setStats(null);
            return;
          }
        }
        
        // If not a 404 or fallback failed, re-throw
        throw diagnosticsError;
      }
    } catch (err: unknown) {
      console.error('Failed to load diagnostics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load diagnostics';
      
      // Provide more specific error message based on error type
      if (isNotFoundError(err)) {
        setError('Diagnostics endpoints are not available. The API container may need to be rebuilt and redeployed.');
      } else if (isAuthError(err)) {
        setError('Access denied. Admin authentication is required to view diagnostics.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const onCopySummary = async () => {
    try {
      // Keep it small + human-readable
      const summary = {
        app: "Atlas",
        time: new Date().toISOString(),
        apiOk: health?.apiOk,
        dbOk: health?.dbOk,
        buildSha: health?.buildSha ?? "unknown",
        nodeVersion: health?.nodeVersion,
        environment: health?.environment,
        schemaAligned: health?.schemaAligned,
        assistantReachable: health?.assistantReachable,
        warnings: warnings.length > 0 ? warnings : [],
      };

      const text = JSON.stringify(summary, null, 2);
      const res = await safeCopyToClipboard(text);

      if (res.ok) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      } else {
        setError(`Failed to copy summary: ${res.error}`);
        setTimeout(() => setError(null), 3000);
      }
    } catch (e: any) {
      console.error('Failed to copy summary:', e);
      setError(e?.message ?? "Failed to copy summary.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const onDownloadDiagnostics = () => {
    try {
      const text = JSON.stringify(diagnosticBundle, null, 2);
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      downloadTextFile(`atlas-diagnostics-${ts}.json`, text, "application/json");
      
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (e: any) {
      console.error('Failed to download diagnostics:', e);
      setError(e?.message ?? "Failed to download diagnostics.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const onCopyFullBundle = async () => {
    try {
      if (bundleSize > CLIPBOARD_MAX_BYTES) {
        // Too big → guide to download instead
        setError(
          `Bundle is ${formatBytes(bundleSize)}. Too large to copy reliably on mobile. Use Download instead.`
        );
        setTimeout(() => setError(null), 5000);
        return;
      }

      const text = JSON.stringify(diagnosticBundle, null, 2);
      const res = await safeCopyToClipboard(text);
      if (res.ok) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      } else {
        setError(`Failed to copy bundle: ${res.error}`);
        setTimeout(() => setError(null), 3000);
      }
    } catch (e: any) {
      console.error('Failed to copy diagnostics:', e);
      setError(e?.message ?? "Failed to copy diagnostics.");
      setTimeout(() => setError(null), 3000);
    }
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
        {usingFallback && (
          <div className="fallback-notice">
            ℹ️ Using fallback endpoint - some diagnostic data unavailable
          </div>
        )}
      </div>

      {/* Status Tiles */}
      <div className="status-tiles">
        <div className={`status-tile status-${getStatusColor(health?.apiOk ?? null)}`}>
          <div className="status-icon">{getStatusEmoji(health?.apiOk ?? null)}</div>
          <div className="status-label">API</div>
          <div className="status-value">{health?.apiOk ? 'Online' : 'Offline'}</div>
        </div>

        <div className={`status-tile status-${getStatusColor(health?.dbOk ?? null)}`}>
          <div className="status-icon">{getStatusEmoji(health?.dbOk ?? null)}</div>
          <div className="status-label">Database</div>
          <div className="status-value">{health?.dbOk ? 'Connected' : 'Disconnected'}</div>
        </div>

        <div className={`status-tile status-${getStatusColor(health?.assistantReachable ?? null)}`}>
          <div className="status-icon">{getStatusEmoji(health?.assistantReachable ?? null)}</div>
          <div className="status-label">Assistant</div>
          <div className="status-value">
            {health?.assistantReachable === null
              ? 'Unknown'
              : health?.assistantReachable
              ? 'Reachable'
              : 'Unreachable'}
          </div>
        </div>

        <div className={`status-tile status-${getStatusColor(health?.schemaAligned ?? false)}`}>
          <div className="status-icon">
            {getStatusEmoji(health?.schemaAligned ?? false)}
          </div>
          <div className="status-label">Schema</div>
          <div className="status-value">
            {health?.schemaAligned
              ? 'Aligned'
              : `${(health?.missingTables?.length || 0) + Object.keys(health?.missingColumns || {}).length} issues`}
          </div>
        </div>
      </div>

      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="diagnostics-section warnings-section">
          <h2>⚠️ Warnings</h2>
          <div className="warnings-list">
            {warnings.map((warning, idx) => (
              <div key={idx} className="warning-item">
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config Provenance */}
      {health?.config && (
        <div className="diagnostics-section">
          <h2>⚙️ Config Provenance</h2>
          <div className="config-provenance-grid">
            <div className="config-item">
              <div className="config-header">
                <span className="config-label">Schema Configuration</span>
                <span className={`config-badge ${health.config.schema.used === 'default' ? 'badge-amber' : 'badge-green'}`}>
                  {health.config.schema.used === 'default' ? '📋 Default' : '✅ Custom'}
                </span>
              </div>
              <div className="config-details">
                <div className="config-detail-item">
                  <span className="detail-label">Source:</span>
                  <span className="detail-value">{health.config.schema.source}</span>
                </div>
                <div className="config-detail-item">
                  <span className="detail-label">Reason:</span>
                  <span className="detail-value">{health.config.schema.reason}</span>
                </div>
                {showConfigDetails && (
                  <div className="config-detail-item">
                    <span className="detail-label">Expected locations:</span>
                    <ul className="expected-list">
                      {health.config.schema.expected.map((loc, idx) => (
                        <li key={idx}>{loc}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="config-item">
              <div className="config-header">
                <span className="config-label">Checklist Configuration</span>
                <span className={`config-badge ${health.config.checklist.used === 'default' ? 'badge-amber' : 'badge-green'}`}>
                  {health.config.checklist.used === 'default' ? '📋 Default' : '✅ Custom'}
                </span>
              </div>
              <div className="config-details">
                <div className="config-detail-item">
                  <span className="detail-label">Source:</span>
                  <span className="detail-value">{health.config.checklist.source}</span>
                </div>
                <div className="config-detail-item">
                  <span className="detail-label">Reason:</span>
                  <span className="detail-value">{health.config.checklist.reason}</span>
                </div>
                {showConfigDetails && (
                  <div className="config-detail-item">
                    <span className="detail-label">Expected locations:</span>
                    <ul className="expected-list">
                      {health.config.checklist.expected.map((loc, idx) => (
                        <li key={idx}>{loc}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <button 
            className="btn-link" 
            onClick={() => setShowConfigDetails(!showConfigDetails)}
          >
            {showConfigDetails ? '▲ Hide expected locations' : '▼ Show expected locations'}
          </button>

          <div className="config-info-note">
            <p>ℹ️ <strong>Note:</strong> Default configuration is normal on fresh installs. Custom configuration is loaded from external files when available.</p>
          </div>
        </div>
      )}

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
            <div className="info-item">
              <span className="info-label">Schema Status:</span>
              <span className="info-value">{health?.schemaAligned ? '✅ Aligned' : '⚠️ Misaligned'}</span>
            </div>
            {schema.missingTables.length > 0 && (
              <div className="info-item warning">
                <span className="info-label">Missing Tables:</span>
                <span className="info-value">{schema.missingTables.join(', ')}</span>
              </div>
            )}
            {health?.missingColumns && Object.keys(health.missingColumns).length > 0 && (
              <div className="info-item warning">
                <span className="info-label">Missing Columns:</span>
                <span className="info-value">
                  {Object.entries(health.missingColumns).map(([table, cols]) => (
                    <div key={table}>
                      {table}: {cols.join(', ')}
                    </div>
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Show message when schema data is not available */}
      {!schema && usingFallback && (
        <div className="diagnostics-section">
          <h2>📋 Database Schema</h2>
          <p className="empty-state">
            Schema information is not available when using the fallback endpoint.
            Redeploy the API container with the latest code to access full diagnostics.
          </p>
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

      {/* Show message when stats data is not available */}
      {!stats && usingFallback && (
        <div className="diagnostics-section">
          <h2>📈 Entity Counts</h2>
          <p className="empty-state">
            Entity counts are not available when using the fallback endpoint.
            Redeploy the API container with the latest code to access full diagnostics.
          </p>
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

      {/* Show message when activity data is not available */}
      {!stats && usingFallback && (
        <div className="diagnostics-section">
          <h2>🕒 Recent Activity</h2>
          <p className="empty-state">
            Recent activity is not available when using the fallback endpoint.
            Redeploy the API container with the latest code to access full diagnostics.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="diagnostics-actions">
        <button className="btn-primary" onClick={loadDiagnostics}>
          🔄 Refresh
        </button>
        <button
          className="btn-secondary"
          onClick={onCopySummary}
          disabled={copySuccess}
        >
          {copySuccess ? '✅ Success!' : '📋 Copy Summary'}
        </button>
        <button
          className="btn-secondary"
          onClick={onDownloadDiagnostics}
          disabled={copySuccess}
        >
          {copySuccess ? '✅ Downloaded!' : '💾 Download Full Bundle'}
        </button>
        <button
          className="btn-secondary"
          onClick={onCopyFullBundle}
          disabled={copySuccess || bundleSize > CLIPBOARD_MAX_BYTES}
        >
          {copySuccess ? '✅ Copied!' : '📋 Copy Full Bundle'}
        </button>
      </div>
    </div>
  );
};

export default DiagnosticsApp;
