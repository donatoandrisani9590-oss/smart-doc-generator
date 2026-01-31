/**
 * useKeyboardShortcuts - Globales Tastaturkürzel-System
 *
 * v4.2 Feature (Kapitel 15.5.8):
 * - Ctrl+K: Globale Suche öffnen
 * - Ctrl+S: Speichern
 * - Ctrl+N: Neues Dokument
 * - Ctrl+?: Hilfe anzeigen
 */

import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Shortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    description: string;
    category: string;
    action: () => void;
}

interface UseKeyboardShortcutsOptions {
    onSave?: () => void;
    onSearch?: () => void;
    onNewDocument?: () => void;
    onHelp?: () => void;
    enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
    const navigate = useNavigate();
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const { enabled = true } = options;

    // Define all shortcuts
    const shortcuts: Shortcut[] = [
        // Navigation
        {
            key: "k",
            ctrl: true,
            description: "Globale Suche öffnen",
            category: "Navigation",
            action: () => options.onSearch?.() || navigate("/search"),
        },
        {
            key: "h",
            ctrl: true,
            description: "Zum Dashboard",
            category: "Navigation",
            action: () => navigate("/"),
        },
        {
            key: "d",
            ctrl: true,
            description: "Entwürfe anzeigen",
            category: "Navigation",
            action: () => navigate("/drafts"),
        },

        // Actions
        {
            key: "n",
            ctrl: true,
            description: "Neues Dokument",
            category: "Aktionen",
            action: () => options.onNewDocument?.() || navigate("/generator"),
        },
        {
            key: "s",
            ctrl: true,
            description: "Speichern",
            category: "Aktionen",
            action: () => {
                if (options.onSave) {
                    options.onSave();
                }
            },
        },
        {
            key: "p",
            ctrl: true,
            description: "Vorschau / Drucken",
            category: "Aktionen",
            action: () => window.print(),
        },

        // Help
        {
            key: "/",
            ctrl: true,
            description: "Tastaturkürzel anzeigen",
            category: "Hilfe",
            action: () => setShowShortcutsHelp(true),
        },
        {
            key: "?",
            shift: true,
            description: "Hilfe anzeigen",
            category: "Hilfe",
            action: () => options.onHelp?.() || setShowShortcutsHelp(true),
        },
        {
            key: "Escape",
            description: "Dialog schließen",
            category: "Hilfe",
            action: () => setShowShortcutsHelp(false),
        },
    ];

    // Handle keydown
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (!enabled) return;

            // Ignore if typing in an input
            const target = event.target as HTMLElement;
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                // Only allow Escape in inputs
                if (event.key !== "Escape") return;
            }

            // Find matching shortcut
            for (const shortcut of shortcuts) {
                const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
                const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
                const altMatch = shortcut.alt ? event.altKey : !event.altKey;
                const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

                if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                    event.preventDefault();
                    shortcut.action();
                    return;
                }
            }
        },
        [enabled, shortcuts]
    );

    // Attach listener
    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    return {
        shortcuts,
        showShortcutsHelp,
        setShowShortcutsHelp,
    };
}

/**
 * Formatiert einen Shortcut für die Anzeige.
 */
export function formatShortcut(shortcut: Pick<Shortcut, "key" | "ctrl" | "shift" | "alt">): string {
    const parts: string[] = [];

    // Detect OS for proper modifier key display
    const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");

    if (shortcut.ctrl) {
        parts.push(isMac ? "⌘" : "Ctrl");
    }
    if (shortcut.shift) {
        parts.push(isMac ? "⇧" : "Shift");
    }
    if (shortcut.alt) {
        parts.push(isMac ? "⌥" : "Alt");
    }

    // Format key
    let keyDisplay = shortcut.key.toUpperCase();
    if (keyDisplay === "ESCAPE") keyDisplay = "Esc";
    if (keyDisplay === "/") keyDisplay = "/";
    if (keyDisplay === "?") keyDisplay = "?";

    parts.push(keyDisplay);

    return parts.join(isMac ? "" : "+");
}
