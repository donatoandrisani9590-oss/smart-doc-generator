/**
 * API Client - Zentralisierte HTTP-Anfragen
 *
 * Bietet:
 * - Automatische Fehlerbehandlung
 * - Request/Response Interceptors
 * - Retry-Logik
 * - Timeout-Handling
 * - Offline-Erkennung
 */

import { logApiError, logWarn } from "./logger";

// Types
export interface ApiError {
    message: string;
    status: number;
    code?: string;
    details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
    data: T;
    status: number;
    headers: Headers;
}

export interface RequestConfig {
    /** Request timeout in ms */
    timeout?: number;
    /** Number of retry attempts */
    retries?: number;
    /** Retry delay in ms (doubles with each retry) */
    retryDelay?: number;
    /** Skip error handling */
    skipErrorHandling?: boolean;
    /** Custom headers */
    headers?: Record<string, string>;
    /** Signal for cancellation */
    signal?: AbortSignal;
}

// Default configuration
const DEFAULT_CONFIG: Required<Omit<RequestConfig, "signal" | "skipErrorHandling">> = {
    timeout: 30000, // 30 seconds
    retries: 2,
    retryDelay: 1000, // 1 second
    headers: {},
};

// Base URL
const BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Get the API base URL for direct fetch calls
 */
export function getApiBaseUrl(): string {
    return BASE_URL;
}

// Online status
let isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

// Event listeners for online/offline
if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
        isOnline = true;
        window.dispatchEvent(new CustomEvent("app:online"));
    });
    window.addEventListener("offline", () => {
        isOnline = false;
        window.dispatchEvent(new CustomEvent("app:offline"));
    });
}

/**
 * Check if we're online
 */
export function checkOnlineStatus(): boolean {
    return isOnline;
}

/**
 * Create API error from response
 */
async function createApiError(response: Response): Promise<ApiError> {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;

    try {
        const body = await response.json();
        if (body.message) message = body.message;
        if (body.detail) message = body.detail;
        if (body.code) code = body.code;
        if (body.errors) details = body.errors;
    } catch {
        // Response is not JSON, use status text
    }

    return {
        message,
        status: response.status,
        code,
        details,
    };
}

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(status: number): boolean {
    // Retry on network errors (0), timeouts, and server errors (5xx)
    return status === 0 || status === 408 || status === 429 || (status >= 500 && status < 600);
}

/**
 * Make HTTP request with retries and error handling
 */
