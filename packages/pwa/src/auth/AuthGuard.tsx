/**
 * Auth Guard Component
 * 
 * Shows AuthScreen when user is not logged in,
 * restricting access to protected features.
 * When authenticated, renders the children (OS shell).
 */

import React from 'react';
import { useAuth } from './AuthContext';
import { AuthScreen } from './AuthScreen';
import './AuthGuard.css';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, loading } = useAuth();

  // Show loading splash while checking auth state
  if (loading) {
    return (
      <div className="auth-guard-overlay auth-guard-loading">
        <div className="auth-guard-content">
          <div className="auth-guard-logo">🔥</div>
          <h2>Hail-Mary</h2>
          <div className="auth-guard-spinner">⏳</div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show full-screen AuthScreen
  if (!user) {
    return <AuthScreen />;
  }

  // User is logged in, render children (OS shell)
  return <>{children}</>;
};

export default AuthGuard;
