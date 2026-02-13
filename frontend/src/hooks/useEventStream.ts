/**
 * useEventStream - Server-Sent Events Hook für Real-time Updates
 *
 * Verwaltet eine SSE-Verbindung zum Backend und invalidiert
 * React Query Caches bei eingehenden Events.
 *
 * Features:
 * - Auto-Reconnection via EventSource retry (3s)
 * - Page Visibility API: schließt nach 5min im Hintergrund
 * - Graceful: Polling-Fallback bleibt aktiv wenn SSE nicht verfügbar
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/contexts/AuthContext";
import { getApiBaseUrl } from "@/lib/api-client";

/** Wie lange der Tab im Hintergrund sein darf bevor SSE geschlossen wird (ms) */
const BACKGROUND_TIMEOUT = 5 * 60 * 1000; // 5 Minuten

export function useEventStream() {
    const queryClient = useQueryClient();
    const [isConnected, setIsConnected] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);
    const backgroundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const connect = useCallback(() => {
        // Cleanup vorherige Verbindung
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        const token = getAuthToken();
        if (!token) return;

        const apiBase = getApiBaseUrl();
        if (!apiBase) return;

        const url = `${apiBase}/api/v1/events/stream?token=${encodeURIComponent(token)}`;
        const es = new EventSource(url);

        es.onopen = () => {
            setIsConnected(true);
        };

        es.onerror = () => {
            setIsConnected(false);
            // EventSource reconnected automatisch via retry: 3000 vom Server
        };

        // ── Event Handler ─────────────────────────────────────────────

        es.addEventListener("notification:new", () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notification-count"] });
        });

        es.addEventListener("comment:new", (e: MessageEvent) => {
            try {
                const d = JSON.parse(e.data);
                queryClient.invalidateQueries({
                    queryKey: ["comments", "list", d.anchor_type, d.anchor_id],
                });
            } catch {
                // Fallback: alle Kommentare invalidieren
                queryClient.invalidateQueries({ queryKey: ["comments"] });
            }
        });

        es.addEventListener("comment:resolved", (e: MessageEvent) => {
            try {
                const d = JSON.parse(e.data);
                queryClient.invalidateQueries({
                    queryKey: ["comments", "list", d.anchor_type, d.anchor_id],
                });
            } catch {
                queryClient.invalidateQueries({ queryKey: ["comments"] });
            }
        });

        es.addEventListener("approval:update", (e: MessageEvent) => {
            try {
                const d = JSON.parse(e.data);
                queryClient.invalidateQueries({ queryKey: ["document-approvals"] });
                queryClient.invalidateQueries({
                    queryKey: ["document-approvals", "document", d.document_id],
                });
            } catch {
                queryClient.invalidateQueries({ queryKey: ["document-approvals"] });
            }
        });

        // ping Events ignorieren (Keepalive)

        eventSourceRef.current = es;
    }, [queryClient]);

    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            setIsConnected(false);
        }
    }, []);

    // ── Haupt-Effect: Verbindung aufbauen ─────────────────────────────

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    // ── Page Visibility API ───────────────────────────────────────────

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab geht in den Hintergrund → Timer starten
                backgroundTimerRef.current = setTimeout(() => {
                    disconnect();
                }, BACKGROUND_TIMEOUT);
            } else {
                // Tab kommt zurück → Timer abbrechen, neu verbinden
                if (backgroundTimerRef.current) {
                    clearTimeout(backgroundTimerRef.current);
                    backgroundTimerRef.current = null;
                }
                if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
                    connect();
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (backgroundTimerRef.current) {
                clearTimeout(backgroundTimerRef.current);
            }
        };
    }, [connect, disconnect]);

    return { isConnected };
}
