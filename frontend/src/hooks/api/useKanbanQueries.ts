/**
 * Kanban Board API Hooks
 *
 * Hooks for the Kanban board view of the document repository:
 * - useKanbanBoard(): Fetches documents grouped by pipeline_stage
 * - useMoveDocument(): Moves a document to a different stage (drag-and-drop)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

const API_BASE = "/api/v1";
const fetch = apiFetch;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface KanbanCardItem {
    id: number;
    title: string | null;
    document_type_name: string | null;
    employee_name: string | null;
    pipeline_stage: string;
    created_at: string | null;
    next_due_date: string | null;
    has_open_actions: boolean;
}

export interface KanbanColumn {
    stage: string;
    label: string;
    count: number;
    documents: KanbanCardItem[];
}

export interface KanbanBoardResponse {
    columns: KanbanColumn[];
    total: number;
}

export interface KanbanFilters {
    per_column?: number;
    search?: string;
    document_type_id?: number;
    country_code?: string;
    include_archived?: boolean;
    ownership?: "owned" | "shared";
}

export interface StageChangeResult {
    id: number;
    pipeline_stage: string;
    previous_stage: string;
    message: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE STAGE METADATA (shared with backend)
// ═══════════════════════════════════════════════════════════════════════════

export const PIPELINE_STAGES = [
    "entwurf",
    "freigabe",
    "versendet",
    "ruecklauf",
    "abgeschlossen",
    "archiv",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
    entwurf: "Entwurf",
    freigabe: "Freigabe",
    versendet: "Versendet",
    ruecklauf: "Rücklauf",
    abgeschlossen: "Abgeschlossen",
    archiv: "Archiv",
};

export const STAGE_COLORS: Record<PipelineStage, { bg: string; text: string; border: string; icon: string }> = {
    entwurf: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800", icon: "text-amber-500" },
    freigabe: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800", icon: "text-purple-500" },
    versendet: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800", icon: "text-blue-500" },
    ruecklauf: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800", icon: "text-orange-500" },
    abgeschlossen: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-800", icon: "text-green-500" },
    archiv: { bg: "bg-warm-50 dark:bg-warm-800/30", text: "text-warm-600 dark:text-warm-400", border: "border-warm-200 dark:border-warm-700", icon: "text-warm-400" },
};

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

export const useKanbanBoard = (filters: KanbanFilters = {}) => {
    return useQuery({
        queryKey: ["kanban", filters],
        queryFn: async () => {
            const params = new URLSearchParams();

            if (filters.per_column) params.append("per_column", String(filters.per_column));
            if (filters.search) params.append("search", filters.search);
            if (filters.document_type_id) params.append("document_type_id", String(filters.document_type_id));
            if (filters.country_code) params.append("country_code", filters.country_code);
            if (filters.include_archived) params.append("include_archived", "true");
            if (filters.ownership) params.append("ownership", filters.ownership);

            const res = await fetch(`${API_BASE}/repository/kanban?${params}`);
            if (!res.ok) throw new Error("Kanban-Daten konnten nicht geladen werden");
            return res.json() as Promise<KanbanBoardResponse>;
        },
        staleTime: 1000 * 30, // 30 seconds
    });
};

export const useMoveDocument = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            documentId,
            targetStage,
            note,
            metadata,
        }: {
            documentId: number;
            targetStage: string;
            note?: string;
            metadata?: Record<string, unknown>;
        }) => {
            const res = await fetch(`${API_BASE}/repository/${documentId}/stage`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    target_stage: targetStage,
                    note: note || null,
                    metadata: metadata || null,
                }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Stage-Wechsel fehlgeschlagen" }));
                throw new Error(error.detail || "Stage-Wechsel fehlgeschlagen");
            }
            return res.json() as Promise<StageChangeResult>;
        },
        onSuccess: () => {
            // Invalidate both Kanban and repository list views
            queryClient.invalidateQueries({ queryKey: ["kanban"] });
            queryClient.invalidateQueries({ queryKey: ["repository"] });
            queryClient.invalidateQueries({ queryKey: ["repository-stats"] });
        },
    });
};
