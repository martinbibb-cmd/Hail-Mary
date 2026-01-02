/**
 * Admin Bug Analytics Page
 *
 * Detailed analytics and insights:
 * - Browser/device breakdown
 * - Top error messages
 * - Most active reporters
 * - Resolution time analysis
 * - Bugs by URL
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './AdminBugAnalyticsPage.css';

interface AnalyticsData {
  browserBreakdown: Array<{ userAgent: string; count: number }>;
  topErrors: Array<{ errorMessage: string; count: number }>;
  topReporters: Array<{ userId: number; count: number }>;
  resolutionTimes: Array<{ priority: string; avgResolutionDays: number }>;
  bugsByUrl: Array<{ url: string; count: number }>;
}

const CHART_COLORS = ['#6b8e23', '#556b2f', '#8b7d6b', '#c9b59a', '#8e8e93'];

export const AdminBugAnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/bug-reports/analytics', {
        credentials: 'include',
      });
      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (data.success && data.data) {
        setAnalytics(data.data);
      } else {
        setError(data.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError('Failed to load analytics');
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseBrowser = (userAgent: string): string => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  };

  const parseDevice = (userAgent: string): string => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) return 'Mobile';
    if (userAgent.includes('Tablet') || userAgent.includes('iPad')) return 'Tablet';
    return 'Desktop';
  };

  const getBrowserData = () => {
    if (!analytics?.browserBreakdown) return [];

    const browserCounts: Record<string, number> = {};
    analytics.browserBreakdown.forEach((item) => {
      const browser = parseBrowser(item.userAgent || '');
      browserCounts[browser] = (browserCounts[browser] || 0) + item.count;
    });

    return Object.entries(browserCounts).map(([name, value]) => ({
      name,
      value,
    }));
  };

  const getDeviceData = () => {
    if (!analytics?.browserBreakdown) return [];

    const deviceCounts: Record<string, number> = {};
    analytics.browserBreakdown.forEach((item) => {
      const device = parseDevice(item.userAgent || '');
      deviceCounts[device] = (deviceCounts[device] || 0) + item.count;
    });

    return Object.entries(deviceCounts).map(([name, value]) => ({
      name,
      value,
    }));
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="loading-state">Loading analytics...</div>
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

  const browserData = getBrowserData();
  const deviceData = getDeviceData();

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="page-header">
          <h1>Bug Analytics</h1>
          <div className="header-actions">
            <Link to="/admin/bugs/dashboard" className="btn-secondary">
              ← Dashboard
            </Link>
            <Link to="/admin/bugs" className="btn-primary">
              View All Bugs
            </Link>
          </div>
        </div>

        {/* Browser & Device Analysis */}
        <div className="analytics-row">
          <div className="chart-card">
            <h2>🌐 Browser Breakdown</h2>
            {browserData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={browserData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {browserData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No browser data available</div>
            )}
          </div>

          <div className="chart-card">
            <h2>📱 Device Breakdown</h2>
            {deviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {deviceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No device data available</div>
            )}
          </div>
        </div>

        {/* Resolution Times */}
        <div className="analytics-row">
          <div className="chart-card full-width">
            <h2>⏱️ Average Resolution Time by Priority</h2>
            {analytics && analytics.resolutionTimes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.resolutionTimes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 119, 91, 0.1)" />
                  <XAxis
                    dataKey="priority"
                    tick={{ fontSize: 12, fill: 'rgba(60, 50, 40, 0.7)' }}
                  />
                  <YAxis
                    label={{ value: 'Days', angle: -90, position: 'insideLeft' }}
                    tick={{ fontSize: 12, fill: 'rgba(60, 50, 40, 0.7)' }}
                  />
                  <Tooltip />
                  <Bar dataKey="avgResolutionDays" fill="#6b8e23" name="Avg Days to Resolve" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No resolution time data available</div>
            )}
          </div>
        </div>

        {/* Top Errors & URLs */}
        <div className="analytics-row">
          <div className="list-card">
            <h2>🚨 Top Error Messages</h2>
            <div className="analytics-list">
              {analytics && analytics.topErrors.length > 0 ? (
                analytics.topErrors.slice(0, 10).map((error, index) => (
                  <div key={index} className="analytics-list-item">
                    <div className="list-rank">{index + 1}</div>
                    <div className="list-content">
                      <div className="list-text" title={error.errorMessage}>
                        {truncateText(error.errorMessage || 'Unknown Error', 80)}
                      </div>
                      <div className="list-count">{error.count} occurrences</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">No error data available</div>
              )}
            </div>
          </div>

          <div className="list-card">
            <h2>📍 Bugs by Page/URL</h2>
            <div className="analytics-list">
              {analytics && analytics.bugsByUrl.length > 0 ? (
                analytics.bugsByUrl.slice(0, 10).map((item, index) => (
                  <div key={index} className="analytics-list-item">
                    <div className="list-rank">{index + 1}</div>
                    <div className="list-content">
                      <div className="list-text" title={item.url}>
                        {truncateText(item.url || 'Unknown URL', 60)}
                      </div>
                      <div className="list-count">{item.count} bugs</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">No URL data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Top Reporters */}
        <div className="analytics-row">
          <div className="list-card full-width">
            <h2>👥 Most Active Reporters</h2>
            <div className="analytics-list horizontal">
              {analytics && analytics.topReporters.length > 0 ? (
                analytics.topReporters.slice(0, 10).map((reporter, index) => (
                  <div key={index} className="reporter-card">
                    <div className="reporter-rank">#{index + 1}</div>
                    <div className="reporter-id">User {reporter.userId}</div>
                    <div className="reporter-count">{reporter.count} reports</div>
                  </div>
                ))
              ) : (
                <div className="empty-state">No reporter data available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
