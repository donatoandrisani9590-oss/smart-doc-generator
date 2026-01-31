/**
 * useUndoRedo Hook
 *
 * Ermöglicht Undo/Redo-Funktionalität für Formulardaten.
 * Speichert Änderungen in einem History-Stack und ermöglicht
 * das Navigieren durch vergangene Zustände.
 */

import { useState, useCallback, useRef, useEffect } from "react";

interface UseUndoRedoOptions<T> {
    /** Maximale Anzahl der gespeicherten Zustände */
    maxHistory?: number;
    /** Callback wenn sich der Zustand ändert */
    onChange?: (state: T, action: "undo" | "redo" | "set") => void;
    /** Debounce-Zeit in ms für das Speichern von Zuständen */
    debounceMs?: number;
}

interface UseUndoRedoReturn<T> {
    /** Aktueller Zustand */
    state: T;
    /** Zustand setzen (fügt zum History-Stack hinzu) */
    setState: (newState: T | ((prev: T) => T)) => void;
    /** Letzten Zustand wiederherstellen */
    undo: () => void;
    /** Wiederhergestellten Zustand erneut anwenden */
    redo: () => void;
    /** Kann Undo ausgeführt werden? */
    canUndo: boolean;
    /** Kann Redo ausgeführt werden? */
    canRedo: boolean;
    /** History komplett zurücksetzen */
    reset: (initialState: T) => void;
    /** Anzahl der Undo-Schritte */
    undoCount: number;
    /** Anzahl der Redo-Schritte */
    redoCount: number;
}

export function useUndoRedo<T>(
    initialState: T,
    options: UseUndoRedoOptions<T> = {}
): UseUndoRedoReturn<T> {
    const { maxHistory = 50, onChange, debounceMs = 300 } = options;

    // State
    const [state, setStateInternal] = useState<T>(initialState);
    const [history, setHistory] = useState<T[]>([initialState]);
    const [historyIndex, setHistoryIndex] = useState(0);

    // Refs für Debouncing
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingStateRef = useRef<T | null>(null);

    // Computed values
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;
    const undoCount = historyIndex;
    const redoCount = history.length - 1 - historyIndex;

    // Debounced state setter
    const setState = useCallback(
        (newState: T | ((prev: T) => T)) => {
            const resolvedState =
                typeof newState === "function"
                    ? (newState as (prev: T) => T)(state)
                    : newState;

            // Sofort den internen State aktualisieren für responsives UI
            setStateInternal(resolvedState);
            pendingStateRef.current = resolvedState;

            // Debounce das Hinzufügen zur History
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = setTimeout(() => {
                if (pendingStateRef.current !== null) {
                    setHistory((prev) => {
                        // Schneide die "Zukunft" ab wenn wir in der Mitte der History sind
                        const newHistory = prev.slice(0, historyIndex + 1);

                        // Füge neuen Zustand hinzu
                        newHistory.push(pendingStateRef.current as T);

                        // Begrenze die History-Größe
                        if (newHistory.length > maxHistory) {
                            newHistory.shift();
                            return newHistory;
                        }

                        return newHistory;
                    });

                    setHistoryIndex((prev) =>
                        Math.min(prev + 1, maxHistory - 1)
                    );

                    onChange?.(pendingStateRef.current as T, "set");
                    pendingStateRef.current = null;
                }
            }, debounceMs);
        },
        [state, historyIndex, maxHistory, onChange, debounceMs]
    );

    // Undo
    const undo = useCallback(() => {
        if (!canUndo) return;

        const newIndex = historyIndex - 1;
        const previousState = history[newIndex];

        setHistoryIndex(newIndex);
        setStateInternal(previousState);
        onChange?.(previousState, "undo");
    }, [canUndo, history, historyIndex, onChange]);

    // Redo
    const redo = useCallback(() => {
        if (!canRedo) return;

        const newIndex = historyIndex + 1;
        const nextState = history[newIndex];

        setHistoryIndex(newIndex);
        setStateInternal(nextState);
        onChange?.(nextState, "redo");
    }, [canRedo, history, historyIndex, onChange]);

    // Reset
    const reset = useCallback((newInitialState: T) => {
        setStateInternal(newInitialState);
        setHistory([newInitialState]);
        setHistoryIndex(0);
        pendingStateRef.current = null;
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignoriere wenn in Input/Textarea
            const target = e.target as HTMLElement;
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                // Erlaube Ctrl+Z/Y auch in Inputs für native Undo
                // Aber nur wenn nicht unser Formular-Level Undo gemeint ist
                if (!e.shiftKey) return;
            }

            // Ctrl+Z oder Cmd+Z für Undo
            if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
                e.preventDefault();
                undo();
            }

            // Ctrl+Y oder Cmd+Shift+Z für Redo
            if (
                (e.ctrlKey || e.metaKey) &&
                (e.key === "y" || (e.key === "z" && e.shiftKey))
            ) {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [undo, redo]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return {
        state,
        setState,
        undo,
        redo,
        canUndo,
        canRedo,
        reset,
        undoCount,
        redoCount,
    };
}

export default useUndoRedo;
