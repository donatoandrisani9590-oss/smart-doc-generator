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

// API Base URL (trim whitespace/newlines — env vars can have trailing \n)
const API_BASE = (import.meta.env.VITE_API_URL || "").trim();

// Dev Mode - skip auth validation for local testing
const DEV_MODE = import.meta.env.DEV && !(import.meta.env.VITE_API_URL || "").trim();

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

export interface SSOProvider {
  id: string;
  label: string;
  icon: string;
  authorize_url: string;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  handleSSOCallback: (token: string) => Promise<void>;
  ssoProviders: SSOProvider[];
  ssoEnabled: boolean;
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";
const USER_KEY = "auth_user";

// Helper: Clear all auth data from localStorage
function clearAuthStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Helper: Try to refresh access token using refresh token
async function tryRefreshToken(refreshToken: string): Promise<{ token: string; user: User } | null> {
  try {
    const refreshResponse = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!refreshResponse.ok) return null;

    const refreshData = await refreshResponse.json();
    const newAccessToken = refreshData.access_token;
    const newRefreshToken = refreshData.refresh_token;

    // Store new tokens
    localStorage.setItem(TOKEN_KEY, newAccessToken);
    if (newRefreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
    }

    // Fetch user data with new token
    const userResponse = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });

    if (!userResponse.ok) return null;

    const user = await userResponse.json();
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    return { token: newAccessToken, user };
  } catch {
    return null;
  }
}

// Provider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [ssoProviders, setSsoProviders] = useState<SSOProvider[]>([]);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    const initAuth = async () => {
      // DEV MODE: Auto-login with mock user for local development
      if (DEV_MODE) {
        // DEV_MODE: Auto-login with mock user (no console output in production builds)
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
          } else if (response.status === 401) {
            // Access token expired - try refresh token
            const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
            if (storedRefreshToken) {
              const refreshed = await tryRefreshToken(storedRefreshToken);
              if (refreshed) {
                setState({
                  user: refreshed.user,
                  token: refreshed.token,
                  isAuthenticated: true,
                  isLoading: false,
                });
              } else {
                // Refresh also failed - full logout
                clearAuthStorage();
                setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
              }
            } else {
              // No refresh token - logout
              clearAuthStorage();
              setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
            }
          } else {
            // Other error, clear storage
            clearAuthStorage();
            setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
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
            clearAuthStorage();
            setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
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

    // Listen for logout events from API client (token refresh failed)
    const handleForceLogout = () => {
      clearAuthStorage();
      setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
    };
    window.addEventListener("auth:logout", handleForceLogout);

    // Fetch SSO providers (only if not in DEV_MODE)
    if (!DEV_MODE) {
      fetch(`${API_BASE}/api/v1/auth/sso/providers`)
        .then((res) => res.json())
        .then((data) => {
          if (data.sso_enabled && data.providers?.length > 0) {
            setSsoEnabled(true);
            setSsoProviders(data.providers);
          }
        })
        .catch(() => {
          // SSO not available - that's fine, don't show SSO buttons
        });
    }

    return () => {
      window.removeEventListener("auth:logout", handleForceLogout);
    };
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

      const loginData = await response.json();

      // Check if 2FA is required
      if (loginData.requires_2fa) {
        setState((prev) => ({ ...prev, isLoading: false }));
        const err = new Error("2FA_REQUIRED");
        (err as any).preAuthToken = loginData.access_token;
        throw err;
      }

      const access_token = loginData.access_token;
      const refresh_token = loginData.refresh_token;

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
      if (refresh_token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
      }
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

      const data = await response.json();
      const { user, access_token } = data;
      const refresh_token = data.refresh_token;

      // Store in localStorage
      localStorage.setItem(TOKEN_KEY, access_token);
      if (refresh_token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
      }
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

  // Handle SSO callback - validate token and store session
  const handleSSOCallback = useCallback(async (token: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Validate token by fetching user data
      const userResponse = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("SSO-Token ist ungültig oder abgelaufen.");
      }

      const user = await userResponse.json();

      // Store in localStorage
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      setState({
        user,
        token,
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
    clearAuthStorage();
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  // Refresh user data (with automatic token renewal)
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
        // Access token expired - try refresh
        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (storedRefreshToken) {
          const refreshed = await tryRefreshToken(storedRefreshToken);
          if (refreshed) {
            setState((prev) => ({ ...prev, user: refreshed.user, token: refreshed.token }));
            return;
          }
        }
        // Refresh failed - full logout
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
    handleSSOCallback,
    ssoProviders,
    ssoEnabled,
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

// Helper to get refresh token (for API client token renewal)
export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export default AuthContext;
