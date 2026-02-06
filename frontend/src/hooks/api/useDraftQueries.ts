/**
 * Draft API Hooks
 * DRAFTS
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

const API_BASE = "/api/v1";

// Use apiFetch for all API calls to automatically include auth token
const fetch = apiFetch;

// ═══════════════════════════════════════════════════════════════════════════
// DRAFTS
// ═══════════════════════════════════════════════════════════════════════════

export interface Draft {
    id: number;
    document_type_id: number;
    form_data: Record<string, unknown>;
    country_code: string;
    updated_at: string;
}

export const useDrafts = () => {
    return useQuery({
        queryKey: ["drafts"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/drafts`);
            if (!res.ok) throw new Error("Failed to fetch drafts");
            return res.json();
        },
    });
};

export const useSaveDraft = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (draft: { document_type_id: number; form_data: Record<string, unknown>; country_code: string }) => {
            const res = await fetch(`${API_BASE}/drafts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
            });
            if (!res.ok) throw new Error("Failed to save draft");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["drafts"] });
        },
    });
};
