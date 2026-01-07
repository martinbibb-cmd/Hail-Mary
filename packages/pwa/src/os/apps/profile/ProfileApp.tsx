/**
 * Profile App - Login/Register/Profile window for Hail-Mary
 * 
 * Handles:
 * - User login form
 * - User registration form
 * - Profile display when logged in
 * - Password reset flow
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth';
import './ProfileApp.css';

type ViewMode = 'login' | 'register' | 'profile' | 'forgot-password' | 'reset-sent';

export const ProfileApp: React.FC = () => {
  const navigate = useNavigate();
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

  // Helper function for admin navigation with fallback
  const navigateToAdmin = (path: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try {
      navigate(path);
    } catch (err) {
      console.error('Navigation failed:', err);
      window.location.href = path;
    }
  };

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
            <>
              <a
                href="/admin/users"
                className="btn-primary admin-action-link"
                onClick={navigateToAdmin('/admin/users')}
              >
                👥 Manage Users
              </a>
              <a
                href="/admin/nas"
                className="btn-primary admin-action-link"
                onClick={navigateToAdmin('/admin/nas')}
              >
                🖥️ NAS Management
              </a>
              <a
                href="/admin/knowledge"
                className="btn-primary admin-action-link"
                onClick={navigateToAdmin('/admin/knowledge')}
              >
                📚 Knowledge Management
              </a>
              <a
                href="/diagnostics"
                className="btn-primary admin-action-link"
                onClick={navigateToAdmin('/diagnostics')}
              >
                🔍 System Diagnostics
              </a>
            </>
          )}
          <button className="btn-secondary btn-logout" onClick={handleLogout}>
            🚪 Log Out
          </button>
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
