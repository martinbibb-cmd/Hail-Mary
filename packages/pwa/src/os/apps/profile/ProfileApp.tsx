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
import './ProfileApp.css';

type ViewMode = 'login' | 'register' | 'profile' | 'forgot-password' | 'reset-sent' | 'admin-users';

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
  const [newPassword, setNewPassword] = useState('');
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);

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

  const handleResetUserPassword = async (userId: number) => {
    if (!newPassword || newPassword.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    setFormSubmitting(true);
    setLocalError(null);
    setAdminSuccess(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setLocalError('Access denied. Admin privileges required.');
      } else if (res.status === 404) {
        setLocalError('User not found.');
      } else if (data.success) {
        const user = users.find(u => u.id === userId);
        const userName = user ? `${user.name} (${user.email})` : `user ID ${userId}`;
        setAdminSuccess(`Password reset successfully for ${userName}`);
        setNewPassword('');
        setSelectedUserId(null);
      } else {
        setLocalError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setLocalError('Failed to reset password');
      console.error('Error resetting password:', err);
    } finally {
      setFormSubmitting(false);
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
            <button className="btn-primary" onClick={handleManageUsers}>
              👥 Manage Users
            </button>
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
                    </span>
                  </div>
                  
                  {u.authProvider === 'local' && (
                    <div className="user-actions">
                      {selectedUserId === u.id ? (
                        <div className="password-reset-form">
                          <input
                            type="password"
                            placeholder="New password (8+ chars)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={formSubmitting}
                            minLength={8}
                          />
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => handleResetUserPassword(u.id)}
                            disabled={formSubmitting || !newPassword || newPassword.length < 8}
                          >
                            {formSubmitting ? 'Resetting...' : 'Reset'}
                          </button>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedUserId(null);
                              setNewPassword('');
                              setLocalError(null);
                            }}
                            disabled={formSubmitting}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setNewPassword('');
                            setLocalError(null);
                            setAdminSuccess(null);
                          }}
                        >
                          Reset Password
                        </button>
                      )}
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
