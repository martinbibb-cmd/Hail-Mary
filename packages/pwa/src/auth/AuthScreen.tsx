/**
 * AuthScreen Component
 * 
 * Full-screen authentication UI for Hail-Mary.
 * Shows login/register forms when user is not authenticated.
 * This is the "lock screen" before accessing the OS shell.
 */

import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import './AuthScreen.css';

type ViewMode = 'login' | 'register' | 'forgot-password' | 'reset-sent';

export const AuthScreen: React.FC = () => {
  const { error, login, register, requestPasswordReset, clearError } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

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
      </div>
    </div>
  );
};

export default AuthScreen;
