/**
 * useAutoSave - Auto-Save Hook mit Debounce, LocalStorage Fallback und Visual Indicators
 *
 * Features:
 * - Auto-Save alle 30 Sekunden wenn Änderungen vorliegen
 * - LocalStorage Fallback bei Netzwerk-Fehler
 * - "Entwurf wiederherstellen?" Dialog beim Laden
 * - Optimistic UI mit Rollback bei Fehler
 * - Visual Indicator "Gespeichert vor X Sekunden"
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDebounce } from "use-debounce";
import { logError } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface AutoSaveOptions {
    /** Auto-Save interval in milliseconds (default: 30000 = 30 seconds) */
    interval?: number;
    /** Debounce delay for change detection (default: 1000ms) */
    debounce?: number;
    /** Enable/disable auto-save (default: true) */
    enabled?: boolean;
    /** Key prefix for localStorage (default: 'autosave_') */
    storagePrefix?: string;
    /** Callback when save starts */
    onSaveStart?: () => void;
    /** Callback when save completes successfully */
    onSaveSuccess?: () => void;
    /** Callback when save fails */
    onSaveError?: (error: Error) => void;
    /** Callback when recovering from localStorage */
    onRecover?: (data: unknown) => void;
}

export interface AutoSaveResult<T> {
    /** Timestamp of last successful save */
    lastSaved: Date | null;
    /** Whether a save is currently in progress */
    isSaving: boolean;
    /** Last error that occurred during save */
    error: Error | null;
    /** Force an immediate save */
    forceSave: () => Promise<void>;
    /** Clear the error state */
    clearError: () => void;
    /** Check if there are unsaved changes */
    hasUnsavedChanges: boolean;
    /** Human-readable time since last save */
    lastSavedText: string;
    /** Whether there's a recoverable draft in localStorage */
    hasRecoverableDraft: boolean;
    /** Recover draft from localStorage */
    recoverDraft: () => T | null;
    /** Discard the recoverable draft */
    discardDraft: () => void;
    /** Current save status for UI display */
    saveStatus: SaveStatus;
}

export type SaveStatus =
    | 'idle'           // No changes, nothing to save
    | 'pending'        // Changes detected, waiting for debounce
    | 'saving'         // Currently saving
    | 'saved'          // Just saved successfully
    | 'error'          // Save failed
    | 'offline';       // Saved to localStorage (offline mode)

// ============================================================================
// HELPERS
// ============================================================================

const getStorageKey = (prefix: string, key: string): string => `${prefix}${key}`;

const isOnline = (): boolean => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

/**
 * Deep comparison of two objects to detect changes
 */
const hasChanges = <T>(current: T, previous: T | null): boolean => {
    if (previous === null) return true;
    return JSON.stringify(current) !== JSON.stringify(previous);
};

/**
 * Format time difference for human-readable display
 */
const formatTimeSince = (date: Date | null): string => {
    if (!date) return "Noch nicht gespeichert";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 5) return "Gerade eben gespeichert";
    if (diffSec < 60) return `Gespeichert vor ${diffSec} Sekunden`;
    if (diffMin === 1) return "Gespeichert vor 1 Minute";
    if (diffMin < 60) return `Gespeichert vor ${diffMin} Minuten`;
    if (diffHour === 1) return "Gespeichert vor 1 Stunde";
    return `Gespeichert vor ${diffHour} Stunden`;
};

// ============================================================================
// HOOK
// ============================================================================

