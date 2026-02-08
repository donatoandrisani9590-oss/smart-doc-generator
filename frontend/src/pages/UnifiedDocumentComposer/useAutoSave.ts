/**
 * useAutoSave - Auto-save hook for the Document Composer
 *
 * Provides:
 * - 30-second interval auto-save
 * - Manual save with toast feedback
 * - Save-on-unmount (best effort)
 * - Save status state (lastSavedAt, hasUnsavedChanges, isAutoSaving)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";

interface UseAutoSaveOptions {
    draftId: number | null;
}

export interface AutoSaveState {
    lastSavedAt: Date | null;
    hasUnsavedChanges: boolean;
    isAutoSaving: boolean;
}

export interface UseAutoSaveReturn extends AutoSaveState {
    markAsUnsaved: () => void;
    handleManualSave: () => Promise<void>;
}

export const useAutoSave = ({ draftId }: UseAutoSaveOptions): UseAutoSaveReturn => {
    const toast = useToast();

    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Mark changes as unsaved when clauses change
    const markAsUnsaved = useCallback(() => {
        setHasUnsavedChanges(true);
    }, []);

    // Auto-save function
    const performAutoSave = useCallback(async () => {
        if (!draftId || !hasUnsavedChanges || isAutoSaving) return;

        setIsAutoSaving(true);
        try {
            // Touch the draft to update its timestamp (extends TTL)
            await api.post(`/api/v1/drafts/${draftId}/refresh`);

            setLastSavedAt(new Date());
            setHasUnsavedChanges(false);

            // Subtle feedback - no intrusive toast
        } catch (error) {
            logError("Auto-save failed", { error });
            // Don't show error toast for auto-save to avoid spam
        } finally {
            setIsAutoSaving(false);
        }
    }, [draftId, hasUnsavedChanges, isAutoSaving]);

    // Manual save function with toast feedback
    const handleManualSave = useCallback(async () => {
        if (!draftId) return;

        setIsAutoSaving(true);
        try {
            await api.post(`/api/v1/drafts/${draftId}/refresh`);

            setLastSavedAt(new Date());
            setHasUnsavedChanges(false);

            toast.success("Entwurf gespeichert", "Ihre Anderungen wurden gespeichert");
        } catch (error) {
            logError("Manual save failed", { error });
            toast.error("Fehler", "Entwurf konnte nicht gespeichert werden");
        } finally {
            setIsAutoSaving(false);
        }
    }, [draftId, toast]);

    // Set up auto-save interval (30 seconds)
    useEffect(() => {
        if (!draftId) return;

        autoSaveTimerRef.current = setInterval(() => {
            performAutoSave();
        }, 30000); // 30 Sekunden

        return () => {
            if (autoSaveTimerRef.current) {
                clearInterval(autoSaveTimerRef.current);
            }
        };
    }, [draftId, performAutoSave]);

    // Save on unmount if there are unsaved changes
    useEffect(() => {
        return () => {
            if (hasUnsavedChanges && draftId) {
                // Fire and forget - best effort save on unmount
                api.post(`/api/v1/drafts/${draftId}/refresh`).catch(() => { });
            }
        };
    }, [hasUnsavedChanges, draftId]);

    return {
        lastSavedAt,
        hasUnsavedChanges,
        isAutoSaving,
        markAsUnsaved,
        handleManualSave,
    };
};
