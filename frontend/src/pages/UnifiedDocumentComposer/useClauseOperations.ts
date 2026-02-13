/**
 * useClauseOperations - Clause CRUD operations for the Document Composer
 *
 * Handles:
 * - Add local clause
 * - Add global clause (from library)
 * - Delete clause
 * - Update clause (title/content)
 * - Deviate clause (Phase 2)
 * - Promote clause (Phase 3)
 */

import { useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import { useToast } from "@/components/ui/toast";
import type { PromotionData } from "@/components/composer/PromotionDialog";
import type {
    ClauseInstance,
    LibraryClause,
    ClauseInstanceListResponse,
} from "@/components/composer/types";

interface UseClauseOperationsOptions {
    draftId: number | null;
    clauses: ClauseInstance[];
    setClauses: React.Dispatch<React.SetStateAction<ClauseInstance[]>>;
    selectedClauseId: number | null;
    setSelectedClauseId: React.Dispatch<React.SetStateAction<number | null>>;
    markAsUnsaved: () => void;
}

export interface UseClauseOperationsReturn {
    // CRUD
    handleAddLocalClause: (position?: number) => Promise<void>;
    handleAddGlobalClause: (libraryClause: LibraryClause, position?: number) => Promise<void>;
    handleDeleteClause: (instanceId: number) => Promise<void>;
    handleUpdateClause: (instanceId: number, updates: { title?: string; content_html?: string }) => Promise<void>;

    // Deviation (Phase 2)
    deviationDialogOpen: boolean;
    setDeviationDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    pendingDeviationClauseId: number | null;
    handleRequestDeviation: (instanceId: number) => void;
    handleConfirmDeviation: (reason?: string) => Promise<void>;
    isDeviating: boolean;

    // Promotion (Phase 3)
    promotionDialogOpen: boolean;
    setPromotionDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    pendingPromotionClauseId: number | null;
    handleRequestPromotion: (instanceId: number) => void;
    handleConfirmPromotion: (data: PromotionData) => Promise<void>;
    isPromoting: boolean;

    // Save state
    isSaving: boolean;
}

export const useClauseOperations = ({
    draftId,
    clauses: _clauses,
    setClauses,
    selectedClauseId,
    setSelectedClauseId,
    markAsUnsaved,
}: UseClauseOperationsOptions): UseClauseOperationsReturn => {
    const toast = useToast();

    const [isSaving, setIsSaving] = useState(false);

    // Deviation Dialog (Phase 2)
    const [deviationDialogOpen, setDeviationDialogOpen] = useState(false);
    const [pendingDeviationClauseId, setPendingDeviationClauseId] = useState<number | null>(null);
    const [isDeviating, setIsDeviating] = useState(false);

    // Promotion Dialog (Phase 3)
    const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
    const [pendingPromotionClauseId, setPendingPromotionClauseId] = useState<number | null>(null);
    const [isPromoting, setIsPromoting] = useState(false);

    // ── CRUD Operations ──────────────────────────────────────────────────────

    const handleAddLocalClause = useCallback(async (position?: number) => {
        if (!draftId) return;

        try {
            const response = await api.post<ClauseInstance>(
                `/api/v1/composer/drafts/${draftId}/clauses`,
                {
                    title: "Neuer Abschnitt",
                    content_html: "",
                    position,
                }
            );

            // Clauses neu laden (einfacher als lokales State-Management)
            const clausesResponse = await api.get<ClauseInstanceListResponse>(
                `/api/v1/composer/drafts/${draftId}/clauses`
            );
            setClauses(clausesResponse.data.clauses);
            setSelectedClauseId(response.data.id);

            toast.success("Textbaustein hinzugefügt", "Bearbeiten Sie den Inhalt im rechten Panel");
        } catch (error) {
            logError("Failed to add local clause", { error });
            toast.error("Fehler", "Textbaustein konnte nicht hinzugefügt werden");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftId, setClauses, setSelectedClauseId]);

    const handleAddGlobalClause = useCallback(async (libraryClause: LibraryClause, position?: number) => {
        if (!draftId) return;

        try {
            await api.post<ClauseInstance>(
                `/api/v1/composer/drafts/${draftId}/clauses`,
                {
                    title: libraryClause.title,
                    source_clause_id: libraryClause.id,
                    position,
                }
            );

            // Clauses neu laden
            const clausesResponse = await api.get<ClauseInstanceListResponse>(
                `/api/v1/composer/drafts/${draftId}/clauses`
            );
            setClauses(clausesResponse.data.clauses);

            toast.success("Textbaustein hinzugefügt", `"${libraryClause.title}" wurde dem Dokument hinzugefügt`);
        } catch (error) {
            logError("Failed to add global clause", { error });
            toast.error("Fehler", "Textbaustein konnte nicht hinzugefügt werden");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftId, setClauses]);

    const handleDeleteClause = useCallback(async (instanceId: number) => {
        if (!draftId) return;

        try {
            await api.delete(`/api/v1/composer/drafts/${draftId}/clauses/${instanceId}`);

            setClauses((prev) => prev.filter((c) => c.id !== instanceId));
            if (selectedClauseId === instanceId) {
                setSelectedClauseId(null);
            }

            toast.success("Textbaustein entfernt");
        } catch (error) {
            logError("Failed to delete clause", { error });
            toast.error("Fehler", "Textbaustein konnte nicht entfernt werden");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftId, selectedClauseId, setClauses, setSelectedClauseId]);

    const handleUpdateClause = useCallback(async (
        instanceId: number,
        updates: { title?: string; content_html?: string }
    ) => {
        if (!draftId) return;

        setIsSaving(true);
        try {
            await api.put(
                `/api/v1/composer/drafts/${draftId}/clauses/${instanceId}`,
                updates
            );

            setClauses((prev) =>
                prev.map((c) => (c.id === instanceId ? { ...c, ...updates } : c))
            );

            // Mark as having unsaved changes for auto-save feedback
            markAsUnsaved();
        } catch (error) {
            logError("Failed to update clause", { error });
            toast.error("Fehler", "Änderungen konnten nicht gespeichert werden");
        } finally {
            setIsSaving(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftId, setClauses, markAsUnsaved]);

    // ── Deviation (Phase 2) ──────────────────────────────────────────────────

    const handleRequestDeviation = useCallback((instanceId: number) => {
        setPendingDeviationClauseId(instanceId);
        setDeviationDialogOpen(true);
    }, []);

    const handleConfirmDeviation = useCallback(async (reason?: string) => {
        if (!draftId || !pendingDeviationClauseId) return;

        setIsDeviating(true);
        try {
            await api.post(
                `/api/v1/composer/drafts/${draftId}/clauses/${pendingDeviationClauseId}/deviate`,
                { reason }
            );

            // Clauses neu laden
            const clausesResponse = await api.get<ClauseInstanceListResponse>(
                `/api/v1/composer/drafts/${draftId}/clauses`
            );
            setClauses(clausesResponse.data.clauses);

            // Dialog schliessen und auswählen
            setDeviationDialogOpen(false);
            setSelectedClauseId(pendingDeviationClauseId);
            setPendingDeviationClauseId(null);

            toast.success("Textbaustein aufgebrochen", "Sie können den Textbaustein jetzt bearbeiten");
        } catch (error) {
            logError("Failed to deviate clause", { error });
            toast.error("Fehler", "Textbaustein konnte nicht aufgebrochen werden");
        } finally {
            setIsDeviating(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftId, pendingDeviationClauseId, setClauses, setSelectedClauseId]);

    // ── Promotion (Phase 3) ──────────────────────────────────────────────────

    const handleRequestPromotion = useCallback((instanceId: number) => {
        setPendingPromotionClauseId(instanceId);
        setPromotionDialogOpen(true);
    }, []);

    const handleConfirmPromotion = useCallback(async (data: PromotionData) => {
        if (!draftId || !pendingPromotionClauseId) return;

        setIsPromoting(true);
        try {
            await api.post(
                `/api/v1/composer/drafts/${draftId}/clauses/${pendingPromotionClauseId}/promote`,
                data
            );

            // Clauses neu laden falls convert_to_global
            if (data.convert_to_global) {
                const clausesResponse = await api.get<ClauseInstanceListResponse>(
                    `/api/v1/composer/drafts/${draftId}/clauses`
                );
                setClauses(clausesResponse.data.clauses);
            }

            // Dialog schliessen
            setPromotionDialogOpen(false);
            setPendingPromotionClauseId(null);

            toast.success(
                "Zur Prüfung eingereicht",
                "Der Textbaustein wird nach Freigabe in der Bibliothek verfügbar sein"
            );
        } catch (error) {
            logError("Failed to promote clause", { error });
            toast.error("Fehler", "Textbaustein konnte nicht eingereicht werden");
        } finally {
            setIsPromoting(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftId, pendingPromotionClauseId, setClauses]);

    return {
        handleAddLocalClause,
        handleAddGlobalClause,
        handleDeleteClause,
        handleUpdateClause,

        deviationDialogOpen,
        setDeviationDialogOpen,
        pendingDeviationClauseId,
        handleRequestDeviation,
        handleConfirmDeviation,
        isDeviating,

        promotionDialogOpen,
        setPromotionDialogOpen,
        pendingPromotionClauseId,
        handleRequestPromotion,
        handleConfirmPromotion,
        isPromoting,

        isSaving,
    };
};
