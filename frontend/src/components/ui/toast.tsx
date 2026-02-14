/**
 * Toast Notification System
 *
 * Provides success, error, warning, and info notifications
 * that auto-dismiss after a configurable duration.
 *
 * Includes special "saving" variant for auto-save feedback.
 */

import { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info, X, Loader2, Cloud, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Toast auto-dismiss durations (ms) */
const TOAST_DURATION_DEFAULT = 4000;
const TOAST_DURATION_ERROR = 6000;
const TOAST_DURATION_SAVED = 2000;
const TOAST_DURATION_SAVE_ERROR = 5000;

type ToastType = "success" | "error" | "warning" | "info" | "saving" | "saved" | "saveError";

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    duration?: number;
    /** Für saving-Toasts: wird automatisch aktualisiert */
    persistent?: boolean;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
    updateToast: (id: string, updates: Partial<Toast>) => void;
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
    /** Auto-Save Feedback - zeigt "Speichern..." und dann "Gespeichert" */
    saving: (title?: string) => string;
    /** Aktualisiert einen saving-Toast zu "Gespeichert" */
    saved: (id: string, title?: string) => void;
    /** Aktualisiert einen saving-Toast zu "Fehler" */
    saveFailed: (id: string, errorMessage?: string) => void;
}

/**
 * Split contexts: actions are stable (memoized), toasts array changes on each notification.
 * Consumers that only call toast.success/error/etc. won't re-render when toasts change.
 */
const ToastActionsContext = createContext<Omit<ToastContextType, "toasts"> | undefined>(undefined);
const ToastStateContext = createContext<{ toasts: Toast[] }>({ toasts: [] });

const toastConfig: Record<ToastType, { icon: typeof CheckCircle; bgColor: string; borderColor: string; iconColor: string; animate?: boolean }> = {
    success: {
        icon: CheckCircle,
        bgColor: "bg-green-50 dark:bg-green-900/20",
        borderColor: "border-green-200 dark:border-green-800",
        iconColor: "text-green-600 dark:text-green-400",
    },
    error: {
        icon: XCircle,
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        iconColor: "text-red-600 dark:text-red-400",
    },
    warning: {
        icon: AlertTriangle,
        bgColor: "bg-amber-50 dark:bg-amber-900/20",
        borderColor: "border-amber-200 dark:border-amber-800",
        iconColor: "text-amber-600 dark:text-amber-400",
    },
    info: {
        icon: Info,
        bgColor: "bg-blue-50 dark:bg-blue-900/20",
        borderColor: "border-blue-200 dark:border-blue-800",
        iconColor: "text-blue-600 dark:text-blue-400",
    },
    // Auto-Save spezifische Varianten
    saving: {
        icon: Loader2,
        bgColor: "bg-slate-50 dark:bg-slate-900/20",
        borderColor: "border-slate-200 dark:border-slate-800",
        iconColor: "text-slate-600 dark:text-slate-400",
        animate: true,
    },
    saved: {
        icon: Cloud,
        bgColor: "bg-secondary/10",
        borderColor: "border-secondary/30",
        iconColor: "text-secondary",
    },
    saveError: {
        icon: CloudOff,
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        iconColor: "text-red-600 dark:text-red-400",
    },
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const removeToast = useCallback((id: string) => {
        // Clear any existing timeout
        const timeout = timeoutRefs.current.get(id);
        if (timeout) {
            clearTimeout(timeout);
            timeoutRefs.current.delete(id);
        }
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
        setToasts((prev) =>
            prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
        );
    }, []);

    const addToast = useCallback((toast: Omit<Toast, "id">) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast = { ...toast, id };

        setToasts((prev) => [...prev, newToast]);

        // Auto-dismiss (unless persistent)
        if (!toast.persistent) {
            const duration = toast.duration ?? (toast.type === "error" || toast.type === "saveError" ? TOAST_DURATION_ERROR : TOAST_DURATION_DEFAULT);
            const timeout = setTimeout(() => removeToast(id), duration);
            timeoutRefs.current.set(id, timeout);
        }

        return id;
    }, [removeToast]);

    const success = useCallback((title: string, description?: string) => {
        addToast({ type: "success", title, description });
    }, [addToast]);

    const error = useCallback((title: string, description?: string) => {
        addToast({ type: "error", title, description, duration: TOAST_DURATION_ERROR });
    }, [addToast]);

    const warning = useCallback((title: string, description?: string) => {
        addToast({ type: "warning", title, description });
    }, [addToast]);

    const info = useCallback((title: string, description?: string) => {
        addToast({ type: "info", title, description });
    }, [addToast]);

    // Auto-Save Feedback
    const saving = useCallback((title = "Wird gespeichert...") => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts((prev) => [...prev, { id, type: "saving", title, persistent: true }]);
        return id;
    }, []);

    const saved = useCallback((id: string, title = "Gespeichert") => {
        updateToast(id, { type: "saved", title, persistent: false });
        const timeout = setTimeout(() => removeToast(id), TOAST_DURATION_SAVED);
        timeoutRefs.current.set(id, timeout);
    }, [updateToast, removeToast]);

    const saveFailed = useCallback((id: string, errorMessage = "Speichern fehlgeschlagen") => {
        updateToast(id, { type: "saveError", title: errorMessage, persistent: false });
        const timeout = setTimeout(() => removeToast(id), TOAST_DURATION_SAVE_ERROR);
        timeoutRefs.current.set(id, timeout);
    }, [updateToast, removeToast]);

    // Actions object is stable - only recreated when callbacks change (they don't,
    // since they all use useCallback with stable deps). This prevents consumers
    // that only call toast.success/error/etc. from re-rendering when toasts change.
    const actions = useMemo(() => ({
        addToast, removeToast, updateToast,
        success, error, warning, info,
        saving, saved, saveFailed,
    }), [addToast, removeToast, updateToast, success, error, warning, info, saving, saved, saveFailed]);

    const stateValue = useMemo(() => ({ toasts }), [toasts]);

    return (
        <ToastActionsContext.Provider value={actions}>
            <ToastStateContext.Provider value={stateValue}>
                {children}
                <ToastContainer toasts={toasts} removeToast={removeToast} />
            </ToastStateContext.Provider>
        </ToastActionsContext.Provider>
    );
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                ))}
            </AnimatePresence>
        </div>
    );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const config = toastConfig[toast.type];
    const Icon = config.icon;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
                "pointer-events-auto rounded-lg border p-4 shadow-lg",
                config.bgColor,
                config.borderColor
            )}
        >
            <div className="flex items-start gap-3">
                <Icon
                    className={cn(
                        "w-5 h-5 flex-shrink-0 mt-0.5",
                        config.iconColor,
                        config.animate && "animate-spin"
                    )}
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                        {toast.title}
                    </p>
                    {toast.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                            {toast.description}
                        </p>
                    )}
                </div>
                {/* Hide close button for saving toasts */}
                {toast.type !== "saving" && (
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        aria-label="Schließen"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                )}
            </div>
        </motion.div>
    );
}