async function request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    config: RequestConfig = {}
): Promise<ApiResponse<T>> {
    const {
        timeout = DEFAULT_CONFIG.timeout,
        retries = DEFAULT_CONFIG.retries,
        retryDelay = DEFAULT_CONFIG.retryDelay,
        headers = {},
        signal,
        skipErrorHandling = false,
    } = config;

    // Check online status
    if (!isOnline) {
        const error: ApiError = {
            message: "Keine Internetverbindung",
            status: 0,
            code: "OFFLINE",
        };
        throw error;
    }

    const url = `${BASE_URL}${endpoint}`;

    // Build headers
    const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...headers,
    };

    // Get auth token if available
    const token = localStorage.getItem("auth_token");
    if (token) {
        requestHeaders["Authorization"] = `Bearer ${token}`;
    }

    let lastError: ApiError | null = null;
    let attempt = 0;

    while (attempt <= retries) {
        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            // Combine with external signal if provided
            const combinedSignal = signal
                ? AbortSignal.any([signal, controller.signal])
                : controller.signal;

            const response = await fetch(url, {
                method,
                headers: requestHeaders,
                body: body ? JSON.stringify(body) : undefined,
                signal: combinedSignal,
            });

            clearTimeout(timeoutId);

            // Handle successful response
            if (response.ok) {
                // Handle 204 No Content
                if (response.status === 204) {
                    return {
                        data: null as T,
                        status: response.status,
                        headers: response.headers,
                    };
                }

                // Check content type to determine how to parse response
                const contentType = response.headers.get("content-type") || "";
                let data: T;

                if (contentType.includes("text/html") || contentType.includes("text/plain")) {
                    // Return raw text for HTML/text responses
                    data = await response.text() as T;
                } else {
                    // Default to JSON parsing
                    data = await response.json();
                }

                return {
                    data,
                    status: response.status,
                    headers: response.headers,
                };
            }

            // Handle error response
            const error = await createApiError(response);

            // Check if retryable
            if (isRetryableError(response.status) && attempt < retries) {
                lastError = error;
                attempt++;
                logWarn(`Request failed, retrying (${attempt}/${retries})`, {
                    endpoint,
                    status: response.status,
                });
                await sleep(retryDelay * Math.pow(2, attempt - 1));
                continue;
            }

            // Non-retryable error
            if (!skipErrorHandling) {
                logApiError(endpoint, method, response.status, error);
            }
            throw error;

        } catch (err) {
            // Handle abort/timeout
            if (err instanceof DOMException && err.name === "AbortError") {
                const error: ApiError = {
                    message: "Anfrage abgebrochen oder Zeitüberschreitung",
                    status: 408,
                    code: "TIMEOUT",
                };

                if (attempt < retries) {
                    lastError = error;
                    attempt++;
                    logWarn(`Request timeout, retrying (${attempt}/${retries})`, { endpoint });
                    await sleep(retryDelay * Math.pow(2, attempt - 1));
                    continue;
                }

                if (!skipErrorHandling) {
                    logApiError(endpoint, method, 408, error);
                }
                throw error;
            }

            // Handle network errors
            if (err instanceof TypeError && err.message.includes("fetch")) {
                const error: ApiError = {
                    message: "Netzwerkfehler",
                    status: 0,
                    code: "NETWORK_ERROR",
                };

                if (attempt < retries) {
                    lastError = error;
                    attempt++;
                    logWarn(`Network error, retrying (${attempt}/${retries})`, { endpoint });
                    await sleep(retryDelay * Math.pow(2, attempt - 1));
                    continue;
                }

                if (!skipErrorHandling) {
                    logApiError(endpoint, method, 0, error);
                }
                throw error;
            }

            // Re-throw API errors
            if ((err as ApiError).status !== undefined) {
                throw err;
            }

            // Unknown error
            const error: ApiError = {
                message: err instanceof Error ? err.message : "Unbekannter Fehler",
                status: 0,
                code: "UNKNOWN",
            };
            throw error;
        }
    }

    // Should not reach here, but just in case
    throw lastError || { message: "Unbekannter Fehler", status: 0 };
}

// HTTP method wrappers
export const api = {
    get: <T>(endpoint: string, config?: RequestConfig) =>
        request<T>("GET", endpoint, undefined, config),

    post: <T>(endpoint: string, body?: unknown, config?: RequestConfig) =>
        request<T>("POST", endpoint, body, config),

    put: <T>(endpoint: string, body?: unknown, config?: RequestConfig) =>
        request<T>("PUT", endpoint, body, config),

    patch: <T>(endpoint: string, body?: unknown, config?: RequestConfig) =>
        request<T>("PATCH", endpoint, body, config),

    delete: <T>(endpoint: string, config?: RequestConfig) =>
        request<T>("DELETE", endpoint, undefined, config),
};

/**
 * Type guard for API errors
 */
export function isApiError(error: unknown): error is ApiError {
    return (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        "message" in error
    );
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
    if (isApiError(error)) {
        switch (error.code) {
            case "OFFLINE":
                return "Sie sind offline. Bitte überprüfen Sie Ihre Internetverbindung.";
            case "TIMEOUT":
                return "Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.";
            case "NETWORK_ERROR":
                return "Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung.";
            default:
                return error.message;
        }
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "Ein unbekannter Fehler ist aufgetreten.";
}
