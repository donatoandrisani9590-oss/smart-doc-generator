/**
 * useOnlineStatus - Online/Offline-Erkennung
 *
 * Überwacht den Verbindungsstatus und zeigt einen Indikator an.
 */

import { useState, useEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnlineStatusContextType {
    isOnline: boolean;
    /** Time since last online (in ms) */
    offlineSince: number | null;
    /** Manually check connection */
    checkConnection: () => Promise<boolean>;
}

const OnlineStatusContext = createContext<OnlineStatusContextType | null>(null);

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
    const [offlineSince, setOfflineSince] = useState<number | null>(null);
    const [showReconnected, setShowReconnected] = useState(false);

    // Check connection by pinging server
    const checkConnection = async (): Promise<boolean> => {
        try {
            const response = await fetch(pingEndpoint, {
                method: "HEAD",
                cache: "no-store",
            });
            const online = response.ok;
            setIsOnline(online);
            if (online && offlineSince) {
                setOfflineSince(null);
                setShowReconnected(true);
                setTimeout(() => setShowReconnected(false), 3000);
            }
            return online;
        } catch {
            setIsOnline(false);
            if (!offlineSince) {
                setOfflineSince(Date.now());
            }
            return false;
        }
    };

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            if (offlineSince) {
                setShowReconnected(true);
                setTimeout(() => setShowReconnected(false), 3000);
            }
            setOfflineSince(null);
        };

        const handleOffline = () => {
            setIsOnline(false);
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
    }, [offlineSince]);

    // Periodic connection check when offline
    useEffect(() => {
        if (isOnline) return;

        const interval = setInterval(() => {
            checkConnection();
        }, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [isOnline]);

    return (
        <OnlineStatusContext.Provider value={{ isOnline, offlineSince, checkConnection }}>
            {children}

            {showBanner && (
                <>
                    {/* Offline Banner */}
                    <AnimatePresence>
                        {!isOnline && (
                            <OfflineBanner
                                offlineSince={offlineSince}
                                onRetry={checkConnection}
                            />
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
export function useOfflineDisabled(featureRequiresNetwork: boolean = true): boolean {
    const { isOnline } = useOnlineStatus();
    return featureRequiresNetwork && !isOnline;
}
