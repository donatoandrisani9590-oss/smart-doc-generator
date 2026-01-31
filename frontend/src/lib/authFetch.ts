/**
 * Authenticated Fetch Wrapper
 *
 * Wrapper für fetch() der automatisch den Auth-Token hinzufügt.
 * Verwendet in useApi.ts und anderen API-Aufrufen.
 */

import { getAuthToken } from "@/contexts/AuthContext";

// API Base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export interface AuthFetchOptions extends RequestInit {
  /** Skip adding auth token */
  skipAuth?: boolean;
}

/**
 * Fetch wrapper that automatically adds authentication headers
 */
export async function authFetch(
  input: string | URL | Request,
  init?: AuthFetchOptions
): Promise<Response> {
  const { skipAuth = false, ...fetchInit } = init || {};

  // Build URL - prepend API base URL if path starts with /api
  let url: string;
  if (typeof input === "string") {
    if (input.startsWith("/api")) {
      url = `${API_BASE_URL}${input}`;
    } else {
      url = input;
    }
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
  }

  // Build headers
  const headers = new Headers(fetchInit.headers);

  // Add auth token if available and not skipped
  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // Add Content-Type if not set and body exists
  if (fetchInit.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...fetchInit,
    headers,
  });
}

/**
 * Convenience methods for common HTTP verbs
 */
export const authApi = {
  get: (url: string, options?: AuthFetchOptions) =>
    authFetch(url, { ...options, method: "GET" }),

  post: (url: string, body?: unknown, options?: AuthFetchOptions) =>
    authFetch(url, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: (url: string, body?: unknown, options?: AuthFetchOptions) =>
    authFetch(url, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: (url: string, body?: unknown, options?: AuthFetchOptions) =>
    authFetch(url, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: (url: string, options?: AuthFetchOptions) =>
    authFetch(url, { ...options, method: "DELETE" }),
};

export default authFetch;
