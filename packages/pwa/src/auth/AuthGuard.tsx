/**
 * Auth Guard Component
 * 
 * Displays an overlay when user is not logged in,
 * restricting access to protected features.
 */

import React from 'react';
import { useAuth } from './AuthContext';
import { useWindowStore } from '../os/window-manager';
import './AuthGuard.css';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const openWindow = useWindowStore((state) => state.openWindow);

  const handleOpenLogin = () => {
    openWindow('profile', 'Profile');
  };

  // Show loading while checking auth state
  if (loading) {
    return (
      <>
        {children}
        <div className="auth-guard-overlay auth-guard-loading">
          <div className="auth-guard-content">
            <div className="auth-guard-spinner">⏳</div>
            <p>Loading...</p>
          </div>
        </div>
      </>
    );
  }

  // If not logged in, show overlay
  if (!user) {
    return (
      <>
        {children}
        <div className="auth-guard-overlay">
          <div className="auth-guard-content">
            <div className="auth-guard-icon">🔐</div>
            <h2>Please Log In</h2>
            <p>You need to be logged in to use Hail-Mary.</p>
            <button className="auth-guard-button" onClick={handleOpenLogin}>
              Open Login
            </button>
          </div>
        </div>
      </>
    );
  }

  // User is logged in, render children without overlay
  return <>{children}</>;
};

export default AuthGuard;
