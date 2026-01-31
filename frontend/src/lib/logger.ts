/**
 * Logger Service - Zentralisiertes Logging
 *
 * Bietet einheitliches Logging für:
 * - Fehler (errors)
 * - Warnungen (warnings)
 * - Info-Nachrichten
 * - Debug-Ausgaben
 *
 * In Production werden Fehler an einen externen Service gesendet.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    data?: Record<string, unknown>;
    url?: string;
    userAgent?: string;
}

interface LoggerConfig {
    /** Minimum log level to output */
    minLevel: LogLevel;
    /** Whether to send logs to external service */
    sendToServer: boolean;
    /** External logging endpoint */
    endpoint?: string;
    /** Application version */
    appVersion?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// Default configuration
const config: LoggerConfig = {
    minLevel: import.meta.env.DEV ? "debug" : "warn",
    sendToServer: import.meta.env.PROD,
    endpoint: "/api/v1/logs",
    appVersion: import.meta.env.VITE_APP_VERSION || "unknown",
};

// Log buffer for batch sending
let logBuffer: LogEntry[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Create a log entry
 */
function createLogEntry(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
): LogEntry {
    return {
        level,
        message,
        timestamp: new Date().toISOString(),
        data,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };
}

/**
 * Check if log level should be output
 */
function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
}

/**
 * Output log to console
 */
function outputToConsole(entry: LogEntry) {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const args: unknown[] = [prefix, entry.message];

    if (entry.data) {
        args.push(entry.data);
    }

    switch (entry.level) {
        case "debug":
            console.debug(...args);
            break;
        case "info":
            console.info(...args);
            break;
        case "warn":
            console.warn(...args);
            break;
        case "error":
            console.error(...args);
            break;
    }
}

/**
 * Send logs to server (batched)
 */
async function flushLogs() {
    if (logBuffer.length === 0) return;

    const logsToSend = [...logBuffer];
    logBuffer = [];

    if (!config.sendToServer || !config.endpoint) return;

    try {
        await fetch(config.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                logs: logsToSend,
                appVersion: config.appVersion,
            }),
            // Don't wait for response, fire-and-forget
            keepalive: true,
        });
    } catch {
        // Silently fail - we don't want logging to break the app
        // Re-add logs to buffer for retry (with limit)
        if (logBuffer.length < 100) {
            logBuffer.push(...logsToSend);
        }
    }
}

/**
 * Schedule log flush
 */
function scheduleFlush() {
    if (flushTimeout) return;

    flushTimeout = setTimeout(() => {
        flushTimeout = null;
        flushLogs();
    }, 5000); // Batch logs for 5 seconds
}

/**
 * Add log entry
 */
function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (!shouldLog(level)) return;

    const entry = createLogEntry(level, message, data);

    // Always output to console in development
    if (import.meta.env.DEV || level === "error") {
        outputToConsole(entry);
    }

    // Buffer for server in production
    if (config.sendToServer && level !== "debug") {
        logBuffer.push(entry);
        scheduleFlush();
    }
}

// Public API
export function logDebug(message: string, data?: Record<string, unknown>) {
    log("debug", message, data);
}

export function logInfo(message: string, data?: Record<string, unknown>) {
    log("info", message, data);
}

export function logWarn(message: string, data?: Record<string, unknown>) {
    log("warn", message, data);
}

export function logError(message: string, data?: Record<string, unknown>) {
    log("error", message, data);
}

/**
 * Log an API error with context
 */
export function logApiError(
    endpoint: string,
    method: string,
    status: number,
    error: unknown
) {
    logError(`API Error: ${method} ${endpoint}`, {
        status,
        error: error instanceof Error ? error.message : String(error),
    });
}

/**
 * Log a user action for analytics
 */
export function logAction(action: string, data?: Record<string, unknown>) {
    logInfo(`User Action: ${action}`, data);
}

/**
 * Log performance metrics
 */
export function logPerformance(metric: string, durationMs: number, data?: Record<string, unknown>) {
    logInfo(`Performance: ${metric}`, { durationMs, ...data });
}

/**
 * Configure logger
 */
export function configureLogger(newConfig: Partial<LoggerConfig>) {
    Object.assign(config, newConfig);
}

/**
 * Flush pending logs immediately (e.g., before page unload)
 */
export function flushLogsImmediately() {
    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }
    flushLogs();
}

// Flush logs before page unload
if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flushLogsImmediately);
    window.addEventListener("pagehide", flushLogsImmediately);
}
