/**
 * Footer - Quiet page anchor
 *
 * Non-fixed, appears at end of scrollable content.
 * System status, help links, version.
 */

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export const Footer = () => {
    const isOnline = useOnlineStatus();

    return (
        <footer className="app-footer px-8 py-3 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
                <span
                    className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-500" : "bg-red-400"}`}
                    aria-hidden="true"
                />
                <span>{isOnline ? "Verbunden" : "Offline"}</span>
            </div>

            <div className="flex items-center gap-3">
                <a href="/settings?tab=general" className="hover:text-foreground transition-colors">
                    Hilfe
                </a>
                <span className="text-border">·</span>
                <a href="/settings?tab=general" className="hover:text-foreground transition-colors">
                    Datenschutz
                </a>
                <span className="text-border">·</span>
                <a href="/settings?tab=general" className="hover:text-foreground transition-colors">
                    Impressum
                </a>
            </div>

            <span className="text-muted-foreground/60 tabular-nums">v2.5.0</span>
        </footer>
    );
};
