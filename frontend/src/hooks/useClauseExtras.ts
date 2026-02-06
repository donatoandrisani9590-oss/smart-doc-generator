import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

const API_BASE = "/api/v1";

// ═══════════════════════════════════════════════════════════════════════════
// IMPACT ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

export interface DocumentTypeUsage {
    id: number;
    name: string;
    category?: string;
    is_mandatory: boolean;
    usage_count_30_days: number;
}

export interface ClauseImpactAnalysis {
    clause_id: number;
    clause_title: string;
    clause_version: number;
    affected_document_types: DocumentTypeUsage[];
    total_document_types: number;
    total_usage_30_days: number;
}

export const useClauseImpact = (clauseId: number) => {
    return useQuery({
        queryKey: ["clause-impact", clauseId],
        queryFn: async () => {
            const res = await apiFetch(`${API_BASE}/clauses/${clauseId}/impact`);
            if (!res.ok) throw new Error("Failed to fetch clause impact analysis");
            return res.json() as Promise<ClauseImpactAnalysis>;
        },
        enabled: !!clauseId,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// CLAUSE NOTES
// ═══════════════════════════════════════════════════════════════════════════

export interface ClauseNote {
    id: number;
    clause_id: number;
    content: string;
    is_pinned: boolean;
    note_type: "info" | "warning" | "legal" | "approval";
    created_by_user_id: string;
    created_by_user_name: string;
    created_at: string;
}

export interface ClauseNoteCreateRequest {
    content: string;
    is_pinned?: boolean;
    note_type?: "info" | "warning" | "legal" | "approval";
}

export const useClauseNotes = (clauseId: number) => {
    return useQuery({
        queryKey: ["clause-notes", clauseId],
        queryFn: async () => {
            const res = await apiFetch(`${API_BASE}/clauses/${clauseId}/notes`);
            if (!res.ok) throw new Error("Failed to fetch clause notes");
            return res.json() as Promise<ClauseNote[]>;
        },
        enabled: !!clauseId,
    });
};

export const useAddClauseNote = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ clauseId, data }: { clauseId: number; data: ClauseNoteCreateRequest }) => {
            const res = await apiFetch(`${API_BASE}/clauses/${clauseId}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Create failed" }));
                throw new Error(error.detail || "Failed to add note");
            }
            return res.json() as Promise<ClauseNote>;
        },
        onSuccess: (_, { clauseId }) => {
            queryClient.invalidateQueries({ queryKey: ["clause-notes", clauseId] });
        },
    });
};

export const useDeleteClauseNote = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ clauseId, noteId }: { clauseId: number; noteId: number }) => {
            const res = await apiFetch(`${API_BASE}/clauses/${clauseId}/notes/${noteId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Delete failed" }));
                throw new Error(error.detail || "Failed to delete note");
            }
            return res.json();
        },
        onSuccess: (_, { clauseId }) => {
            queryClient.invalidateQueries({ queryKey: ["clause-notes", clauseId] });
        },
    });
};
