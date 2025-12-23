/**
 * Auth Context for Hail-Mary PWA
 * 
 * Provides authentication state and methods throughout the app.
 * Uses JWT in httpOnly cookies for session management.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, RegisterDto, LoginDto, AuthResponse } from '@hail-mary/shared';

interface NasUser {
  id: number;
  name: string;
  email: string;
}

interface AuthConfig {
  googleAuthEnabled: boolean;
  nasAuthMode: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  /** Auth configuration (Google OAuth, NAS mode availability) */
  authConfig: AuthConfig | null;
  /** @deprecated Use authConfig.nasAuthMode instead */
  nasMode: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
  /** NAS mode: Get list of users for quick selection */
  getNasUsers: () => Promise<NasUser[]>;
  /** NAS mode: Quick login as a user without password */
  nasLogin: (userId: number) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Get a user-friendly error message based on the error code
 */
function getFriendlyErrorMessage(code?: string, fallback?: string): string {
  // Rate limiting: keep messaging calm and non-technical
  if (
    code === 'rate_limited' ||
    code === 'RATE_LIMITED' ||
    (typeof fallback === 'string' && /too many requests|rate limit/i.test(fallback))
  ) {
    return 'Please wait a moment and try again.';
  }

  switch (code) {
    case 'invalid_credentials':
      return "We couldn't sign you in. Check your email and password and try again.";
    case 'email_exists':
      return 'An account with this email already exists.';
    case 'validation_error':
      return fallback || 'Please check your input and try again.';
    case 'database_error':
    case 'internal_error':
      return 'Something went wrong signing you in. Please try again in a moment.';
    default:
      return fallback || 'Something went wrong. Please try again.';
  }
}

// API helper for auth requests
const authApi = {
  async post<T>(url: string, data?: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important: include cookies
      body: data ? JSON.stringify(data) : undefined,
    });

    // Always try to parse JSON, even for error responses
    // The backend always returns JSON for both success and error cases
    const json = await res.json();

    // Check if response was successful
    if (!res.ok) {
      // If response has error info, it will be in json
      console.error(`API error (${res.status}):`, json);
    }

    return json;
  },
  async get<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include', // Important: include cookies
    });

    // Always try to parse JSON, even for error responses
    const json = await res.json();

    // Check if response was successful
    if (!res.ok) {
      console.error(`API error (${res.status}):`, json);
    }

    return json;
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [nasMode, setNasMode] = useState(false); // Deprecated, kept for backwards compatibility

  // Fetch auth configuration on mount
  useEffect(() => {
    authApi.get<{ success: boolean; data?: AuthConfig }>('/api/auth/config')
      .then(res => {
        if (res.success && res.data) {
          setAuthConfig(res.data);
          setNasMode(res.data.nasAuthMode); // For backwards compatibility
        }
      })
      .catch(() => {
        // Config endpoint not available, use defaults
        setAuthConfig({ googleAuthEnabled: false, nasAuthMode: false });
      });
  }, []);

  // Fetch current user on mount
  const refresh = useCallback(async () => {
    try {
      const res = await authApi.get<AuthResponse>('/api/auth/me');
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Auth refresh error:', err);
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
        // Log full error for debugging
        console.error('Login failed:', { code: res.code, error: res.error });
        // Show user-friendly message
        setError(getFriendlyErrorMessage(res.code, res.error));
        return false;
      }
    } catch (err) {
      console.error('Login network error:', err);
      setError('Something went wrong signing you in. Please try again in a moment.');
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
        // Log full error for debugging
        console.error('Registration failed:', { code: res.code, error: res.error });
        // Show user-friendly message
        setError(getFriendlyErrorMessage(res.code, res.error));
        return false;
      }
    } catch (err) {
      console.error('Registration network error:', err);
      setError('Something went wrong creating your account. Please try again in a moment.');
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
    } catch (err) {
      console.error('Logout error:', err);
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
    } catch (err) {
      console.error('Password reset request error:', err);
      setError('Something went wrong. Please try again in a moment.');
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
        console.error('Password reset failed:', { code: res.code, error: res.error });
        setError(getFriendlyErrorMessage(res.code, res.error));
        return false;
      }
    } catch (err) {
      console.error('Password reset network error:', err);
      setError('Something went wrong. Please try again in a moment.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // NAS mode: Get list of users
  const getNasUsers = useCallback(async (): Promise<NasUser[]> => {
    try {
      const res = await authApi.get<{ success: boolean; data?: NasUser[] }>('/api/auth/nas/users');
      if (res.success && res.data) {
        return res.data;
      }
      return [];
    } catch (err) {
      console.error('Failed to get NAS users:', err);
      return [];
    }
  }, []);

  // NAS mode: Quick login
  const nasLogin = useCallback(async (userId: number): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.post<AuthResponse>('/api/auth/nas/login', { userId });
      if (res.success && res.data) {
        setUser(res.data);
        return true;
      } else {
        setError(res.error || 'Failed to login');
        return false;
      }
    } catch (err) {
      console.error('NAS login error:', err);
      setError('Failed to login');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        authConfig,
        nasMode, // Deprecated, kept for backwards compatibility
        login,
        register,
        logout,
        refresh,
        requestPasswordReset,
        resetPassword,
        clearError,
        getNasUsers,
        nasLogin,
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
