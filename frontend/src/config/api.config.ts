/**
 * API Configuration
 *
 * Centralized configuration for HTTP client behavior:
 * timeouts, retries, and base URL resolution.
 */

/** Default settings for the API client (api-client.ts) */
export const API_DEFAULTS = {
  /** Request timeout in milliseconds */
  timeout: 30_000,
  /** Number of retry attempts for failed requests */
  retries: 2,
  /** Initial retry delay in ms (doubles with each attempt) */
  retryDelay: 1_000,
} as const;

/** Auto-save configuration for the document wizard */
export const AUTO_SAVE = {
  /** Interval between auto-save attempts in ms */
  interval: 30_000,
  /** Debounce before triggering save in ms */
  debounce: 1_000,
  /** LocalStorage key prefix for auto-save data */
  storagePrefix: "docgen_autosave_",
} as const;
