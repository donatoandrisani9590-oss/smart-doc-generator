/**
 * Error Boundary - Fängt React-Fehler ab
 *
 * Verhindert, dass die gesamte App bei einem Fehler abstürzt.
 * Zeigt eine benutzerfreundliche Fehlermeldung an.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logError } from "@/lib/logger";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    /** Show detailed error info (only in development) */
    showDetails?: boolean;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });

        // Log error
        logError("ErrorBoundary caught error", {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        });

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleGoHome = () => {
        window.location.href = "/";
    };

    handleReportError = () => {
        const { error, errorInfo } = this.state;
        const errorReport = {
            message: error?.message,
            stack: error?.stack,
            componentStack: errorInfo?.componentStack,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
        };

        // Copy to clipboard
        navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));
        alert("Fehlerdetails wurden in die Zwischenablage kopiert.");
    };

    render() {
        const { hasError, error, errorInfo } = this.state;
        const { children, fallback, showDetails = import.meta.env.DEV } = this.props;

        if (hasError) {
            // Custom fallback
            if (fallback) {
                return fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen bg-background flex items-center justify-center p-6">
                    <Card className="max-w-lg w-full">
                        <CardHeader className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                                <AlertTriangle className="w-8 h-8 text-destructive" />
                            </div>
                            <CardTitle className="text-xl">Etwas ist schiefgelaufen</CardTitle>
                            <CardDescription>
                                Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Error message */}
                            {showDetails && error && (
                                <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                                    <p className="text-sm font-mono text-destructive break-all">
                                        {error.message}
                                    </p>
                                </div>
                            )}

                            {/* Stack trace (development only) */}
                            {showDetails && errorInfo?.componentStack && (
                                <details className="text-xs">
                                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                        Technische Details anzeigen
                                    </summary>
                                    <pre className="mt-2 p-3 bg-muted rounded-lg overflow-auto max-h-48 text-[10px]">
                                        {errorInfo.componentStack}
                                    </pre>
                                </details>
                            )}

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button onClick={this.handleRetry} className="flex-1">
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Erneut versuchen
                                </Button>
                                <Button variant="outline" onClick={this.handleGoHome} className="flex-1">
                                    <Home className="w-4 h-4 mr-2" />
                                    Zur Startseite
                                </Button>
                            </div>

                            {/* Report button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={this.handleReportError}
                                className="w-full text-muted-foreground"
                            >
                                <Bug className="w-4 h-4 mr-2" />
                                Fehler melden
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return children;
    }
}

/**
 * Higher-order component to wrap components with error boundary
 */
// eslint-disable-next-line react-refresh/only-export-components
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundaryWrapper(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}

/**
 * Page-level error boundary with navigation
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary
            onError={(error) => {
                logError("Page error", { error: error.message });
            }}
        >
            {children}
        </ErrorBoundary>
    );
}
