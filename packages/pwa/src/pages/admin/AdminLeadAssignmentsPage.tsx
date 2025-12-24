/**
 * Admin Lead Assignments Page
 *
 * Provides lead assignment interface for admin users:
 * - List all leads with their assigned users
 * - Assign users to leads
 * - Unassign users from leads
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Lead, AuthUser } from '@hail-mary/shared';
import './AdminLeadAssignmentsPage.css';

export const AdminLeadAssignmentsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processingLeadId, setProcessingLeadId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load both leads and users in parallel
      const [leadsRes, usersRes] = await Promise.all([
        fetch('/api/leads?limit=1000', { credentials: 'include' }),
        fetch('/api/admin/users', { credentials: 'include' }),
      ]);

      const [leadsData, usersData] = await Promise.all([
        leadsRes.json(),
        usersRes.json(),
      ]);

      if (leadsRes.status === 401 || leadsRes.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (leadsData.success && leadsData.data) {
        setLeads(leadsData.data);
      } else {
        setError(leadsData.error || 'Failed to load leads');
      }

      if (usersData.success && usersData.data) {
        // Filter out guest users from assignment list
        setUsers(usersData.data.filter((u: AuthUser) => u.role !== 'guest'));
      }
    } catch (err) {
      setError('Failed to load data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (leadId: string, userId: number) => {
    setProcessingLeadId(leadId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/leads/${leadId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (data.success) {
        // Update local state
        setLeads(prev => prev.map(lead =>
          lead.id === leadId
            ? { ...lead, assignedUserId: userId }
            : lead
        ));
        const lead = leads.find(l => l.id === leadId);
        const user = users.find(u => u.id === userId);
        setSuccess(`Assigned ${lead?.firstName} ${lead?.lastName} to ${user?.name}`);
      } else {
        setError(data.error || 'Failed to assign lead');
      }
    } catch (err) {
      setError('Failed to assign lead');
      console.error('Error assigning lead:', err);
    } finally {
      setProcessingLeadId(null);
    }
  };

  const handleUnassign = async (leadId: string) => {
    setProcessingLeadId(leadId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/leads/${leadId}/unassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (data.success) {
        // Update local state
        setLeads(prev => prev.map(lead =>
          lead.id === leadId
            ? { ...lead, assignedUserId: undefined }
            : lead
        ));
        const lead = leads.find(l => l.id === leadId);
        setSuccess(`Unassigned ${lead?.firstName} ${lead?.lastName}`);
      } else {
        setError(data.error || 'Failed to unassign lead');
      }
    } catch (err) {
      setError('Failed to unassign lead');
      console.error('Error unassigning lead:', err);
    } finally {
      setProcessingLeadId(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <p>Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="page-header">
          <h1>🏠 Lead Assignments</h1>
          <Link to="/" className="btn-secondary">← Back to Dashboard</Link>
        </div>

        <div className="info-message">
          <p>
            <strong>About Lead Assignments:</strong> Assign leads to specific users to control who can see and work on them.
            Users can only see leads assigned to them, while admins can see all leads.
          </p>
        </div>

        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        {success && (
          <div className="alert alert-success">{success}</div>
        )}

        <div className="leads-table">
          {leads.length === 0 ? (
            <p>No leads found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => {
                  const assignedUser = users.find(u => u.id === lead.assignedUserId);
                  const isProcessing = processingLeadId === lead.id;

                  return (
                    <tr key={lead.id}>
                      <td>
                        <strong>{lead.firstName} {lead.lastName}</strong>
                        <br />
                        <small>{lead.email || lead.phone}</small>
                      </td>
                      <td>
                        {lead.address ? (
                          <>
                            {lead.address.line1}<br />
                            {lead.address.postcode}
                          </>
                        ) : (
                          <span className="text-muted">No address</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge status-${lead.status}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td>
                        {assignedUser ? (
                          <div className="assigned-user">
                            👤 {assignedUser.name}
                            <br />
                            <small className="text-muted">{assignedUser.email}</small>
                          </div>
                        ) : (
                          <span className="text-muted">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          {lead.assignedUserId ? (
                            <button
                              className="btn-small btn-secondary"
                              onClick={() => handleUnassign(lead.id.toString())}
                              disabled={isProcessing}
                            >
                              {isProcessing ? '...' : 'Unassign'}
                            </button>
                          ) : null}

                          <select
                            className="user-select"
                            value={lead.assignedUserId || ''}
                            onChange={(e) => {
                              const userId = parseInt(e.target.value);
                              if (!isNaN(userId) && userId > 0) {
                                handleAssign(lead.id.toString(), userId);
                              }
                            }}
                            disabled={isProcessing}
                          >
                            <option value="">
                              {lead.assignedUserId ? 'Reassign to...' : 'Assign to...'}
                            </option>
                            {users.map(user => (
                              <option
                                key={user.id}
                                value={user.id}
                                disabled={user.id === lead.assignedUserId}
                              >
                                {user.name} ({user.email})
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-value">{leads.length}</div>
            <div className="stat-label">Total Leads</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {leads.filter(l => l.assignedUserId).length}
            </div>
            <div className="stat-label">Assigned</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {leads.filter(l => !l.assignedUserId).length}
            </div>
            <div className="stat-label">Unassigned</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">Active Users</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLeadAssignmentsPage;