export function useAutoSave<T>(
    key: string,
    data: T,
    onSave: (data: T) => Promise<void>,
    options: AutoSaveOptions = {}
): AutoSaveResult<T> {
    const {
        interval = 30000,
        debounce = 1000,
        enabled = true,
        storagePrefix = 'autosave_',
        onSaveStart,
        onSaveSuccess,
        onSaveError,
        onRecover,
    } = options;

    // State
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [hasRecoverableDraft, setHasRecoverableDraft] = useState(false);

    // Refs for tracking changes
    const lastSavedDataRef = useRef<T | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const savePromiseRef = useRef<Promise<void> | null>(null);
    const mountedRef = useRef(true);

    // Debounced data for change detection
    const [debouncedData] = useDebounce(data, debounce);

    // Storage key for this instance
    const storageKey = useMemo(
        () => getStorageKey(storagePrefix, key),
        [storagePrefix, key]
    );

    // Check for unsaved changes
    const hasUnsavedChanges = useMemo(
        () => hasChanges(data, lastSavedDataRef.current),
        [data]
    );

    // Human-readable last saved text
    const [lastSavedText, setLastSavedText] = useState(formatTimeSince(null));

    // Update last saved text every 10 seconds
    useEffect(() => {
        const updateText = () => {
            setLastSavedText(formatTimeSince(lastSaved));
        };

        updateText();
        const textInterval = setInterval(updateText, 10000);

        return () => clearInterval(textInterval);
    }, [lastSaved]);

    // Check for recoverable draft on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.data && parsed.timestamp) {
                    setHasRecoverableDraft(true);
                }
            }
        } catch {
            // Ignore localStorage errors
        }
    }, [storageKey]);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // Save to localStorage as fallback
    const saveToLocalStorage = useCallback((dataToSave: T) => {
        try {
            const payload = {
                data: dataToSave,
                timestamp: new Date().toISOString(),
                key,
            };
            localStorage.setItem(storageKey, JSON.stringify(payload));
            setSaveStatus('offline');
            return true;
        } catch (e) {
            logError("Failed to save to localStorage", { error: e });
            return false;
        }
    }, [storageKey, key]);

    // Clear localStorage draft
    const clearLocalStorage = useCallback(() => {
        try {
            localStorage.removeItem(storageKey);
            setHasRecoverableDraft(false);
        } catch {
            // Ignore
        }
    }, [storageKey]);

    // Core save function
    const performSave = useCallback(async (dataToSave: T): Promise<void> => {
        // Don't save if already saving
        if (isSaving || savePromiseRef.current) {
            return savePromiseRef.current || Promise.resolve();
        }

        // Don't save if no changes
        if (!hasChanges(dataToSave, lastSavedDataRef.current)) {
            return;
        }

        setIsSaving(true);
        setSaveStatus('saving');
        setError(null);
        onSaveStart?.();

        const savePromise = (async () => {
            try {
                // Check online status
                if (!isOnline()) {
                    // Save to localStorage if offline
                    saveToLocalStorage(dataToSave);
                    if (mountedRef.current) {
                        setLastSaved(new Date());
                        lastSavedDataRef.current = dataToSave;
                        setSaveStatus('offline');
                    }
                    return;
                }

                // Attempt server save
                await onSave(dataToSave);

                if (mountedRef.current) {
                    setLastSaved(new Date());
                    lastSavedDataRef.current = dataToSave;
                    setSaveStatus('saved');
                    clearLocalStorage();
                    onSaveSuccess?.();

                    // Reset status after 3 seconds
                    setTimeout(() => {
                        if (mountedRef.current) {
                            setSaveStatus('idle');
                        }
                    }, 3000);
                }
            } catch (err) {
                const saveError = err instanceof Error ? err : new Error(String(err));
                logError("Auto-save failed", { error: saveError });

                // Fallback to localStorage
                saveToLocalStorage(dataToSave);

                if (mountedRef.current) {
                    setError(saveError);
                    setSaveStatus('error');
                    onSaveError?.(saveError);
                }
            } finally {
                if (mountedRef.current) {
                    setIsSaving(false);
                }
                savePromiseRef.current = null;
            }
        })();

        savePromiseRef.current = savePromise;
        return savePromise;
    }, [isSaving, onSave, onSaveStart, onSaveSuccess, onSaveError, saveToLocalStorage, clearLocalStorage]);

    // Force save function
    const forceSave = useCallback(async (): Promise<void> => {
        await performSave(data);
    }, [performSave, data]);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
        if (saveStatus === 'error') {
            setSaveStatus('idle');
        }
    }, [saveStatus]);

    // Recover draft from localStorage
    const recoverDraft = useCallback((): T | null => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.data) {
                    onRecover?.(parsed.data);
                    clearLocalStorage();
                    return parsed.data as T;
                }
            }
        } catch (e) {
            logError("Failed to recover draft", { error: e });
        }
        return null;
    }, [storageKey, onRecover, clearLocalStorage]);

    // Discard draft
    const discardDraft = useCallback(() => {
        clearLocalStorage();
    }, [clearLocalStorage]);

    // Auto-save on interval when enabled
    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        intervalRef.current = setInterval(() => {
            if (hasChanges(debouncedData, lastSavedDataRef.current)) {
                performSave(debouncedData);
            }
        }, interval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [enabled, interval, debouncedData, performSave]);

    // Update pending status when changes detected
    useEffect(() => {
        if (hasUnsavedChanges && saveStatus === 'idle') {
            setSaveStatus('pending');
        }
    }, [hasUnsavedChanges, saveStatus]);

    // Listen for online/offline events
    useEffect(() => {
        const handleOnline = () => {
            // Try to save when coming back online
            if (hasUnsavedChanges) {
                performSave(data);
            }
        };

        const handleOffline = () => {
            if (hasUnsavedChanges) {
                saveToLocalStorage(data);
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [hasUnsavedChanges, data, performSave, saveToLocalStorage]);

    // Save before page unload
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                // Save to localStorage as final fallback
                saveToLocalStorage(data);

                // Show browser confirmation
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges, data, saveToLocalStorage]);

    return {
        lastSaved,
        isSaving,
        error,
        forceSave,
        clearError,
        hasUnsavedChanges,
        lastSavedText,
        hasRecoverableDraft,
        recoverDraft,
        discardDraft,
        saveStatus,
    };
}

export default useAutoSave;
