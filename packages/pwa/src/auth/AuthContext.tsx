/**
 * Auth Context for Hail-Mary PWA
 * 
 * Provides authentication state and methods throughout the app.
 * Uses JWT in httpOnly cookies for session management.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, RegisterDto, LoginDto, AuthResponse } from '@hail-mary/shared';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// API helper for auth requests
const authApi = {
  async post<T>(url: string, data?: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: include cookies
      body: data ? JSON.stringify(data) : undefined,
    });
    return res.json();
  },
  async get<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include', // Important: include cookies
    });
    return res.json();
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user on mount
  const refresh = useCallback(async () => {
    try {
      const res = await authApi.get<AuthResponse>('/api/auth/me');
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const data: LoginDto = { email, password };
      const res = await authApi.post<AuthResponse>('/api/auth/login', data);
      if (res.success && res.data) {
        setUser(res.data);
        return true;
      } else {
        setError(res.error || 'Login failed');
        return false;
      }
    } catch {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const data: RegisterDto = { name, email, password };
      const res = await authApi.post<AuthResponse>('/api/auth/register', data);
      if (res.success && res.data) {
        setUser(res.data);
        return true;
      } else {
        setError(res.error || 'Registration failed');
        return false;
      }
    } catch {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authApi.post('/api/auth/logout');
      setUser(null);
    } catch {
      // Even if logout fails, clear local state
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.post<AuthResponse>('/api/auth/request-password-reset', { email });
      // Always return success to not leak email existence
      return res.success;
    } catch {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.post<AuthResponse>('/api/auth/reset-password', { token, newPassword });
      if (res.success) {
        return true;
      } else {
        setError(res.error || 'Password reset failed');
        return false;
      }
    } catch {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        refresh,
        requestPasswordReset,
        resetPassword,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
