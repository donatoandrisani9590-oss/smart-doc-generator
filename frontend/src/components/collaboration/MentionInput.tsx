/**
 * MentionInput - Textarea mit @Mention Autocomplete
 *
 * Features:
 * - @mention Autocomplete beim Tippen
 * - User-Suche in Echtzeit
 * - Keyboard Navigation (Pfeiltasten, Enter, Escape)
 * - Highlighting von @mentions im Text
 *
 * Verwendung:
 * <MentionInput
 *   value={text}
 *   onChange={setText}
 *   placeholder="Kommentar schreiben..."
 * />
 */

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AtSign, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useMentionSuggestions } from "@/hooks/useComments";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface UserSuggestion {
    id: number;
    email: string;
    name?: string;
    avatar_url?: string;
}

export interface MentionInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    disabled?: boolean;
    maxLength?: number;
    rows?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════════════════════════

const getInitials = (email: string): string => {
    const name = email.split("@")[0];
    return name.slice(0, 2).toUpperCase();
};

const getAvatarColor = (email: string): string => {
    const colors = [
        "bg-blue-500",
        "bg-green-500",
        "bg-purple-500",
        "bg-orange-500",
        "bg-pink-500",
        "bg-indigo-500",
        "bg-teal-500",
    ];
    const index = email.charCodeAt(0) % colors.length;
    return colors[index];
};

/**
 * Extrahiert das aktuelle @mention-Fragment aus dem Text an der Cursor-Position
 */
const getMentionQuery = (text: string, cursorPosition: number): string | null => {
    // Finde das letzte @ vor dem Cursor
    const textBeforeCursor = text.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex === -1) return null;

    // Prüfe ob zwischen @ und Cursor nur valide Zeichen sind (keine Leerzeichen)
    const mentionPart = textBeforeCursor.slice(lastAtIndex + 1);
    if (mentionPart.includes(" ") || mentionPart.includes("\n")) return null;

    return mentionPart;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const MentionInput = ({
    value,
    onChange,
    placeholder = "Nachricht schreiben...",
    className,
    autoFocus = false,
    disabled = false,
    maxLength = 10000,
    rows = 3,
}: MentionInputProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    const [cursorPosition, setCursorPosition] = useState(0);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Mention Query aus aktuellem Text extrahieren
    const mentionQuery = getMentionQuery(value, cursorPosition);

    // API Hook für Suggestions
    const { data: suggestions = [], isLoading } = useMentionSuggestions(
        mentionQuery || "",
        {
            enabled: !!mentionQuery && mentionQuery.length >= 1,
        }
    );

    // Suggestions anzeigen wenn Query vorhanden und Ergebnisse da
    useEffect(() => {
        if (mentionQuery && (suggestions.length > 0 || isLoading)) {
            setShowSuggestions(true);
            setSelectedIndex(0);
        } else {
            setShowSuggestions(false);
        }
    }, [mentionQuery, suggestions.length, isLoading]);

    // Handle text change
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const newPosition = e.target.selectionStart || 0;

        onChange(newValue);
        setCursorPosition(newPosition);
    }, [onChange]);

    // Handle cursor movement
    const handleSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        setCursorPosition(target.selectionStart || 0);
    }, []);

    // Insert mention at cursor position
    const insertMention = useCallback((user: UserSuggestion) => {
        if (!mentionQuery) return;

        // Finde Start des @-Zeichens
        const textBeforeCursor = value.slice(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf("@");

        // Ersetze @query mit @email
        const mentionText = `@${user.email.split("@")[0]} `;
        const newValue =
            value.slice(0, lastAtIndex) +
            mentionText +
            value.slice(cursorPosition);

        onChange(newValue);
        setShowSuggestions(false);

        // Cursor nach dem eingefügten Mention positionieren
        const newCursorPosition = lastAtIndex + mentionText.length;
        setTimeout(() => {
            textareaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
            textareaRef.current?.focus();
        }, 0);
    }, [value, cursorPosition, mentionQuery, onChange]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showSuggestions || suggestions.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % suggestions.length);
                break;
            case "ArrowUp":
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                break;
            case "Enter":
                if (showSuggestions && suggestions[selectedIndex]) {
                    e.preventDefault();
                    insertMention(suggestions[selectedIndex]);
                }
                break;
            case "Escape":
                e.preventDefault();
                setShowSuggestions(false);
                break;
            case "Tab":
                if (showSuggestions && suggestions[selectedIndex]) {
                    e.preventDefault();
                    insertMention(suggestions[selectedIndex]);
                }
                break;
        }
    }, [showSuggestions, suggestions, selectedIndex, insertMention]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(e.target as Node) &&
                textareaRef.current &&
                !textareaRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className={cn("relative", className)}>
            {/* Textarea */}
            <div className="relative">
                <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={handleChange}
                    onSelect={handleSelect}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    disabled={disabled}
                    maxLength={maxLength}
                    rows={rows}
                    className={cn(
                        "resize-none pr-10",
                        "focus:ring-2 focus:ring-primary/20"
                    )}
                />

                {/* @ Icon hint */}
                <div className="absolute right-3 bottom-3 text-muted-foreground">
                    <AtSign className="w-4 h-4" />
                </div>
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
                {showSuggestions && (
                    <motion.div
                        ref={suggestionsRef}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                            "absolute z-50 mt-1 w-full max-w-xs",
                            "bg-white dark:bg-gray-900 rounded-lg shadow-lg border",
                            "max-h-60 overflow-y-auto"
                        )}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : suggestions.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground text-center">
                                Keine Benutzer gefunden
                            </div>
                        ) : (
                            <div className="py-1">
                                {suggestions.map((user, index) => (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => insertMention(user)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                                            index === selectedIndex
                                                ? "bg-primary/10 text-primary"
                                                : "hover:bg-muted/50"
                                        )}
                                    >
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback
                                                className={cn(
                                                    "text-white text-xs",
                                                    getAvatarColor(user.email)
                                                )}
                                            >
                                                {getInitials(user.email)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {user.name || user.email.split("@")[0]}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {user.email}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Keyboard hints */}
                        <div className="border-t px-3 py-2 flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
                                Navigieren
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
                                Auswählen
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
                                Schließen
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Character count (optional) */}
            {maxLength && value.length > maxLength * 0.8 && (
                <div className={cn(
                    "absolute right-3 top-3 text-xs",
                    value.length >= maxLength ? "text-destructive" : "text-muted-foreground"
                )}>
                    {value.length}/{maxLength}
                </div>
            )}
        </div>
    );
};

export default MentionInput;
