/**
 * Footer - Minimal page anchor
 *
 * Connection status only. No clutter.
 */

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export const Footer = () => {
    const isOnline = useOnlineStatus();

    return (
        <footer className="px-8 py-3 flex items-center justify-center text-[11px] text-muted-foreground/20">
            <div className="flex items-center gap-2">
                <span
                    className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-400/40" : "bg-red-400/40"}`}
                    aria-hidden="true"
                />
                <span>{isOnline ? "Verbunden" : "Offline"}</span>
            </div>
        </footer>
    );
};