/**
 * Hook für Auto-Save Feedback
 * Kombiniert saving/saved/saveFailed in einem einfachen Interface
 *
 * Verwendung:
 * const { withSaveToast } = useAutoSave();
 * await withSaveToast(async () => {
 *   await saveData();
 * });
 */
export function useAutoSave() {
    const toast = useToast();

    const withSaveToast = useCallback(
        async <T,>(
            saveFn: () => Promise<T>,
            options?: {
                savingMessage?: string;
                savedMessage?: string;
                errorMessage?: string;
            }
        ): Promise<T | undefined> => {
            const id = toast.saving(options?.savingMessage);
            try {
                const result = await saveFn();
                toast.saved(id, options?.savedMessage);
                return result;
            } catch (error) {
                const errorMsg = error instanceof Error
                    ? error.message
                    : options?.errorMessage || "Speichern fehlgeschlagen";
                toast.saveFailed(id, errorMsg);
                return undefined;
            }
        },
        [toast]
    );

    return { withSaveToast, ...toast };
}

/**
 * Returns toast action methods with a STABLE reference.
 * The returned object never changes identity between renders, so it's safe
 * to include in useCallback/useEffect dependency arrays without causing loops.
 *
 * For backward compatibility, `toasts` is included as a getter that reads
 * from a ref, but accessing it won't subscribe to re-renders. If you need
 * reactive toast list updates (e.g., rendering toasts), use the ToastContainer
 * which subscribes to ToastStateContext directly.
 */
export function useToast(): ToastContextType {
    const actions = useContext(ToastActionsContext);
    const state = useContext(ToastStateContext);
    if (!actions) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    // Store latest toasts in a ref so the returned object can stay stable
    const toastsRef = useRef(state.toasts);
    toastsRef.current = state.toasts;

    // Build a stable object once and reuse it forever
    const stableRef = useRef<ToastContextType | null>(null);
    if (!stableRef.current) {
        stableRef.current = {
            ...actions,
            get toasts() { return toastsRef.current; },
        } as ToastContextType;
    }
    return stableRef.current;
}
