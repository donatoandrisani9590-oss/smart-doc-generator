/**
 * useErrorHandler - Globaler Error-State Handler
 *
 * Zentralisiert die Fehlerbehandlung in der Anwendung.
 * Bietet konsistente Fehlermeldungen und Logging.
 */

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/logger";
import { isApiError, getErrorMessage } from "@/lib/api-client";
import type { ApiError } from "@/lib/api-client";

// ============================================================================
// Types
// ============================================================================

interface ErrorState {
    id: string;
    message: string;
    title?: string;
    type: "error" | "warning" | "info";
    dismissible?: boolean;
    action?: {
        label: string;
        onClick: () => void;
    };
    timestamp: Date;
}

interface ErrorHandlerContextType {
    /** Current errors */
    errors: ErrorState[];
    /** Add an error */
    addError: (error: Omit<ErrorState, "id" | "timestamp">) => string;
    /** Remove an error by ID */
    removeError: (id: string) => void;
    /** Clear all errors */
    clearErrors: () => void;
    /** Handle any error (converts to ErrorState) */
    handleError: (error: unknown, context?: string) => void;
    /** Handle API error specifically */
    handleApiError: (error: ApiError, context?: string) => void;
    /** Check if there are any errors */
    hasErrors: boolean;
}

const ErrorHandlerContext = createContext<ErrorHandlerContextType | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface ErrorHandlerProviderProps {
    children: ReactNode;
    /** Maximum number of errors to display */
    maxErrors?: number;
    /** Auto-dismiss errors after this duration (ms) */
    autoDismissAfter?: number;
    /** Show error banner at top of page */
    showBanner?: boolean;
}

export function ErrorHandlerProvider({
    children,
    maxErrors = 5,
    autoDismissAfter = 10000,
    showBanner = true,
}: ErrorHandlerProviderProps) {
    const [errors, setErrors] = useState<ErrorState[]>([]);

    const addError = useCallback(
        (error: Omit<ErrorState, "id" | "timestamp">): string => {
            const id = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newError: ErrorState = {
                ...error,
                id,
                timestamp: new Date(),
                dismissible: error.dismissible ?? true,
            };

            setErrors((prev) => {
                const updated = [newError, ...prev].slice(0, maxErrors);
                return updated;
            });

            // Auto-dismiss if enabled
            if (autoDismissAfter > 0 && newError.dismissible) {
                setTimeout(() => {
                    removeError(id);
                }, autoDismissAfter);
            }

            return id;
        },
        [maxErrors, autoDismissAfter]
    );

    const removeError = useCallback((id: string) => {
        setErrors((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const clearErrors = useCallback(() => {
        setErrors([]);
    }, []);

    const handleError = useCallback(
        (error: unknown, context?: string) => {
            const message = getErrorMessage(error);
            const errorContext = context ? `[${context}] ` : "";

            logError(`${errorContext}Error handled`, {
                message,
                context,
                type: typeof error,
                isApiError: isApiError(error),
            });

            addError({
                message: `${errorContext}${message}`,
                type: "error",
            });
        },
        [addError]
    );

    const handleApiError = useCallback(
        (error: ApiError, context?: string) => {
            const errorContext = context ? `[${context}] ` : "";
            let title = "Fehler";
            let type: ErrorState["type"] = "error";

            // Customize based on status code
            if (error.status === 401) {
                title = "Nicht autorisiert";
            } else if (error.status === 403) {
                title = "Keine Berechtigung";
            } else if (error.status === 404) {
                title = "Nicht gefunden";
                type = "warning";
            } else if (error.status === 422) {
                title = "Validierungsfehler";
                type = "warning";
            } else if (error.status >= 500) {
                title = "Serverfehler";
            } else if (error.code === "OFFLINE") {
                title = "Keine Verbindung";
                type = "warning";
            } else if (error.code === "TIMEOUT") {
                title = "Zeitüberschreitung";
                type = "warning";
            }

            logError(`${errorContext}API Error handled`, {
                message: error.message,
                status: error.status,
                code: error.code,
                context,
            });

            addError({
                title,
                message: error.message,
                type,
                action:
                    error.code === "TIMEOUT" || error.code === "NETWORK_ERROR"
                        ? {
                              label: "Erneut versuchen",
                              onClick: () => window.location.reload(),
                          }
                        : undefined,
            });
        },
        [addError]
    );

    const hasErrors = errors.length > 0;

    return (
        <ErrorHandlerContext.Provider
            value={{
                errors,
                addError,
                removeError,
                clearErrors,
                handleError,
                handleApiError,
                hasErrors,
            }}
        >
            {children}

            {/* Error Banner - mit Index für Positioning */}
            {showBanner && (
                <AnimatePresence>
                    {errors.map((error, index) => (
                        <ErrorBanner
                            key={error.id}
                            error={error}
                            index={index}
                            onDismiss={() => removeError(error.id)}
                        />
                    ))}
                </AnimatePresence>
            )}
        </ErrorHandlerContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

export function useErrorHandler(): ErrorHandlerContextType {
    const context = useContext(ErrorHandlerContext);
    if (!context) {
        throw new Error("useErrorHandler must be used within an ErrorHandlerProvider");
    }
    return context;
}

// ============================================================================
// Error Banner Component
// ============================================================================

interface ErrorBannerProps {
    error: ErrorState;
    index: number;
    onDismiss: () => void;
}

function ErrorBanner({ error, index, onDismiss }: ErrorBannerProps) {
    const bgColor = {
        error: "bg-destructive text-destructive-foreground",
        warning: "bg-amber-500 text-white",
        info: "bg-blue-500 text-white",
    }[error.type];

    // Jedes Banner bekommt einen Offset basierend auf seinem Index (80px pro Banner)
    const topOffset = 16 + (index * 80);

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ top: `${topOffset}px` }}
            className={`fixed right-4 z-50 max-w-md rounded-lg shadow-lg ${bgColor}`}
            role="alert"
        >
            <div className="flex items-start gap-3 p-4">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    {error.title && (
                        <p className="font-semibold">{error.title}</p>
                    )}
                    <p className="text-sm opacity-90">{error.message}</p>
                    {error.action && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={error.action.onClick}
                            className="mt-2 bg-white/20 hover:bg-white/30"
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            {error.action.label}
                        </Button>
                    )}
                </div>
                {error.dismissible && (
                    <button
                        onClick={onDismiss}
                        className="p-1 rounded hover:bg-white/20 transition-colors"
                        aria-label="Schließen"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// ============================================================================
// Higher-Order Component
// ============================================================================

/**
 * HOC to provide error handling to a component
 */
export function withErrorHandler<P extends object>(
    WrappedComponent: React.ComponentType<P & { errorHandler: ErrorHandlerContextType }>
) {
    return function WithErrorHandlerWrapper(props: P) {
        const errorHandler = useErrorHandler();
        return <WrappedComponent {...props} errorHandler={errorHandler} />;
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a try-catch wrapper with error handling
 */
export function createErrorWrapper(
    handleError: (error: unknown, context?: string) => void,
    context?: string
) {
    return async <T,>(fn: () => Promise<T>): Promise<T | null> => {
        try {
            return await fn();
        } catch (error) {
            handleError(error, context);
            return null;
        }
    };
}

/**
 * Create a sync try-catch wrapper with error handling
 */
export function createSyncErrorWrapper(
    handleError: (error: unknown, context?: string) => void,
    context?: string
) {
    return <T,>(fn: () => T): T | null => {
        try {
            return fn();
        } catch (error) {
            handleError(error, context);
            return null;
        }
    };
}
