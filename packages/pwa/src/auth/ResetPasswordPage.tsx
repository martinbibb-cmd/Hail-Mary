/**
 * Reset Password Page
 * 
 * Handles password reset when user clicks the reset link
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import './ResetPasswordPage.css';

const EyeOpenIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 5C5.63636 5 2 12 2 12s3.63636 7 10 7 10-7 10-7-3.63636-7-10-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EyeClosedIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3l18 18M10.5 10.677a2 2 0 002.823 2.823M7.362 7.561C5.68 8.74 4.279 10.42 3 12c1.889 2.991 5.282 6 9 6 1.55 0 3.043-.523 4.395-1.35M12 6c4.008 0 6.701 3.158 9 6a15.66 15.66 0 01-1.507 1.952" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ResetPasswordPage: React.FC = () => {
  const { resetPassword, loading, error, clearError } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Get token from URL params
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    setToken(tokenParam);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    if (!token) {
      setLocalError('Invalid reset token');
      return;
    }

    const result = await resetPassword(token, newPassword);
    if (result) {
      setSuccess(true);
    }
  };

  if (!token) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container">
          <h1>🔑 Reset Password</h1>
          <div className="reset-error">
            Invalid or missing reset token. Please request a new password reset link.
          </div>
          <a href="/" className="reset-link">← Back to Home</a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container">
          <h1>✅ Password Reset</h1>
          <p className="reset-success">
            Your password has been reset successfully. You can now log in with your new password.
          </p>
          <a href="/" className="reset-button">Go to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-container">
        <h1>🔑 Set New Password</h1>
        
        {(error || localError) && (
          <div className="reset-error">{localError || error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <div className="password-wrapper">
              <input
                type={showNewPassword ? "text" : "password"}
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoFocus
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="reset-button"
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <a href="/" className="reset-link">← Back to Home</a>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
