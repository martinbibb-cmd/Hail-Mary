/**
 * Admin Bug List Page
 *
 * Main bug management interface with:
 * - Filterable/sortable table
 * - Bulk actions
 * - Quick status/priority changes
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './AdminBugListPage.css';

interface BugReport {
  id: string;
  title: string;
  description: string;
  bugType: 'bug' | 'feature' | 'improvement' | 'question';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'investigating' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';
  userId: number;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  bug: '🐛',
  feature: '✨',
  improvement: '🔧',
  question: '❓',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#FF3B30',
  high: '#FF9500',
  medium: '#FFCC00',
  low: '#34C759',
};

const STATUS_COLORS: Record<string, string> = {
  new: '#007AFF',
  investigating: '#FF9500',
  in_progress: '#FFCC00',
  resolved: '#34C759',
  closed: '#8E8E93',
  wont_fix: '#8E8E93',
};

export const AdminBugListPage: React.FC = () => {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection
  const [selectedBugs, setSelectedBugs] = useState<Set<string>>(new Set());

  // Bulk action
  const [bulkAction, setBulkAction] = useState<string>('');
  const [bulkValue, setBulkValue] = useState<string>('');

  useEffect(() => {
    loadBugs();
  }, []);

  const loadBugs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bug-reports?limit=1000', {
        credentials: 'include',
      });
      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (data.success && data.data?.bugReports) {
        setBugs(data.data.bugReports);
      } else {
        setError(data.error || 'Failed to load bug reports');
      }
    } catch (err) {
      setError('Failed to load bug reports');
      console.error('Error loading bugs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedBugs(new Set(filteredAndSortedBugs.map((b) => b.id)));
    } else {
      setSelectedBugs(new Set());
    }
  };

  const handleSelectBug = (bugId: string, checked: boolean) => {
    const newSelected = new Set(selectedBugs);
    if (checked) {
      newSelected.add(bugId);
    } else {
      newSelected.delete(bugId);
    }
    setSelectedBugs(newSelected);
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedBugs.size === 0) return;

    setError(null);
    setSuccess(null);

    try {
      const updates: any = {};
      if (bulkAction === 'status') {
        updates.status = bulkValue;
      } else if (bulkAction === 'priority') {
        updates.priority = bulkValue;
      }

      const res = await fetch('/api/admin/bug-reports/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bugReportIds: Array.from(selectedBugs),
          updates,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Updated ${selectedBugs.size} bug report(s)`);
        setSelectedBugs(new Set());
        setBulkAction('');
        setBulkValue('');
        await loadBugs();
      } else {
        setError(data.error || 'Bulk update failed');
      }
    } catch (err) {
      setError('Failed to perform bulk action');
      console.error('Error performing bulk action:', err);
    }
  };

  // Filter and sort bugs
  const filteredAndSortedBugs = bugs
    .filter((bug) => {
      if (statusFilter !== 'all' && bug.status !== statusFilter) return false;
      if (typeFilter !== 'all' && bug.bugType !== typeFilter) return false;
      if (priorityFilter !== 'all' && bug.priority !== priorityFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          bug.title.toLowerCase().includes(search) ||
          bug.description.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let aVal: any = a[sortField as keyof BugReport];
      let bVal: any = b[sortField as keyof BugReport];

      // Handle dates
      if (sortField === 'createdAt' || sortField === 'updatedAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="loading-state">Loading bug reports...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="page-header">
          <h1>Bug Reports</h1>
          <Link to="/admin/bugs/dashboard" className="btn-secondary">
            ← Dashboard
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Filters Bar */}
        <div className="filters-bar">
          <div className="filters-row">
            <div className="filter-group">
              <label>Search</label>
              <input
                type="text"
                className="filter-input"
                placeholder="Search title or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Status</label>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="investigating">Investigating</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
                <option value="wont_fix">Won't Fix</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Type</label>
              <select
                className="filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="bug">Bugs</option>
                <option value="feature">Features</option>
                <option value="improvement">Improvements</option>
                <option value="question">Questions</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Priority</label>
              <select
                className="filter-select"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedBugs.size > 0 && (
            <div className="bulk-actions-bar">
              <div className="bulk-info">
                {selectedBugs.size} selected
              </div>
              <div className="bulk-controls">
                <select
                  className="filter-select"
                  value={bulkAction}
                  onChange={(e) => {
                    setBulkAction(e.target.value);
                    setBulkValue('');
                  }}
                >
                  <option value="">Choose action...</option>
                  <option value="status">Change Status</option>
                  <option value="priority">Change Priority</option>
                </select>

                {bulkAction === 'status' && (
                  <select
                    className="filter-select"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                  >
                    <option value="">Select status...</option>
                    <option value="new">New</option>
                    <option value="investigating">Investigating</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                    <option value="wont_fix">Won't Fix</option>
                  </select>
                )}

                {bulkAction === 'priority' && (
                  <select
                    className="filter-select"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                  >
                    <option value="">Select priority...</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                )}

                <button
                  className="btn-primary btn-sm"
                  onClick={handleBulkAction}
                  disabled={!bulkAction || !bulkValue}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Info */}
        <div className="results-info">
          Showing {filteredAndSortedBugs.length} of {bugs.length} bug reports
        </div>

        {/* Bugs Table */}
        <div className="bugs-table-container">
          <table className="bugs-table">
            <thead>
              <tr>
                <th className="col-checkbox">
                  <input
                    type="checkbox"
                    checked={
                      filteredAndSortedBugs.length > 0 &&
                      filteredAndSortedBugs.every((b) => selectedBugs.has(b.id))
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="col-type">Type</th>
                <th className="col-title sortable" onClick={() => handleSort('title')}>
                  Title {sortField === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="col-priority sortable" onClick={() => handleSort('priority')}>
                  Priority {sortField === 'priority' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="col-status sortable" onClick={() => handleSort('status')}>
                  Status {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="col-date sortable" onClick={() => handleSort('createdAt')}>
                  Created {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedBugs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No bug reports found
                  </td>
                </tr>
              ) : (
                filteredAndSortedBugs.map((bug) => (
                  <tr key={bug.id}>
                    <td className="col-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedBugs.has(bug.id)}
                        onChange={(e) => handleSelectBug(bug.id, e.target.checked)}
                      />
                    </td>
                    <td className="col-type">
                      <span className="type-icon">{TYPE_ICONS[bug.bugType]}</span>
                    </td>
                    <td className="col-title">
                      <Link to={`/admin/bugs/${bug.id}`} className="bug-title-link">
                        {bug.title}
                      </Link>
                    </td>
                    <td className="col-priority">
                      <span
                        className="priority-badge"
                        style={{ background: PRIORITY_COLORS[bug.priority] }}
                      >
                        {bug.priority}
                      </span>
                    </td>
                    <td className="col-status">
                      <span
                        className="status-badge"
                        style={{ background: STATUS_COLORS[bug.status] }}
                      >
                        {bug.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="col-date">{formatDate(bug.createdAt)}</td>
                    <td className="col-actions">
                      <Link to={`/admin/bugs/${bug.id}`} className="btn-view">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
