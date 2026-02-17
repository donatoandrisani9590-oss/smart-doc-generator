/**
 * Clause API Hooks
 * CLAUSES + CUSTOM CLAUSE TEMPLATES + CLAUSE VARIANTS
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

const API_BASE = "/api/v1";

// Use apiFetch for all API calls to automatically include auth token
const fetch = apiFetch;

// ═══════════════════════════════════════════════════════════════════════════
// CLAUSES
// ═══════════════════════════════════════════════════════════════════════════

export interface Clause {
    id: number;
    title: string;
    content: string;
    category: string;
    country_code: string;
    version: string;
    is_active: boolean;
    placeholders: string[];
    tags?: string[];
    description?: string;
    tone?: string;
}

export interface DocumentTypeClauseMap {
    document_type_id: number;
    document_type_name: string;
    clause_ids: number[];
}

export const useClauses = (countryCode?: string) => {
    return useQuery({
        queryKey: ["clauses", countryCode],
        queryFn: async () => {
            const params = countryCode ? `?country_code=${countryCode}` : "";
            const res = await fetch(`${API_BASE}/clauses${params}`);
            if (!res.ok) throw new Error("Failed to fetch clauses");
            return res.json();
        },
    });
};

export const useClauseDocTypeMap = (countryCode?: string) => {
    return useQuery({
        queryKey: ["clause-doc-type-map", countryCode],
        queryFn: async () => {
            const params = countryCode ? `?country_code=${countryCode}` : "";
            const res = await fetch(`${API_BASE}/clauses/document-type-map${params}`);
            if (!res.ok) throw new Error("Failed to fetch clause document type mapping");
            return res.json() as Promise<DocumentTypeClauseMap[]>;
        },
        staleTime: 5 * 60 * 1000, // 5 Minuten — Zuordnung ändert sich selten
    });
};

export const useClause = (id: number) => {
    return useQuery({
        queryKey: ["clause", id],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/clauses/${id}`);
            if (!res.ok) throw new Error("Failed to fetch clause");
            return res.json();
        },
        enabled: !!id,
    });
};

export const useClauseVersions = (clauseId: number) => {
    return useQuery({
        queryKey: ["clause-versions", clauseId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/clauses/${clauseId}/versions`);
            if (!res.ok) throw new Error("Failed to fetch versions");
            return res.json();
        },
        enabled: !!clauseId,
    });
};

export interface ClauseCreateRequest {
    title: string;
    content_html: string;
    country_code: string;
    category?: string;
    is_active?: boolean;
}

export interface ClauseUpdateRequest {
    title?: string;
    content_html?: string;
    country_code?: string;
    category?: string;
    is_active?: boolean;
}

export const useCreateClause = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: ClauseCreateRequest) => {
            const res = await fetch(`${API_BASE}/clauses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Create failed" }));
                throw new Error(error.detail || "Failed to create clause");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["clauses"] });
        },
    });
};

export const useUpdateClause = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: ClauseUpdateRequest }) => {
            const res = await fetch(`${API_BASE}/clauses/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Update failed" }));
                throw new Error(error.detail || "Failed to update clause");
            }
            return res.json();
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ["clauses"] });
            queryClient.invalidateQueries({ queryKey: ["clause", id] });
        },
    });
};

export const useDeleteClause = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (clauseId: number) => {
            const res = await fetch(`${API_BASE}/clauses/${clauseId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Delete failed" }));
                throw new Error(error.detail || "Failed to delete clause");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["clauses"] });
        },
    });
};

export const useRestoreClauseVersion = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ clauseId, versionId }: { clauseId: number; versionId: number }) => {
            const res = await fetch(`${API_BASE}/clauses/${clauseId}/versions/${versionId}/restore`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to restore version");
            return res.json();
        },
        onSuccess: (_, { clauseId }) => {
            queryClient.invalidateQueries({ queryKey: ["clause", clauseId] });
            queryClient.invalidateQueries({ queryKey: ["clause-versions", clauseId] });
            queryClient.invalidateQueries({ queryKey: ["clauses"] });
        },
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM CLAUSE TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomClauseTemplate {
    id: number;
    title: string;
    content: string;
    category: string;
    country_code: string;
    usage_count: number;
}

export const useCustomClauseTemplates = (countryCode?: string) => {
    return useQuery({
        queryKey: ["custom-clause-templates", countryCode],
        queryFn: async () => {
            const params = countryCode ? `?country_code=${countryCode}` : "";
            const res = await fetch(`${API_BASE}/custom-clauses/templates${params}`);
            if (!res.ok) throw new Error("Failed to fetch custom templates");
            return res.json();
        },
    });
};

export const useCreateCustomTemplate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (template: { title: string; content: string; category?: string; country_code: string }) => {
            const res = await fetch(`${API_BASE}/custom-clauses/templates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(template),
            });
            if (!res.ok) throw new Error("Failed to create template");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["custom-clause-templates"] });
        },
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// CLAUSE VARIANTS (v4.2 - Kapitel 16.13)
// ═══════════════════════════════════════════════════════════════════════════

export interface ClauseVariant {
    id: number;
    group_id: number;
    clause_id: number;
    variant_name: string;
    variant_code?: string;
    description?: string;
    auto_select_condition?: string;
    sort_order: number;
    is_default: boolean;
    is_active: boolean;
    clause_title?: string;
    clause_content_preview?: string;
}

export interface VariantGroup {
    id: number;
    name: string;
    description?: string;
    category?: string;
    country_code: string;
    base_clause_id?: number;
    is_active: boolean;
    created_at?: string;
    variants: ClauseVariant[];
}

export const useVariantGroups = (countryCode?: string) => {
    return useQuery({
        queryKey: ["variant-groups", countryCode],
        queryFn: async () => {
            const params = countryCode ? `?country_code=${countryCode}` : "";
            const res = await fetch(`${API_BASE}/clause-variants/groups${params}`);
            if (!res.ok) throw new Error("Failed to fetch variant groups");
            return res.json() as Promise<VariantGroup[]>;
        },
    });
};

export const useVariantGroup = (groupId: number) => {
    return useQuery({
        queryKey: ["variant-group", groupId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/clause-variants/groups/${groupId}`);
            if (!res.ok) throw new Error("Failed to fetch variant group");
            return res.json() as Promise<VariantGroup>;
        },
        enabled: !!groupId,
    });
};

export const useCreateVariantGroup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            name: string;
            description?: string;
            category?: string;
            country_code: string;
            base_clause_id?: number;
        }) => {
            const res = await fetch(`${API_BASE}/clause-variants/groups`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Create failed" }));
                throw new Error(error.detail || "Failed to create variant group");
            }
            return res.json() as Promise<VariantGroup>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["variant-groups"] });
        },
    });
};

export const useAddVariantToGroup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            groupId,
            data,
        }: {
            groupId: number;
            data: {
                clause_id: number;
                variant_name: string;
                variant_code?: string;
                description?: string;
                auto_select_condition?: string;
                sort_order?: number;
                is_default?: boolean;
            };
        }) => {
            const res = await fetch(`${API_BASE}/clause-variants/groups/${groupId}/variants`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Create failed" }));
                throw new Error(error.detail || "Failed to add variant");
            }
            return res.json() as Promise<ClauseVariant>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["variant-groups"] });
            queryClient.invalidateQueries({ queryKey: ["variant-group"] });
        },
    });
};

export const useUpdateVariant = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            variantId,
            data,
        }: {
            variantId: number;
            data: {
                variant_name?: string;
                variant_code?: string;
                description?: string;
                auto_select_condition?: string;
                sort_order?: number;
                is_default?: boolean;
                is_active?: boolean;
            };
        }) => {
            const res = await fetch(`${API_BASE}/clause-variants/variants/${variantId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Update failed" }));
                throw new Error(error.detail || "Failed to update variant");
            }
            return res.json() as Promise<ClauseVariant>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["variant-groups"] });
            queryClient.invalidateQueries({ queryKey: ["variant-group"] });
        },
    });
};

export const useDeleteVariant = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (variantId: number) => {
            const res = await fetch(`${API_BASE}/clause-variants/variants/${variantId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Delete failed" }));
                throw new Error(error.detail || "Failed to delete variant");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["variant-groups"] });
            queryClient.invalidateQueries({ queryKey: ["variant-group"] });
        },
    });
};

export const useClauseVariantGroups = (clauseId: number) => {
    return useQuery({
        queryKey: ["clause-variant-groups", clauseId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/clause-variants/clauses/${clauseId}/variant-groups`);
            if (!res.ok) throw new Error("Failed to fetch clause variant groups");
            return res.json() as Promise<{
                clause_id: number;
                variant_groups: Array<{
                    group_id: number;
                    group_name: string;
                    variant_id: number;
                    variant_name: string;
                    is_default: boolean;
                }>;
                is_part_of_variant_group: boolean;
            }>;
        },
        enabled: !!clauseId,
    });
};
