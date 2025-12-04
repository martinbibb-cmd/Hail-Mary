/**
 * AuthScreen Component
 * 
 * Full-screen authentication UI for Hail-Mary.
 * Shows login/register forms when user is not authenticated.
 * This is the "lock screen" before accessing the OS shell.
 * 
 * Supports NAS mode: When NAS_AUTH_MODE is enabled, shows a user 
 * selection list for quick login without password.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import './AuthScreen.css';

type ViewMode = 'login' | 'register' | 'forgot-password' | 'reset-sent' | 'nas-select';

interface NasUser {
  id: number;
  name: string;
  email: string;
}

export const AuthScreen: React.FC = () => {
  const { error, login, register, requestPasswordReset, clearError, nasMode, getNasUsers, nasLogin } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [nasUsers, setNasUsers] = useState<NasUser[]>([]);
  const [loadingNasUsers, setLoadingNasUsers] = useState(false);

  // Load NAS users when mode changes
  useEffect(() => {
    if (viewMode === 'nas-select') {
      setLoadingNasUsers(true);
      getNasUsers()
        .then(users => setNasUsers(users))
        .finally(() => setLoadingNasUsers(false));
    }
  }, [viewMode, getNasUsers]);

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

  const handleNasUserSelect = async (userId: number) => {
    setFormSubmitting(true);
    setLocalError(null);
    
    const success = await nasLogin(userId);
    
    if (!success) {
      setLocalError('Failed to login as selected user');
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

  const switchToNasSelect = () => {
    setViewMode('nas-select');
    setLocalError(null);
    clearError();
  };

  // NAS User Selection View
  if (viewMode === 'nas-select') {
    return (
      <div className="auth-screen">
        <div className="auth-screen-container">
          <div className="auth-screen-logo">
            <span className="auth-screen-logo-icon">🔥</span>
            <h1>Hail-Mary</h1>
          </div>
          <div className="auth-screen-form">
            <h2>👤 Select User</h2>
            <p className="auth-screen-subtitle nas-warning">
              ⚠️ NAS Quick Login Mode - No password required
            </p>

            {(error || localError) && (
              <div className="auth-screen-error">{localError || error}</div>
            )}

            {loadingNasUsers ? (
              <div className="nas-loading">Loading users...</div>
            ) : nasUsers.length === 0 ? (
              <div className="nas-empty">No users found. Please create a user first.</div>
            ) : (
              <div className="nas-user-list">
                {nasUsers.map(user => (
                  <button
                    key={user.id}
                    className="nas-user-item"
                    onClick={() => handleNasUserSelect(user.id)}
                    disabled={formSubmitting}
                  >
                    <span className="nas-user-avatar">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="nas-user-info">
                      <span className="nas-user-name">{user.name}</span>
                      <span className="nas-user-email">{user.email}</span>
                    </div>
                    <span className="nas-user-arrow">→</span>
                  </button>
                ))}
              </div>
            )}

            <div className="auth-screen-switch">
              <button className="auth-btn-link" onClick={switchToLogin}>
                ← Back to Password Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reset Sent View
  if (viewMode === 'reset-sent') {
    return (
      <div className="auth-screen">
        <div className="auth-screen-container">
          <div className="auth-screen-logo">
            <span className="auth-screen-logo-icon">🔥</span>
            <h1>Hail-Mary</h1>
          </div>
          <div className="auth-screen-form">
            <h2>📧 Check Your Email</h2>
            <p className="auth-screen-message">
              If an account exists with that email, you will receive a password reset link.
            </p>
            <p className="auth-screen-hint">
              <em>For development: check the server console for the reset link.</em>
            </p>
            <button className="auth-btn auth-btn-primary auth-btn-full" onClick={switchToLogin}>
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Forgot Password View
  if (viewMode === 'forgot-password') {
    return (
      <div className="auth-screen">
        <div className="auth-screen-container">
          <div className="auth-screen-logo">
            <span className="auth-screen-logo-icon">🔥</span>
            <h1>Hail-Mary</h1>
          </div>
          <div className="auth-screen-form">
            <h2>🔑 Reset Password</h2>
            <p className="auth-screen-subtitle">Enter your email to receive a reset link.</p>

            {(error || localError) && (
              <div className="auth-screen-error">{localError || error}</div>
            )}

            <form onSubmit={handleForgotPassword}>
              <div className="auth-form-group">
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
                className="auth-btn auth-btn-primary auth-btn-full"
                disabled={formSubmitting}
              >
                {formSubmitting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="auth-screen-switch">
              <button className="auth-btn-link" onClick={switchToLogin}>
                ← Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Register View
  if (viewMode === 'register') {
    return (
      <div className="auth-screen">
        <div className="auth-screen-container">
          <div className="auth-screen-logo">
            <span className="auth-screen-logo-icon">🔥</span>
            <h1>Hail-Mary</h1>
          </div>
          <div className="auth-screen-form">
            <h2>🚀 Create Account</h2>

            {(error || localError) && (
              <div className="auth-screen-error">{localError || error}</div>
            )}

            <form onSubmit={handleRegister}>
              <div className="auth-form-group">
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

              <div className="auth-form-group">
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

              <div className="auth-form-group">
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

              <div className="auth-form-group">
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
                className="auth-btn auth-btn-primary auth-btn-full"
                disabled={formSubmitting}
              >
                {formSubmitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <div className="auth-screen-divider">
              <span>or</span>
            </div>

            <a
              href="/api/auth/google"
              className="auth-btn auth-btn-google auth-btn-full"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
                <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
              </svg>
              Sign up with Google
            </a>

            <div className="auth-screen-switch">
              <span>Already have an account?</span>
              <button className="auth-btn-link" onClick={switchToLogin}>
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login View (default)
  return (
    <div className="auth-screen">
      <div className="auth-screen-container">
        <div className="auth-screen-logo">
          <span className="auth-screen-logo-icon">🔥</span>
          <h1>Hail-Mary</h1>
        </div>
        <div className="auth-screen-form">
          <h2>🔐 Sign In</h2>

          {(error || localError) && (
            <div className="auth-screen-error">{localError || error}</div>
          )}

          <form onSubmit={handleLogin}>
            <div className="auth-form-group">
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

            <div className="auth-form-group">
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
              className="auth-btn auth-btn-primary auth-btn-full"
              disabled={formSubmitting}
            >
              {formSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="auth-screen-divider">
            <span>or</span>
          </div>

          <a
            href="/api/auth/google"
            className="auth-btn auth-btn-google auth-btn-full"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
              <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </a>

          {/* NAS Quick Login Option */}
          {nasMode && (
            <button
              className="auth-btn auth-btn-nas auth-btn-full"
              onClick={switchToNasSelect}
            >
              🖥️ NAS Quick Login (Select User)
            </button>
          )}

          <div className="auth-screen-footer">
            <button className="auth-btn-link" onClick={switchToForgotPassword}>
              Forgot password?
            </button>
          </div>

          <div className="auth-screen-switch">
            <span>Don't have an account?</span>
            <button className="auth-btn-link" onClick={switchToRegister}>
              Create Account
            </button>
          </div>
        </div>
        <div className="auth-screen-version">
          <span>v{__APP_VERSION__}</span>
          <span>Built: {new Date(__BUILD_TIME__).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
