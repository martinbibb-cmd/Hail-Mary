/**
 * Profile App - Login/Register/Profile window for Hail-Mary
 * 
 * Handles:
 * - User login form
 * - User registration form
 * - Profile display when logged in
 * - Password reset flow
 * - Admin user management (for admin users)
 */

import React, { useState } from 'react';
import { useAuth } from '../../../auth';
import type { AuthUser } from '@hail-mary/shared';
import { APP_VERSION } from '../../../constants';
import './ProfileApp.css';

type ViewMode = 'login' | 'register' | 'profile' | 'forgot-password' | 'reset-sent' | 'admin-users' | 'nas-management';

export const ProfileApp: React.FC = () => {
  const { user, loading, error, login, register, logout, requestPasswordReset, clearError } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>(user ? 'profile' : 'login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [nasStatus, setNasStatus] = useState<any>(null);
  const [nasOutput, setNasOutput] = useState<string>('');

  // Update view mode when user state changes
  React.useEffect(() => {
    if (user) {
      setViewMode('profile');
    } else if (viewMode === 'profile') {
      setViewMode('login');
    }
  }, [user, viewMode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setLocalError(null);
    clearError();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setLocalError(null);
    
    const success = await login(formData.email, formData.password);
    
    if (success) {
      setFormData({ name: '', email: '', password: '', confirmPassword: '' });
    }
    setFormSubmitting(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setLocalError(null);

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      setFormSubmitting(false);
      return;
    }

    if (formData.password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      setFormSubmitting(false);
      return;
    }

    const success = await register(formData.name, formData.email, formData.password);
    
    if (success) {
      setFormData({ name: '', email: '', password: '', confirmPassword: '' });
    }
    setFormSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setLocalError(null);

    const success = await requestPasswordReset(formData.email);
    
    if (success) {
      setViewMode('reset-sent');
    }
    setFormSubmitting(false);
  };

  const handleLogout = async () => {
    await logout();
    setViewMode('login');
  };

  const handleManageUsers = async () => {
    setViewMode('admin-users');
    setLocalError(null);
    setAdminSuccess(null);
    setFormSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setLocalError('Access denied. Admin privileges required.');
      } else if (data.success && data.data) {
        setUsers(data.data);
      } else {
        setLocalError(data.error || 'Failed to load users');
      }
    } catch (err) {
      setLocalError('Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleGenerateResetLink = async (userId: number) => {
    setFormSubmitting(true);
    setLocalError(null);
    setAdminSuccess(null);
    setResetLink(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}), // Empty body to trigger token generation
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setLocalError('Access denied. Admin privileges required.');
      } else if (res.status === 404) {
        setLocalError('User not found.');
      } else if (data.success && data.data?.resetLink) {
        const user = users.find(u => u.id === userId);
        const userName = user ? `${user.name} (${user.email})` : `user ID ${userId}`;
        setResetLink(data.data.resetLink);
        setAdminSuccess(`Reset link generated for ${userName}`);
        setSelectedUserId(null);
      } else {
        setLocalError(data.error || 'Failed to generate reset link');
      }
    } catch (err) {
      setLocalError('Failed to generate reset link');
      console.error('Error generating reset link:', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCopyResetLink = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink).then(() => {
        setAdminSuccess('Reset link copied to clipboard!');
      }).catch(() => {
        setLocalError('Failed to copy link to clipboard');
      });
    }
  };

  const switchToRegister = () => {
    setViewMode('register');
    setFormData({ name: '', email: '', password: '', confirmPassword: '' });
    setLocalError(null);
    clearError();
  };

  const switchToLogin = () => {
    setViewMode('login');
    setFormData({ name: '', email: '', password: '', confirmPassword: '' });
    setLocalError(null);
    clearError();
  };

  const switchToForgotPassword = () => {
    setViewMode('forgot-password');
    setLocalError(null);
    clearError();
  };

  const handleNasManagement = async () => {
    setViewMode('nas-management');
    setLocalError(null);
    setAdminSuccess(null);
    setNasOutput('');
    setFormSubmitting(true);
    try {
      const res = await fetch('/api/admin/nas/status', {
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setLocalError('Access denied. Admin privileges required.');
      } else if (data.success) {
        setNasStatus(data.data);
      } else {
        setLocalError(data.error || 'Failed to get NAS status');
      }
    } catch (err) {
      setLocalError('Failed to get NAS status');
      console.error('Error getting NAS status:', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCheckUpdates = async () => {
    setFormSubmitting(true);
    setLocalError(null);
    setAdminSuccess(null);
    setNasOutput('');

    try {
      const res = await fetch('/api/admin/nas/check-updates', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setLocalError('Access denied. Admin privileges required.');
      } else if (data.success) {
        setAdminSuccess(data.message);
        setNasOutput(data.output || '');
      } else {
        setLocalError(data.error || 'Failed to check for updates');
        setNasOutput(data.details || '');
      }
    } catch (err) {
      setLocalError('Failed to check for updates');
      console.error('Error checking updates:', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handlePullUpdates = async () => {
    if (!confirm('This will pull the latest Docker images and restart containers. Continue?')) {
      return;
    }

    setFormSubmitting(true);
    setLocalError(null);
    setAdminSuccess(null);
    setNasOutput('');

    try {
      const res = await fetch('/api/admin/nas/pull-updates', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setLocalError('Access denied. Admin privileges required.');
      } else if (data.success) {
        setAdminSuccess(data.message);
        setNasOutput(data.output || '');
      } else {
        setLocalError(data.error || 'Failed to pull updates');
        setNasOutput(data.output || data.details || '');
      }
    } catch (err) {
      setLocalError('Failed to pull updates');
      console.error('Error pulling updates:', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleRunMigrations = async () => {
    if (!confirm('This will run database migrations. Continue?')) {
      return;
    }

    setFormSubmitting(true);
    setLocalError(null);
    setAdminSuccess(null);
    setNasOutput('');

    try {
      const res = await fetch('/api/admin/nas/migrate', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setLocalError('Access denied. Admin privileges required.');
      } else if (data.success) {
        setAdminSuccess(data.message);
        setNasOutput(data.output || '');
      } else {
        setLocalError(data.error || 'Failed to run migrations');
        setNasOutput(data.output || data.details || '');
      }
    } catch (err) {
      setLocalError('Failed to run migrations');
      console.error('Error running migrations:', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  if (loading && !formSubmitting) {
    return (
      <div className="profile-app">
        <div className="profile-loading">
          <span className="loading-spinner">⏳</span>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Profile View (logged in)
  if (viewMode === 'profile' && user) {
    return (
      <div className="profile-app">
        <div className="profile-header">
          <div className="profile-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h2>{user.name}</h2>
          <p className="profile-email">{user.email}</p>
        </div>

        <div className="profile-info">
          <div className="profile-info-row">
            <span className="label">Auth Provider:</span>
            <span className="value">{user.authProvider === 'local' ? '🔐 Local' : '☁️ Salesforce'}</span>
          </div>
          <div className="profile-info-row">
            <span className="label">User ID:</span>
            <span className="value">{user.id}</span>
          </div>
          {user.role === 'admin' && (
            <div className="profile-info-row">
              <span className="label">Role:</span>
              <span className="value">👑 Admin</span>
            </div>
          )}
        </div>

        <div className="profile-actions">
          {user.role === 'admin' && (
            <>
              <button className="btn-primary" onClick={handleManageUsers}>
                👥 Manage Users
              </button>
              <button className="btn-primary" onClick={handleNasManagement}>
                🖥️ NAS Management
              </button>
            </>
          )}
          <button className="btn-secondary btn-logout" onClick={handleLogout}>
            🚪 Log Out
          </button>
        </div>
      </div>
    );
  }

  // Admin Users View
  if (viewMode === 'admin-users' && user?.role === 'admin') {
    return (
      <div className="profile-app">
        <div className="auth-form-container">
          <h2>👥 User Management</h2>
          
          {(error || localError) && (
            <div className="auth-error">{localError || error}</div>
          )}

          {adminSuccess && (
            <div className="auth-success">{adminSuccess}</div>
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

          {formSubmitting && !users.length ? (
            <p>Loading users...</p>
          ) : (
            <div className="users-list">
              {users.map(u => (
                <div key={u.id} className="user-item">
                  <div className="user-info">
                    <strong>{u.name}</strong>
                    <span className="user-email">{u.email}</span>
                    <span className="user-meta">
                      {u.role === 'admin' && '👑 '}
                      {u.authProvider === 'local' ? '🔐 Local' : `☁️ ${u.authProvider}`}
                      {u.createdAt && (
                        <> • Created {new Date(u.createdAt).toLocaleDateString()}</>
                      )}
                    </span>
                  </div>
                  
                  {u.authProvider === 'local' && (
                    <div className="user-actions">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          setLocalError(null);
                          setAdminSuccess(null);
                          handleGenerateResetLink(u.id);
                        }}
                        disabled={formSubmitting}
                      >
                        {formSubmitting && selectedUserId === u.id ? 'Generating...' : 'Generate Reset Link'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="auth-switch">
            <button className="btn-link" onClick={() => setViewMode('profile')}>
              ← Back to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  // NAS Management View
  if (viewMode === 'nas-management' && user?.role === 'admin') {
    return (
      <div className="profile-app">
        <div className="auth-form-container">
          <h2>🖥️ NAS Management</h2>
          <p className="form-subtitle">Manage updates and migrations for the NAS deployment</p>
          
          {(error || localError) && (
            <div className="auth-error">{localError || error}</div>
          )}

          {adminSuccess && (
            <div className="auth-success">{adminSuccess}</div>
          )}

          {nasStatus && (
            <div className="nas-status">
              <h3>System Status</h3>
              <div className="status-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                <div className="status-card" style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
                  <h4>🗄️ Database</h4>
                  <div style={{ fontSize: '24px', margin: '10px 0' }}>
                    {nasStatus.db?.ok ? '✅' : '❌'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {nasStatus.db?.ok ? `Latency: ${nasStatus.db.latencyMs}ms` : 'Disconnected'}
                  </div>
                </div>
                <div className="status-card" style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
                  <h4>📦 API</h4>
                  <div style={{ fontSize: '14px', margin: '10px 0' }}>
                    v{nasStatus.app?.version || APP_VERSION}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {nasStatus.app?.commit ? `Commit: ${nasStatus.app.commit}` : 'No git info'}
                  </div>
                </div>
                <div className="status-card" style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
                  <h4>🔄 Migrations</h4>
                  <div style={{ fontSize: '24px', margin: '10px 0' }}>
                    {nasStatus.migrations?.ok ? '✅' : '⚠️'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {nasStatus.migrations?.ok ? 'Up to date' : 'Not initialized'}
                  </div>
                </div>
              </div>
              <div className="profile-info">
                <div className="profile-info-row">
                  <span className="label">Environment:</span>
                  <span className="value">{nasStatus.isDocker ? '🐳 Docker' : '💻 Native'}</span>
                </div>
                <div className="profile-info-row">
                  <span className="label">NAS Auth Mode:</span>
                  <span className="value">{nasStatus.nasAuthMode ? '✅ Enabled' : '❌ Disabled'}</span>
                </div>
                <div className="profile-info-row">
                  <span className="label">Last Check:</span>
                  <span className="value">{new Date(nasStatus.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="nas-actions" style={{ marginTop: '20px' }}>
            <button
              className="btn-primary btn-full"
              onClick={handleCheckUpdates}
              disabled={formSubmitting}
              style={{ marginBottom: '10px' }}
            >
              {formSubmitting ? '🔄 Checking...' : '🔍 Check for Updates'}
            </button>
            
            <button
              className="btn-primary btn-full"
              onClick={handlePullUpdates}
              disabled={formSubmitting}
              style={{ marginBottom: '10px' }}
            >
              {formSubmitting ? '🔄 Updating...' : '⬇️ Pull & Deploy Updates'}
            </button>
            
            <button
              className="btn-primary btn-full"
              onClick={handleRunMigrations}
              disabled={formSubmitting}
              style={{ marginBottom: '10px' }}
            >
              {formSubmitting ? '🔄 Running...' : '🗄️ Run Database Migrations'}
            </button>
          </div>

          {nasOutput && (
            <div className="nas-output">
              <h3>Output</h3>
              <pre style={{
                backgroundColor: '#f5f5f5',
                padding: '10px',
                borderRadius: '4px',
                maxHeight: '300px',
                overflow: 'auto',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              }}>{nasOutput}</pre>
            </div>
          )}

          <div className="auth-switch">
            <button className="btn-link" onClick={() => setViewMode('profile')}>
              ← Back to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reset Sent View
  if (viewMode === 'reset-sent') {
    return (
      <div className="profile-app">
        <div className="auth-form-container">
          <h2>📧 Check Your Email</h2>
          <p className="reset-message">
            If an account exists with that email, you will receive a password reset link.
          </p>
          <p className="reset-hint">
            <em>For development: check the server console for the reset link.</em>
          </p>
          <button className="btn-primary btn-full" onClick={switchToLogin}>
            ← Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Forgot Password View
  if (viewMode === 'forgot-password') {
    return (
      <div className="profile-app">
        <div className="auth-form-container">
          <h2>🔑 Reset Password</h2>
          <p className="form-subtitle">Enter your email to receive a reset link.</p>

          {(error || localError) && (
            <div className="auth-error">{localError || error}</div>
          )}

          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary btn-full"
              disabled={formSubmitting}
            >
              {formSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="auth-switch">
            <button className="btn-link" onClick={switchToLogin}>
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Register View
  if (viewMode === 'register') {
    return (
      <div className="profile-app">
        <div className="auth-form-container">
          <h2>🚀 Create Account</h2>

          {(error || localError) && (
            <div className="auth-error">{localError || error}</div>
          )}

          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="John Smith"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary btn-full"
              disabled={formSubmitting}
            >
              {formSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="auth-switch">
            <span>Already have an account?</span>
            <button className="btn-link" onClick={switchToLogin}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Login View (default)
  return (
    <div className="profile-app">
      <div className="auth-form-container">
        <h2>🔐 Sign In</h2>

        {(error || localError) && (
          <div className="auth-error">{localError || error}</div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Your password"
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary btn-full"
            disabled={formSubmitting}
          >
            {formSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <button className="btn-link" onClick={switchToForgotPassword}>
            Forgot password?
          </button>
        </div>

        <div className="auth-switch">
          <span>Don't have an account?</span>
          <button className="btn-link" onClick={switchToRegister}>
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileApp;
