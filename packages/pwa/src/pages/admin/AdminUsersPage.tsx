/**
 * Admin Users Page
 * 
 * Provides user management interface for admin users:
 * - List all users
 * - Generate password reset links
 * - View user details
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { AuthUser } from '@hail-mary/shared';
import './AdminUsersPage.css';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [processingUserId, setProcessingUserId] = useState<number | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (data.success && data.data) {
        setUsers(data.data);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch (err) {
      setError('Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateResetLink = async (userId: number) => {
    setProcessingUserId(userId);
    setError(null);
    setSuccess(null);
    setResetLink(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (res.status === 404) {
        setError('User not found.');
      } else if (data.success && data.data?.resetLink) {
        const user = users.find(u => u.id === userId);
        const userName = user ? `${user.name} (${user.email})` : `user ID ${userId}`;
        setResetLink(data.data.resetLink);
        setSuccess(`Reset link generated for ${userName}`);
      } else {
        setError(data.error || 'Failed to generate reset link');
      }
    } catch (err) {
      setError('Failed to generate reset link');
      console.error('Error generating reset link:', err);
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleCopyResetLink = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink).then(() => {
        setSuccess('Reset link copied to clipboard!');
      }).catch(() => {
        setError('Failed to copy link to clipboard');
      });
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="page-header">
          <h1>👥 User Management</h1>
          <Link to="/" className="btn-secondary">← Back to Dashboard</Link>
        </div>

        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        {success && (
          <div className="alert alert-success">{success}</div>
        )}

        {/* Reset Link Modal */}
        {resetLink && (
          <div className="modal-overlay" onClick={() => setResetLink(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>🔑 Password Reset Link</h3>
              <p>Share this link with the user. It expires in 1 hour.</p>
              <div className="reset-link-display">
                <input
                  type="text"
                  value={resetLink}
                  readOnly
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>
              <div className="modal-actions">
                <button className="btn-primary" onClick={handleCopyResetLink}>
                  📋 Copy Link
                </button>
                <button className="btn-secondary" onClick={() => setResetLink(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="users-list">
          {users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            users.map(user => (
              <div key={user.id} className="user-card">
                <div className="user-info">
                  <h3>{user.name}</h3>
                  <p className="user-email">{user.email}</p>
                  <div className="user-meta">
                    {user.role === 'admin' && <span className="badge badge-admin">👑 Admin</span>}
                    <span className="badge">
                      {user.authProvider === 'local' ? '🔐 Local' : `☁️ ${user.authProvider}`}
                    </span>
                    {user.createdAt && (
                      <span className="user-date">
                        Created {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                
                {user.authProvider === 'local' && (
                  <div className="user-actions">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => handleGenerateResetLink(user.id)}
                      disabled={processingUserId === user.id}
                    >
                      {processingUserId === user.id ? 'Generating...' : 'Generate Reset Link'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUsersPage;
