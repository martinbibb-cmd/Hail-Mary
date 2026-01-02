/**
 * Admin Bug Dashboard Page
 *
 * Main dashboard for bug reporting system:
 * - Quick stats overview
 * - 7-day trend chart
 * - Breakdown by type
 * - Bugs needing attention
 * - Overdue bugs list
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './AdminBugDashboardPage.css';

interface BugStats {
  statusCounts: Array<{ status: string; count: number }>;
  priorityCounts: Array<{ priority: string; count: number }>;
  typeCounts: Array<{ bugType: string; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
  needsAttention: any[];
  overdueBugs: any[];
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#FF3B30',
  high: '#FF9500',
  medium: '#FFCC00',
  low: '#34C759',
};

const TYPE_COLORS: Record<string, string> = {
  bug: '#FF3B30',
  feature: '#007AFF',
  improvement: '#34C759',
  question: '#AF52DE',
};

const TYPE_ICONS: Record<string, string> = {
  bug: '🐛',
  feature: '✨',
  improvement: '🔧',
  question: '❓',
};

const PRIORITY_ICONS: Record<string, string> = {
  critical: '🔴',
  high: '🟡',
  medium: '🟢',
  low: '⚪',
};

export const AdminBugDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<BugStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    loadStats();
  }, [days]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bug-reports/stats?days=${days}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (data.success && data.data) {
        setStats(data.data);
      } else {
        setError(data.error || 'Failed to load statistics');
      }
    } catch (err) {
      setError('Failed to load statistics');
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityCount = (priority: string): number => {
    return stats?.priorityCounts.find((p) => p.priority === priority)?.count || 0;
  };

  const getStatusCount = (status: string): number => {
    return stats?.statusCounts.find((s) => s.status === status)?.count || 0;
  };

  const getTypeCount = (type: string): number => {
    return stats?.typeCounts.find((t) => t.bugType === type)?.count || 0;
  };

  const getTotalResolved = (): number => {
    return getStatusCount('resolved') + getStatusCount('closed');
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="loading-state">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="alert alert-error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="page-header">
          <h1>Bug Reporting Dashboard</h1>
          <div className="header-actions">
            <Link to="/admin/bugs" className="btn-primary">
              View All Bugs
            </Link>
            <Link to="/admin/bugs/analytics" className="btn-secondary">
              Analytics
            </Link>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card stat-critical">
            <div className="stat-icon">{PRIORITY_ICONS.critical}</div>
            <div className="stat-value">{getPriorityCount('critical')}</div>
            <div className="stat-label">Critical</div>
          </div>
          <div className="stat-card stat-high">
            <div className="stat-icon">{PRIORITY_ICONS.high}</div>
            <div className="stat-value">{getPriorityCount('high')}</div>
            <div className="stat-label">High Priority</div>
          </div>
          <div className="stat-card stat-medium">
            <div className="stat-icon">{PRIORITY_ICONS.medium}</div>
            <div className="stat-value">{getPriorityCount('medium')}</div>
            <div className="stat-label">Medium</div>
          </div>
          <div className="stat-card stat-resolved">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{getTotalResolved()}</div>
            <div className="stat-label">Resolved</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="charts-row">
          {/* Daily Trend Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <h2>📈 Submission Trend</h2>
              <div className="chart-controls">
                <button
                  className={`btn-chart ${days === 7 ? 'active' : ''}`}
                  onClick={() => setDays(7)}
                >
                  7 days
                </button>
                <button
                  className={`btn-chart ${days === 14 ? 'active' : ''}`}
                  onClick={() => setDays(14)}
                >
                  14 days
                </button>
                <button
                  className={`btn-chart ${days === 30 ? 'active' : ''}`}
                  onClick={() => setDays(30)}
                >
                  30 days
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats?.dailyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 119, 91, 0.1)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'rgba(60, 50, 40, 0.7)' }}
                />
                <YAxis tick={{ fontSize: 12, fill: 'rgba(60, 50, 40, 0.7)' }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#6b8e23"
                  strokeWidth={2}
                  dot={{ fill: '#6b8e23', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bug Type Breakdown */}
          <div className="chart-card">
            <div className="chart-header">
              <h2>🎯 By Type</h2>
            </div>
            <div className="type-breakdown">
              {['bug', 'feature', 'improvement', 'question'].map((type) => {
                const count = getTypeCount(type);
                return (
                  <div key={type} className="type-item">
                    <div className="type-info">
                      <span className="type-icon">{TYPE_ICONS[type]}</span>
                      <span className="type-name">{type.charAt(0).toUpperCase() + type.slice(1)}s</span>
                    </div>
                    <div className="type-count" style={{ color: TYPE_COLORS[type] }}>
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Needs Attention & Overdue Bugs */}
        <div className="bugs-row">
          {/* Needs Attention */}
          <div className="bugs-card">
            <div className="bugs-card-header">
              <h2>🚨 Needs Attention</h2>
              <span className="badge">{stats?.needsAttention.length || 0}</span>
            </div>
            <div className="bugs-list">
              {stats?.needsAttention.length === 0 ? (
                <div className="empty-state">All caught up! 🎉</div>
              ) : (
                stats?.needsAttention.map((bug) => (
                  <Link
                    key={bug.id}
                    to={`/admin/bugs/${bug.id}`}
                    className="bug-item"
                  >
                    <div className="bug-priority" style={{ background: PRIORITY_COLORS[bug.priority] }} />
                    <div className="bug-info">
                      <div className="bug-title">
                        {TYPE_ICONS[bug.bugType]} {bug.title}
                      </div>
                      <div className="bug-meta">
                        {bug.status} • {new Date(bug.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Overdue Bugs */}
          <div className="bugs-card">
            <div className="bugs-card-header">
              <h2>⏰ Overdue (7+ days)</h2>
              <span className="badge">{stats?.overdueBugs.length || 0}</span>
            </div>
            <div className="bugs-list">
              {stats?.overdueBugs.length === 0 ? (
                <div className="empty-state">Nothing overdue! ✨</div>
              ) : (
                stats?.overdueBugs.map((bug) => (
                  <Link
                    key={bug.id}
                    to={`/admin/bugs/${bug.id}`}
                    className="bug-item"
                  >
                    <div className="bug-priority" style={{ background: PRIORITY_COLORS[bug.priority] }} />
                    <div className="bug-info">
                      <div className="bug-title">
                        {TYPE_ICONS[bug.bugType]} {bug.title}
                      </div>
                      <div className="bug-meta">
                        {bug.status} • {Math.floor((Date.now() - new Date(bug.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days ago
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
