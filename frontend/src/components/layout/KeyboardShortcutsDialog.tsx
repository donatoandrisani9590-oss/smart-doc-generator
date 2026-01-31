/**
 * KeyboardShortcutsDialog - Übersicht aller Tastaturkürzel
 *
 * v4.2 Feature (Kapitel 15.5.8):
 * Zeigt alle verfügbaren Shortcuts an
 */

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Keyboard, Search, FileText, Save, Home, HelpCircle, Printer, FolderOpen } from "lucide-react";

interface KeyboardShortcutsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
    keys: string[];
    description: string;
    icon: typeof Search;
}

interface ShortcutCategory {
    name: string;
    shortcuts: ShortcutItem[];
}

// Detect OS for modifier key display
const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");
const modKey = isMac ? "⌘" : "Ctrl";

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
    {
        name: "Navigation",
        shortcuts: [
            { keys: [modKey, "K"], description: "Globale Suche öffnen", icon: Search },
            { keys: [modKey, "H"], description: "Zum Dashboard", icon: Home },
            { keys: [modKey, "D"], description: "Entwürfe anzeigen", icon: FolderOpen },
        ],
    },
    {
        name: "Aktionen",
        shortcuts: [
            { keys: [modKey, "N"], description: "Neues Dokument erstellen", icon: FileText },
            { keys: [modKey, "S"], description: "Speichern", icon: Save },
            { keys: [modKey, "P"], description: "Vorschau / Drucken", icon: Printer },
        ],
    },
    {
        name: "Im Editor",
        shortcuts: [
            { keys: [modKey, "B"], description: "Fett", icon: Keyboard },
            { keys: [modKey, "I"], description: "Kursiv", icon: Keyboard },
            { keys: [modKey, "1"], description: "Überschrift 1", icon: Keyboard },
            { keys: [modKey, "2"], description: "Überschrift 2", icon: Keyboard },
            { keys: [modKey, "M"], description: "Platzhalter einfügen", icon: Keyboard },
        ],
    },
    {
        name: "Im Formular",
        shortcuts: [
            { keys: ["Tab"], description: "Nächstes Feld", icon: Keyboard },
            { keys: ["Shift", "Tab"], description: "Vorheriges Feld", icon: Keyboard },
            { keys: ["Enter"], description: "Dokument erstellen", icon: Keyboard },
            { keys: ["Esc"], description: "Abbrechen / Dialog schließen", icon: Keyboard },
        ],
    },
    {
        name: "Hilfe",
        shortcuts: [
            { keys: [modKey, "/"], description: "Diese Hilfe anzeigen", icon: HelpCircle },
            { keys: ["?"], description: "Kontext-Hilfe", icon: HelpCircle },
        ],
    },
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="w-5 h-5" />
                        Tastaturkürzel
                    </DialogTitle>
                    <DialogDescription>
                        Drücken Sie <Badge variant="outline" className="mx-1 font-mono">?</Badge> um diese Hilfe jederzeit anzuzeigen.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {SHORTCUT_CATEGORIES.map((category) => (
                        <div key={category.name}>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                {category.name}
                            </h3>
                            <div className="space-y-2">
                                {category.shortcuts.map((shortcut, idx) => {
                                    const Icon = shortcut.icon;
                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon className="w-4 h-4 text-muted-foreground" />
                                                <span>{shortcut.description}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {shortcut.keys.map((key, keyIdx) => (
                                                    <span key={keyIdx}>
                                                        <kbd className="px-2 py-1 bg-muted border rounded text-xs font-mono">
                                                            {key}
                                                        </kbd>
                                                        {keyIdx < shortcut.keys.length - 1 && (
                                                            <span className="mx-1 text-muted-foreground">+</span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
                    {isMac ? "⌘ = Command-Taste" : "Ctrl = Strg-Taste"}
                </div>
            </DialogContent>
        </Dialog>
    );
}
