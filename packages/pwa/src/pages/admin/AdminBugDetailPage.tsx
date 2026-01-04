/**
 * Admin Bug Detail Page
 *
 * Detailed view of a single bug report with:
 * - Full bug information
 * - Auto-captured context
 * - Status/Priority management
 * - Notes/Comments
 * - Activity log
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './AdminBugDetailPage.css';

interface BugReport {
  id: string;
  title: string;
  description: string;
  bugType: 'bug' | 'feature' | 'improvement' | 'question';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'investigating' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';
  userId: number;
  url?: string;
  userAgent?: string;
  screenResolution?: string;
  contextData?: any;
  errorMessage?: string;
  stackTrace?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

interface Note {
  id: string;
  note: string;
  createdAt: string;
  user?: {
    username: string;
    email: string;
  };
}

interface Activity {
  id: string;
  actionType: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
  user?: {
    username: string;
    email: string;
  };
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

export const AdminBugDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [bug, setBug] = useState<BugReport | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const [editingStatus, setEditingStatus] = useState(false);
  const [editingPriority, setEditingPriority] = useState(false);

  useEffect(() => {
    if (id) {
      loadBugDetails();
      loadNotes();
      loadActivity();
    }
  }, [id]);

  const loadBugDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bug-reports/${id}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (res.status === 404) {
        setError('Bug report not found');
      } else if (data.success && data.data?.bugReport) {
        setBug(data.data.bugReport);
      } else {
        setError(data.error || 'Failed to load bug report');
      }
    } catch (err) {
      setError('Failed to load bug report');
      console.error('Error loading bug:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const res = await fetch(`/api/admin/bug-reports/${id}/notes`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success && data.data?.notes) {
        setNotes(data.data.notes);
      }
    } catch (err) {
      console.error('Error loading notes:', err);
    }
  };

  const loadActivity = async () => {
    try {
      const res = await fetch(`/api/admin/bug-reports/${id}/activity`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success && data.data?.activity) {
        setActivity(data.data.activity);
      }
    } catch (err) {
      console.error('Error loading activity:', err);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/bug-reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Status updated successfully');
        setEditingStatus(false);
        await loadBugDetails();
        await loadActivity();
      } else {
        setError(data.error || 'Failed to update status');
      }
    } catch (err) {
      setError('Failed to update status');
      console.error('Error updating status:', err);
    }
  };

  const handleUpdatePriority = async (newPriority: string) => {
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/bug-reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priority: newPriority }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Priority updated successfully');
        setEditingPriority(false);
        await loadBugDetails();
        await loadActivity();
      } else {
        setError(data.error || 'Failed to update priority');
      }
    } catch (err) {
      setError('Failed to update priority');
      console.error('Error updating priority:', err);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setAddingNote(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/bug-reports/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ note: newNote }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Note added successfully');
        setNewNote('');
        await loadNotes();
        await loadActivity();
      } else {
        setError(data.error || 'Failed to add note');
      }
    } catch (err) {
      setError('Failed to add note');
      console.error('Error adding note:', err);
    } finally {
      setAddingNote(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatActivityMessage = (act: Activity): string => {
    const user = act.user?.username || 'System';

    switch (act.actionType) {
      case 'created':
        return `${user} created this bug report`;
      case 'status_change':
        return `${user} changed status from "${act.oldValue}" to "${act.newValue}"`;
      case 'priority_change':
        return `${user} changed priority from "${act.oldValue}" to "${act.newValue}"`;
      case 'note_added':
        return `${user} added a note`;
      default:
        return `${user} performed ${act.actionType}`;
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="loading-state">Loading bug details...</div>
        </div>
      </div>
    );
  }

  if (error && !bug) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="alert alert-error">{error}</div>
          <Link to="/admin/bugs" className="btn-secondary">
            ← Back to List
          </Link>
        </div>
      </div>
    );
  }

  if (!bug) return null;

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="page-header">
          <h1>
            {TYPE_ICONS[bug.bugType]} Bug Report #{bug.id.substring(0, 8)}
          </h1>
          <Link to="/admin/bugs" className="btn-secondary">
            ← Back to List
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="bug-detail-layout">
          {/* Main Content */}
          <div className="bug-main">
            {/* Bug Info Card */}
            <div className="bug-card">
              <h2 className="bug-title">{bug.title}</h2>

              <div className="bug-meta-row">
                <div className="bug-meta-item">
                  <span className="meta-label">Type</span>
                  <span className="meta-value">{TYPE_ICONS[bug.bugType]} {bug.bugType}</span>
                </div>

                <div className="bug-meta-item">
                  <span className="meta-label">Priority</span>
                  {editingPriority ? (
                    <select
                      className="meta-select"
                      value={bug.priority}
                      onChange={(e) => handleUpdatePriority(e.target.value)}
                      onBlur={() => setEditingPriority(false)}
                      autoFocus
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  ) : (
                    <span
                      className="meta-value clickable"
                      style={{ color: PRIORITY_COLORS[bug.priority] }}
                      onClick={() => setEditingPriority(true)}
                    >
                      {bug.priority} ▼
                    </span>
                  )}
                </div>

                <div className="bug-meta-item">
                  <span className="meta-label">Status</span>
                  {editingStatus ? (
                    <select
                      className="meta-select"
                      value={bug.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      onBlur={() => setEditingStatus(false)}
                      autoFocus
                    >
                      <option value="new">New</option>
                      <option value="investigating">Investigating</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                      <option value="wont_fix">Won't Fix</option>
                    </select>
                  ) : (
                    <span
                      className="meta-value clickable"
                      onClick={() => setEditingStatus(true)}
                    >
                      {bug.status.replace('_', ' ')} ▼
                    </span>
                  )}
                </div>

                <div className="bug-meta-item">
                  <span className="meta-label">Created</span>
                  <span className="meta-value">{formatDate(bug.createdAt)}</span>
                </div>
              </div>

              <div className="bug-section">
                <h3>Description</h3>
                <div className="bug-description">{bug.description}</div>
              </div>

              {/* Auto-Captured Context */}
              <div className="bug-section">
                <h3>Auto-Captured Context</h3>
                <div className="context-grid">
                  {bug.url && (
                    <div className="context-item">
                      <div className="context-label">URL</div>
                      <div className="context-value">
                        <a href={bug.url} target="_blank" rel="noopener noreferrer">
                          {bug.url}
                        </a>
                      </div>
                    </div>
                  )}

                  {bug.userAgent && (
                    <div className="context-item">
                      <div className="context-label">User Agent</div>
                      <div className="context-value">{bug.userAgent}</div>
                    </div>
                  )}

                  {bug.screenResolution && (
                    <div className="context-item">
                      <div className="context-label">Screen Resolution</div>
                      <div className="context-value">{bug.screenResolution}</div>
                    </div>
                  )}

                  {bug.errorMessage && (
                    <div className="context-item">
                      <div className="context-label">Error Message</div>
                      <div className="context-value error-text">{bug.errorMessage}</div>
                    </div>
                  )}

                  {bug.stackTrace && (
                    <div className="context-item full-width">
                      <div className="context-label">Stack Trace</div>
                      <pre className="stack-trace">{bug.stackTrace}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="bug-card">
              <h3>Admin Notes</h3>

              <div className="add-note-form">
                <textarea
                  className="note-input"
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                />
                <button
                  className="btn-primary"
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                >
                  {addingNote ? 'Adding...' : 'Add Note'}
                </button>
              </div>

              <div className="notes-list">
                {notes.length === 0 ? (
                  <div className="empty-state">No notes yet</div>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="note-item">
                      <div className="note-header">
                        <span className="note-author">
                          {note.user?.username || 'Unknown User'}
                        </span>
                        <span className="note-date">{formatDate(note.createdAt)}</span>
                      </div>
                      <div className="note-content">{note.note}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="bug-sidebar">
            {/* Activity Log */}
            <div className="sidebar-card">
              <h3>Activity Log</h3>
              <div className="activity-list">
                {activity.length === 0 ? (
                  <div className="empty-state">No activity yet</div>
                ) : (
                  activity.map((act) => (
                    <div key={act.id} className="activity-item">
                      <div className="activity-message">{formatActivityMessage(act)}</div>
                      <div className="activity-date">{formatDate(act.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
