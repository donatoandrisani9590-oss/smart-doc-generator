/**
 * useOnlineStatus - Online/Offline-Erkennung
 *
 * Überwacht den Verbindungsstatus und zeigt einen Indikator an.
 */

import { useState, useEffect, useRef, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw, ServerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-client";

interface OnlineStatusContextType {
    isOnline: boolean;
    /** Backend is reachable */
    isBackendReachable: boolean;
    /** Time since last online (in ms) */
    offlineSince: number | null;
    /** Manually check connection */
    checkConnection: () => Promise<boolean>;
}

const OnlineStatusContext = createContext<OnlineStatusContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useOnlineStatus(): OnlineStatusContextType {
    const context = useContext(OnlineStatusContext);
    if (!context) {
        throw new Error("useOnlineStatus must be used within OnlineStatusProvider");
    }
    return context;
}

interface OnlineStatusProviderProps {
    children: ReactNode;
    /** Show offline banner */
    showBanner?: boolean;
    /** Ping endpoint to verify connection */
    pingEndpoint?: string;
}

export function OnlineStatusProvider({
    children,
    showBanner = true,
    pingEndpoint = "/api/v1/health",
}: OnlineStatusProviderProps) {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== "undefined" ? navigator.onLine : true
    );
    const [isBackendReachable, setIsBackendReachable] = useState(true);
    const [offlineSince, setOfflineSince] = useState<number | null>(null);
    const [showReconnected, setShowReconnected] = useState(false);
    const backendCheckRef = useRef<ReturnType<typeof setInterval>>(undefined);

    // Build full backend URL for health pings
    const backendPingUrl = `${getApiBaseUrl()}${pingEndpoint}`;

    // Check connection by pinging backend server
    const checkConnection = async (): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(backendPingUrl, {
                method: "HEAD",
                cache: "no-store",
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const online = response.ok;
            setIsOnline(online);
            setIsBackendReachable(online);
            if (online && offlineSince) {
                setOfflineSince(null);
                setShowReconnected(true);
                setTimeout(() => setShowReconnected(false), 3000);
            }
            return online;
        } catch {
            setIsBackendReachable(false);
            if (navigator.onLine) {
                // Browser is online but backend is down
                setIsOnline(true);
            } else {
                setIsOnline(false);
            }
            if (!offlineSince) {
                setOfflineSince(Date.now());
            }
            return false;
        }
    };

    // Initial backend health check on mount
    useEffect(() => {
        const timer = setTimeout(() => checkConnection(), 2000);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // When browser comes back online, verify backend too
            checkConnection();
        };

        const handleOffline = () => {
            setIsOnline(false);
            setIsBackendReachable(false);
            if (!offlineSince) {
                setOfflineSince(Date.now());
            }
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Also listen for custom events from API client
        window.addEventListener("app:online", handleOnline);
        window.addEventListener("app:offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("app:online", handleOnline);
            window.removeEventListener("app:offline", handleOffline);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offlineSince]);

    // Periodic connection check when offline or backend unreachable
    useEffect(() => {
        if (isOnline && isBackendReachable) {
            if (backendCheckRef.current) clearInterval(backendCheckRef.current);
            return;
        }

        backendCheckRef.current = setInterval(() => {
            checkConnection();
        }, 10000); // Check every 10 seconds

        return () => {
            if (backendCheckRef.current) clearInterval(backendCheckRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline, isBackendReachable]);

    return (
        <OnlineStatusContext.Provider value={{ isOnline, isBackendReachable, offlineSince, checkConnection }}>
            {children}

            {showBanner && (
                <>
                    {/* Offline Banner (no internet) */}
                    <AnimatePresence>
                        {!isOnline && (
                            <OfflineBanner
                                offlineSince={offlineSince}
                                onRetry={checkConnection}
                            />
                        )}
                    </AnimatePresence>

                    {/* Backend Unreachable Banner (internet OK but server down) */}
                    <AnimatePresence>
                        {isOnline && !isBackendReachable && (
                            <BackendDownBanner onRetry={checkConnection} />
                        )}
                    </AnimatePresence>

                    {/* Reconnected Toast */}
                    <AnimatePresence>
                        {showReconnected && <ReconnectedToast />}
                    </AnimatePresence>
                </>
            )}
        </OnlineStatusContext.Provider>
    );
}

interface OfflineBannerProps {
    offlineSince: number | null;
    onRetry: () => void;
}

function OfflineBanner({ offlineSince, onRetry }: OfflineBannerProps) {
    const [isRetrying, setIsRetrying] = useState(false);

    const handleRetry = async () => {
        setIsRetrying(true);
        await onRetry();
        setIsRetrying(false);
    };

    const formatDuration = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds} Sekunden`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} Minute${minutes > 1 ? "n" : ""}`;
        const hours = Math.floor(minutes / 60);
        return `${hours} Stunde${hours > 1 ? "n" : ""}`;
    };

    return (
        <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-3 shadow-lg"
            role="alert"
            aria-live="assertive"
        >
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <WifiOff className="w-5 h-5" aria-hidden="true" />
                    <div>
                        <p className="font-medium">Keine Internetverbindung</p>
                        {offlineSince && (
                            <p className="text-sm text-white/80">
                                {/* eslint-disable-next-line react-hooks/purity -- Date.now() needed for live offline duration display */}
                                Offline seit {formatDuration(Date.now() - offlineSince)}
                            </p>
                        )}
                    </div>
                </div>

                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                >
                    {isRetrying ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Erneut versuchen
                </Button>
            </div>
        </motion.div>
    );
}

function BackendDownBanner({ onRetry }: { onRetry: () => void }) {
    const [isRetrying, setIsRetrying] = useState(false);

    const handleRetry = async () => {
        setIsRetrying(true);
        await onRetry();
        setIsRetrying(false);
    };

    return (
        <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg"
            role="alert"
            aria-live="assertive"
        >
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <ServerOff className="w-5 h-5" aria-hidden="true" />
                    <div>
                        <p className="font-medium">Server nicht erreichbar</p>
                        <p className="text-sm text-white/80">
                            Das Backend antwortet nicht. Einige Funktionen sind eingeschränkt.
                        </p>
                    </div>
                </div>

                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                >
                    {isRetrying ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Erneut versuchen
                </Button>
            </div>
        </motion.div>
    );
}

function ReconnectedToast() {
    return (
        <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
            role="status"
            aria-live="polite"
        >
            <Wifi className="w-4 h-4" aria-hidden="true" />
            <span className="font-medium">Verbindung wiederhergestellt</span>
        </motion.div>
    );
}

/**
 * Hook to check if a specific feature should be disabled when offline
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useOfflineDisabled(featureRequiresNetwork: boolean = true): boolean {
    const { isOnline } = useOnlineStatus();
    return featureRequiresNetwork && !isOnline;
}
