/**
 * Sentry Error Tracking - Frontend Integration
 *
 * Initializes Sentry SDK for error tracking and performance monitoring.
 * Set VITE_SENTRY_DSN environment variable to enable.
 * When DSN is empty, all calls are no-ops.
 *
 * NOTE: @sentry/react is an optional peer dependency.
 * Install it only when you want to enable Sentry:
 *   npm install @sentry/react
 */

let _sentryEnabled = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _Sentry: any = null;

/**
 * Initialize Sentry for the frontend.
 * Called once in main.tsx before React renders.
 */
export async function initSentry(): Promise<void> {
    const dsn = import.meta.env.VITE_SENTRY_DSN;

    if (!dsn) {
        console.info("[Sentry] DSN not configured – error tracking disabled");
        return;
    }

    try {
        // Dynamic import - only resolves if @sentry/react is installed
        _Sentry = await (Function('return import("@sentry/react")')());

        _Sentry.init({
            dsn,
            environment: import.meta.env.MODE,
            release: `docgen-frontend@${import.meta.env.VITE_APP_VERSION || "0.0.0"}`,
            tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
            ignoreErrors: [
                "Failed to fetch",
                "NetworkError",
                "Load failed",
                "ResizeObserver loop",
                "AbortError",
            ],
        });

        _sentryEnabled = true;
        console.info("[Sentry] Initialized successfully");
    } catch {
        console.warn("[Sentry] Not available – install @sentry/react to enable");
    }
}

/**
 * Capture an exception to Sentry.
 * Falls back to console.error if Sentry is not enabled.
 */
export function captureException(
    error: unknown,
    context?: Record<string, unknown>
): void {
    if (_sentryEnabled && _Sentry) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _Sentry.withScope((scope: any) => {
            if (context) {
                Object.entries(context).forEach(([key, value]) => {
                    scope.setExtra(key, value);
                });
            }
            _Sentry.captureException(error);
        });
    } else {
        console.error("[Error]", error, context);
    }
}

/**
 * Capture a message to Sentry.
 */
export function captureMessage(
    message: string,
    level: "info" | "warning" | "error" = "info"
): void {
    if (_sentryEnabled && _Sentry) {
        _Sentry.captureMessage(message, level);
    }
}

/**
 * Set user context for error reports.
 */
export function setUser(id: string, email?: string): void {
    if (_sentryEnabled && _Sentry) {
        _Sentry.setUser({ id, email });
    }
}

/**
 * Clear user context (on logout).
 */
export function clearUser(): void {
    if (_sentryEnabled && _Sentry) {
        _Sentry.setUser(null);
    }
}
