/**
 * ConditionBuilder - useHistory Hook
 *
 * Undo/Redo functionality for the condition builder.
 */

import { useState, useCallback } from "react";
import type { HistoryState } from "./types";

export function useHistory<T>(initialPresent: T) {
    const [state, setState] = useState<HistoryState<T>>({
        past: [],
        present: initialPresent,
        future: [],
    });

    const canUndo = state.past.length > 0;
    const canRedo = state.future.length > 0;

    const set = useCallback((newPresent: T, recordHistory = true) => {
        setState((currentState) => {
            if (recordHistory && JSON.stringify(currentState.present) !== JSON.stringify(newPresent)) {
                return {
                    past: [...currentState.past, currentState.present].slice(-50), // Keep max 50 states
                    present: newPresent,
                    future: [],
                };
            }
            return { ...currentState, present: newPresent };
        });
    }, []);

    const undo = useCallback(() => {
        setState((currentState) => {
            if (currentState.past.length === 0) return currentState;
            const previous = currentState.past[currentState.past.length - 1];
            const newPast = currentState.past.slice(0, -1);
            return {
                past: newPast,
                present: previous,
                future: [currentState.present, ...currentState.future],
            };
        });
    }, []);

    const redo = useCallback(() => {
        setState((currentState) => {
            if (currentState.future.length === 0) return currentState;
            const next = currentState.future[0];
            const newFuture = currentState.future.slice(1);
            return {
                past: [...currentState.past, currentState.present],
                present: next,
                future: newFuture,
            };
        });
    }, []);

    const reset = useCallback((newPresent: T) => {
        setState({
            past: [],
            present: newPresent,
            future: [],
        });
    }, []);

    return { state: state.present, set, undo, redo, canUndo, canRedo, reset };
}
