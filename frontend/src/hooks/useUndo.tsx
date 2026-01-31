/**
 * useUndo Hook - Undo-Funktionalität für kritische Aktionen
 *
 * Ermöglicht das Rückgängigmachen von Aktionen innerhalb eines Zeitfensters.
 * Zeigt einen Toast mit Undo-Button an.
 */

import { useState, useCallback, useRef, useEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Undo2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface UndoAction {
    id: string;
    message: string;
    undoCallback: () => Promise<void> | void;
    timeoutMs: number;
    createdAt: number;
}

interface UndoContextType {
    /**
     * Register an undoable action
     * @param message - Message to display (e.g., "3 Dokumente gelöscht")
     * @param undoCallback - Function to call when undo is triggered
     * @param timeoutMs - Time in ms before action becomes permanent (default: 5000)
     * @returns Action ID for manual dismissal
     */
    registerUndo: (
        message: string,
        undoCallback: () => Promise<void> | void,
        timeoutMs?: number
    ) => string;

    /**
     * Dismiss an undo action (make it permanent)
     */
    dismissUndo: (id: string) => void;

    /**
     * Execute undo for a specific action
     */
    executeUndo: (id: string) => Promise<void>;
}

const UndoContext = createContext<UndoContextType | null>(null);

export function useUndo(): UndoContextType {
    const context = useContext(UndoContext);
    if (!context) {
        throw new Error("useUndo must be used within an UndoProvider");
    }
    return context;
}

interface UndoProviderProps {
    children: ReactNode;
}

export function UndoProvider({ children }: UndoProviderProps) {
    const [actions, setActions] = useState<UndoAction[]>([]);
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            timersRef.current.forEach((timer) => clearTimeout(timer));
        };
    }, []);

    const registerUndo = useCallback(
        (
            message: string,
            undoCallback: () => Promise<void> | void,
            timeoutMs: number = 5000
        ): string => {
            const id = `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const action: UndoAction = {
                id,
                message,
                undoCallback,
                timeoutMs,
                createdAt: Date.now(),
            };

            setActions((prev) => [...prev, action]);

            // Set timeout for auto-dismissal
            const timer = setTimeout(() => {
                setActions((prev) => prev.filter((a) => a.id !== id));
                timersRef.current.delete(id);
            }, timeoutMs);

            timersRef.current.set(id, timer);

            return id;
        },
        []
    );

    const dismissUndo = useCallback((id: string) => {
        // Clear timer
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }

        // Remove action
        setActions((prev) => prev.filter((a) => a.id !== id));
    }, []);

    const executeUndo = useCallback(async (id: string) => {
        const action = actions.find((a) => a.id === id);
        if (!action) return;

        // Clear timer
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }

        // Execute undo callback
        try {
            await action.undoCallback();
        } catch (error) {
            console.error("Undo failed:", error);
        }

        // Remove action
        setActions((prev) => prev.filter((a) => a.id !== id));
    }, [actions]);

    return (
        <UndoContext.Provider value={{ registerUndo, dismissUndo, executeUndo }}>
            {children}
            <UndoToastContainer actions={actions} onUndo={executeUndo} onDismiss={dismissUndo} />
        </UndoContext.Provider>
    );
}

interface UndoToastContainerProps {
    actions: UndoAction[];
    onUndo: (id: string) => Promise<void>;
    onDismiss: (id: string) => void;
}

function UndoToastContainer({ actions, onUndo, onDismiss }: UndoToastContainerProps) {
    return (
        <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2"
            role="region"
            aria-label="Undo-Benachrichtigungen"
            aria-live="polite"
        >
            <AnimatePresence mode="popLayout">
                {actions.map((action) => (
                    <UndoToast
                        key={action.id}
                        action={action}
                        onUndo={() => onUndo(action.id)}
                        onDismiss={() => onDismiss(action.id)}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}

interface UndoToastProps {
    action: UndoAction;
    onUndo: () => void;
    onDismiss: () => void;
}

function UndoToast({ action, onUndo, onDismiss }: UndoToastProps) {
    const [progress, setProgress] = useState(100);
    const [isUndoing, setIsUndoing] = useState(false);

    useEffect(() => {
        const elapsed = Date.now() - action.createdAt;
        const remaining = action.timeoutMs - elapsed;
        const startProgress = (remaining / action.timeoutMs) * 100;

        setProgress(startProgress);

        const interval = setInterval(() => {
            setProgress((prev) => {
                const decrement = (100 / action.timeoutMs) * 50; // Update every 50ms
                const next = prev - decrement;
                return next < 0 ? 0 : next;
            });
        }, 50);

        return () => clearInterval(interval);
    }, [action.timeoutMs, action.createdAt]);

    const handleUndo = async () => {
        setIsUndoing(true);
        await onUndo();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative bg-foreground text-background rounded-lg shadow-lg px-4 py-3 min-w-[320px] max-w-md"
            role="alert"
            aria-atomic="true"
        >
            {/* Progress bar */}
            <div
                className="absolute bottom-0 left-0 h-1 bg-primary/50 rounded-b-lg transition-all duration-50"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Zeit bis Aktion permanent wird"
            />

            <div className="flex items-center gap-3">
                <span className="flex-1 text-sm font-medium">{action.message}</span>

                <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleUndo}
                    disabled={isUndoing}
                    className="gap-1.5 bg-background/20 hover:bg-background/30 text-background"
                    aria-label={`${action.message} rückgängig machen`}
                >
                    <Undo2 className="w-3.5 h-3.5" />
                    {isUndoing ? "..." : "Rückgängig"}
                </Button>

                <button
                    onClick={onDismiss}
                    className="p-1 rounded hover:bg-background/20 transition-colors"
                    aria-label="Schließen"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
}
