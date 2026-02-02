/**
 * Auth Context - Zentrale Authentifizierungsverwaltung
 *
 * Features:
 * - Login/Logout Funktionalität
 * - Token-Management in localStorage
 * - Automatische Token-Validierung
 * - User-State Management
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// API Base URL
const API_BASE = import.meta.env.VITE_API_URL || "";

// Dev Mode - skip auth validation for local testing
const DEV_MODE = import.meta.env.DEV && !import.meta.env.VITE_API_URL;

// Types
export interface User {
  id: number;
  email: string;
  role: "admin" | "user";
  country_code?: string;
  is_active: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

// Provider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize from localStorage
  useEffect(() => {
    const initAuth = async () => {
      // DEV MODE: Auto-login with mock user for local development
      if (DEV_MODE) {
        console.log("[Auth] DEV_MODE enabled - using mock user");
        const mockUser: User = {
          id: 1,
          email: "admin@niederwieser.com",
          role: "admin",
          country_code: "DE",
          is_active: true,
        };
        setState({
          user: mockUser,
          token: "dev-token",
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }

      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        try {
          // Parse stored user for fallback (used in catch block)
          JSON.parse(storedUser) as User;

          // Validate token by fetching current user
          const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (response.ok) {
            const userData = await response.json();
            setState({
              user: userData,
              token: storedToken,
              isAuthenticated: true,
              isLoading: false,
            });
            // Update stored user with fresh data
            localStorage.setItem(USER_KEY, JSON.stringify(userData));
          } else {
            // Token invalid, clear storage
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setState({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (error) {
          console.error("Auth initialization error:", error);
          // On error, try to use cached user data
          try {
            const user = JSON.parse(storedUser) as User;
            setState({
              user,
              token: storedToken,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setState({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        }
      } else {
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // OAuth2 password grant requires form-urlencoded data
      const formData = new URLSearchParams();
      formData.append("username", credentials.email);
      formData.append("password", credentials.password);

      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Login fehlgeschlagen" }));
        throw new Error(error.detail || "Login fehlgeschlagen");
      }

      const { access_token } = await response.json();

      // Fetch user data
      const userResponse = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("Benutzerinformationen konnten nicht geladen werden");
      }

      const user = await userResponse.json();

      // Store in localStorage
      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      setState({
        user,
        token: access_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  // Register function
  const register = useCallback(async (credentials: RegisterCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Registrierung fehlgeschlagen" }));
        throw new Error(error.detail || "Registrierung fehlgeschlagen");
      }

      const { user, access_token } = await response.json();

      // Store in localStorage
      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      setState({
        user,
        token: access_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!state.token) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${state.token}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        setState((prev) => ({ ...prev, user }));
      } else if (response.status === 401) {
        // Token expired
        logout();
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, [state.token, logout]);

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Helper to get token (for API calls outside of React)
export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export default AuthContext;
