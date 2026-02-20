/**
 * Document Type API Hooks
 * DOCUMENT TYPES + DESIGN SETTINGS + PREVIEW + PREVIEW WITH SAMPLE DATA +
 * MASTER TEMPLATES + FORM FIELDS + FORM FIELD SYNC + PLACEHOLDERS
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

const API_BASE = "/api/v1";

// Use apiFetch for all API calls to automatically include auth token
const fetch = apiFetch;

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface DocumentType {
    id: number;
    name: string;
    description?: string | null;
    category: string;
    country_code: string;
    is_active: boolean;
    // Standardwerte für diesen Dokumenttyp (v4.2 UX-Verbesserung)
    default_probation_months?: number;
    default_notice_period?: string;
    default_vacation_days?: number;
    default_weekly_hours?: number;
    // Rechtsstand (letzte Aktualisierung der Vorlage)
    updated_at?: string | null;
}

export const useDocumentTypes = (countryCode?: string) => {
    return useQuery({
        queryKey: ["document-types", countryCode],
        queryFn: async () => {
            const params = countryCode ? `?country_code=${countryCode}` : "";
            const res = await fetch(`${API_BASE}/document-types${params}`);
            if (!res.ok) throw new Error("Failed to fetch document types");
            return res.json();
        },
    });
};

export interface DocumentTypeClauseLink {
    clause_id: number;
    display_order: number;
    is_mandatory: boolean;
    condition?: string | null;
}

export interface DocumentTypeCreateRequest {
    name: string;
    country_code: string;
    category?: string;
    description?: string | null;
    is_active?: boolean;
    clauses?: DocumentTypeClauseLink[];
    // Standardwerte
    default_probation_months?: number;
    default_notice_period?: string;
    default_vacation_days?: number;
    default_weekly_hours?: number;
}

export const useCreateDocumentType = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DocumentTypeCreateRequest) => {
            const res = await fetch(`${API_BASE}/document-types`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Create failed" }));
                throw new Error(error.detail || "Failed to create document type");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["document-types"] });
        },
    });
};

export const useDocumentType = (id: number) => {
    return useQuery({
        queryKey: ["document-type", id],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/document-types/${id}`);
            if (!res.ok) throw new Error("Failed to fetch document type");
            return res.json();
        },
        enabled: !!id,
    });
};

export interface DuplicateDocumentTypeRequest {
    new_name?: string;
    target_country_code?: string;
    include_clauses?: boolean;
    include_attachments?: boolean;
    include_form_fields?: boolean;
}

export interface DuplicateDocumentTypeResponse {
    id: number;
    name: string;
    country_code: string;
    clauses_copied: number;
    attachments_copied: number;
    form_fields_copied: number;
    message: string;
}

export const useDuplicateDocumentType = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            documentTypeId,
            options,
        }: {
            documentTypeId: number;
            options?: DuplicateDocumentTypeRequest;
        }) => {
            const res = await fetch(`${API_BASE}/document-types/${documentTypeId}/duplicate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(options || {}),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Duplication failed" }));
                throw new Error(error.detail || "Failed to duplicate document type");
            }
            return res.json() as Promise<DuplicateDocumentTypeResponse>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["document-types"] });
        },
    });
};

export const useDeleteDocumentType = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (documentTypeId: number) => {
            const res = await apiFetch(`${API_BASE}/document-types/${documentTypeId}`, { method: "DELETE" });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Löschen fehlgeschlagen" }));
                throw new Error(error.detail || "Dokumenttyp konnte nicht gelöscht werden");
            }
            return res.json();
        },
        onMutate: async (documentTypeId) => {
            await queryClient.cancelQueries({ queryKey: ["document-types"] });

            const previousTypes = queryClient.getQueriesData<DocumentType[]>({
                queryKey: ["document-types"],
            });

            queryClient.setQueriesData<DocumentType[]>(
                { queryKey: ["document-types"] },
                (old) => old?.filter((dt) => dt.id !== documentTypeId)
            );

            return { previousTypes };
        },
        onError: (error: Error, _documentTypeId, context) => {
            context?.previousTypes?.forEach(([key, data]) => {
                if (data) queryClient.setQueryData(key, data);
            });
            toast.error("Löschen fehlgeschlagen", {
                description: error.message || "Der Dokumenttyp konnte nicht gelöscht werden.",
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["document-types"] });
            toast.success("Dokumenttyp gelöscht", {
                description: "Der Dokumenttyp wurde erfolgreich deaktiviert.",
            });
        },
    });
};

export const useUpdateDocumentType = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            id,
            data,
        }: {
            id: number;
            data: Partial<DocumentType>;
        }) => {
            const res = await fetch(`${API_BASE}/document-types/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Update failed" }));
                throw new Error(error.detail || "Failed to update document type");
            }
            return res.json();
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ["document-types"] });
            queryClient.invalidateQueries({ queryKey: ["document-type", id] });
        },
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// PREVIEW
// ═══════════════════════════════════════════════════════════════════════════

export const usePreview = (documentTypeId: number, formData: Record<string, unknown>, enabled: boolean) => {
    return useQuery({
        queryKey: ["preview", documentTypeId, formData],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/preview/html`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    document_type_id: documentTypeId,
                    form_data: formData,
                }),
            });
            if (!res.ok) throw new Error("Failed to generate preview");
            return res.text();
        },
        enabled: enabled && !!documentTypeId,
        staleTime: 30000, // 30 seconds
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

export interface DesignSettings {
    id: number;
    country_code: string;
    company_name: string;
    logo_path?: string;
    header_line1?: string;
    header_line2?: string;
    header_line3?: string;
    footer_line1?: string;
    footer_line2?: string;
    footer_line3?: string;
    font_family: string;
    primary_color: string;
}

export const useDesignSettings = (countryCode: string) => {
    return useQuery({
        queryKey: ["design-settings", countryCode],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/preview/design/${countryCode}`);
            if (!res.ok) throw new Error("Failed to fetch design settings");
            return res.json();
        },
        enabled: !!countryCode,
    });
};

export const useUpdateDesignSettings = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ countryCode, settings }: { countryCode: string; settings: Partial<DesignSettings> }) => {
            const res = await fetch(`${API_BASE}/preview/design/${countryCode}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            if (!res.ok) throw new Error("Failed to update design settings");
            return res.json();
        },
        onSuccess: (_, { countryCode }) => {
            queryClient.invalidateQueries({ queryKey: ["design-settings", countryCode] });
        },
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// MASTER TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export interface MasterTemplate {
    id: number;
    country_code: string;
    category: string;
    name: string;
    filename: string;
    file_size: number;
}

export const useMasterTemplates = (countryCode?: string) => {
    return useQuery({
        queryKey: ["master-templates", countryCode],
        queryFn: async () => {
            const params = countryCode ? `?country_code=${countryCode}` : "";
            const res = await fetch(`${API_BASE}/admin/templates${params}`);
            if (!res.ok) throw new Error("Failed to fetch templates");
            return res.json();
        },
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// PLACEHOLDERS
// ═══════════════════════════════════════════════════════════════════════════

export interface PlaceholderInfo {
    name: string;
    label: string;
    type: string;
    category: string;
    example_value?: string;
}

export interface PlaceholderValidationResult {
    is_valid: boolean;
    unknown_placeholders: {
        name: string;
        suggestions: string[];
        suggestion_labels: string[];
    }[];
    known_placeholders_used: string[];
}

export const usePlaceholders = () => {
    return useQuery({
        queryKey: ["placeholders"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/placeholders`);
            if (!res.ok) throw new Error("Failed to fetch placeholders");
            return res.json() as Promise<PlaceholderInfo[]>;
        },
        staleTime: 1000 * 60 * 60, // 1 hour - placeholders rarely change
    });
};

export const usePlaceholdersByCategory = () => {
    return useQuery({
        queryKey: ["placeholders-by-category"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/placeholders/by-category`);
            if (!res.ok) throw new Error("Failed to fetch placeholders");
            return res.json() as Promise<Record<string, PlaceholderInfo[]>>;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export const useValidatePlaceholders = () => {
    return useMutation({
        mutationFn: async (contentHtml: string) => {
            const res = await fetch(`${API_BASE}/placeholders/validate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content_html: contentHtml }),
            });
            if (!res.ok) throw new Error("Failed to validate placeholders");
            return res.json() as Promise<PlaceholderValidationResult>;
        },
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// FORM FIELDS (HR Customization)
// ═══════════════════════════════════════════════════════════════════════════

export interface FormField {
    id: number;
    document_type_id: number;
    field_name: string;
    field_label: string;
    field_type: string;
    is_required: boolean;
    default_value: string | null;
    options: string | null;
    display_order: number | null;
    display_group: string | null;
    help_text: string | null;
    placeholder_text: string | null;
    suffix: string | null;
    prefix: string | null;
    min_value: number | null;
    max_value: number | null;
    min_length: number | null;
    max_length: number | null;
    pattern: string | null;
    pattern_error_message: string | null;
    is_system_field: boolean;
}

export interface FormFieldUpdate {
    field_label?: string;
    field_type?: string;
    is_required?: boolean;
    default_value?: string;
    options?: string;
    help_text?: string;
    placeholder_text?: string;
    suffix?: string;
    prefix?: string;
    min_value?: number;
    max_value?: number;
    min_length?: number;
    max_length?: number;
    pattern?: string;
    pattern_error_message?: string;
    display_order?: number;
    display_group?: string;
}

export interface FormFieldCreate {
    document_type_id: number;
    field_name: string;
    field_label: string;
    field_type?: string;
    is_required?: boolean;
    default_value?: string;
    options?: string;
    help_text?: string;
    placeholder_text?: string;
    suffix?: string;
    display_order?: number;
    display_group?: string;
}

export const useFormFields = (documentTypeId: number) => {
    return useQuery({
        queryKey: ["form-fields", documentTypeId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/form-fields/document-type/${documentTypeId}`);
            if (!res.ok) throw new Error("Failed to fetch form fields");
            return res.json() as Promise<FormField[]>;
        },
        enabled: !!documentTypeId,
    });
};

export const useFormField = (fieldId: number) => {
    return useQuery({
        queryKey: ["form-field", fieldId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/form-fields/${fieldId}`);
            if (!res.ok) throw new Error("Failed to fetch form field");
            return res.json() as Promise<FormField>;
        },
        enabled: !!fieldId,
    });
};

export const useUpdateFormField = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ fieldId, data }: { fieldId: number; data: FormFieldUpdate }) => {
            const res = await fetch(`${API_BASE}/form-fields/${fieldId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Update failed" }));
                throw new Error(error.detail || "Failed to update form field");
            }
            return res.json() as Promise<FormField>;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["form-fields", data.document_type_id] });
            queryClient.invalidateQueries({ queryKey: ["form-field", data.id] });
        },
    });
};

export const useCreateFormField = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: FormFieldCreate) => {
            const res = await fetch(`${API_BASE}/form-fields`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Create failed" }));
                throw new Error(error.detail || "Failed to create form field");
            }
            return res.json() as Promise<FormField>;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["form-fields", data.document_type_id] });
        },
    });
};

export const useDeleteFormField = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ fieldId, documentTypeId }: { fieldId: number; documentTypeId: number }) => {
            const res = await fetch(`${API_BASE}/form-fields/${fieldId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Delete failed" }));
                throw new Error(error.detail || "Failed to delete form field");
            }
            return { ...await res.json(), documentTypeId };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["form-fields", data.documentTypeId] });
        },
    });
};

export const useReorderFormFields = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ documentTypeId, fieldIds }: { documentTypeId: number; fieldIds: number[] }) => {
            const res = await fetch(`${API_BASE}/form-fields/document-type/${documentTypeId}/reorder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ field_ids: fieldIds }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Reorder failed" }));
                throw new Error(error.detail || "Failed to reorder fields");
            }
            return { ...await res.json(), documentTypeId };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["form-fields", data.documentTypeId] });
        },
    });
};

export const useFieldTypes = () => {
    return useQuery({
        queryKey: ["field-types"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/form-fields/field-types/`);
            if (!res.ok) throw new Error("Failed to fetch field types");
            return res.json() as Promise<{
                field_types: Array<{
                    type: string;
                    label: string;
                    description: string;
                    supports_validation: string[];
                    requires?: string;
                }>;
            }>;
        },
        staleTime: 1000 * 60 * 60, // 1 hour - field types don't change
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// PREVIEW WITH SAMPLE DATA (v4.2 - Dokumenten-Designer)
// ═══════════════════════════════════════════════════════════════════════════

export const useTestPreview = () => {
    return useMutation({
        mutationFn: async ({
            documentTypeId,
            clauseIds,
            useSampleData = true,
        }: {
            documentTypeId?: number;
            clauseIds: number[];
            useSampleData?: boolean;
        }) => {
            const res = await fetch(`${API_BASE}/preview/test`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    document_type_id: documentTypeId,
                    clause_ids: clauseIds,
                    use_sample_data: useSampleData,
                }),
            });
            if (!res.ok) throw new Error("Failed to generate test preview");
            return res.text();
        },
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// FORM FIELD SYNC (v4.2 - Automatische Formular-Feld-Generierung)
// ═══════════════════════════════════════════════════════════════════════════

export interface SyncResult {
    created: number;
    updated: number;
    removed: number;
    fields_now: number;
    details: string[];
}

export interface SyncPreview {
    document_type_id: number;
    clauses_scanned: number;
    placeholders_found: string[];
    clause_details: Array<{
        clause_id: number;
        clause_title: string;
        placeholders: string[];
    }>;
    changes: {
        to_create: Array<{
            field_name: string;
            field_label: string;
            field_type: string;
            category: string;
            is_known: boolean;
        }>;
        to_remove: Array<{
            field_id: number;
            field_name: string;
            field_label: string;
        }>;
        unchanged: number;
    };
    summary: {
        will_create: number;
        will_remove: number;
        total_after_sync: number;
    };
}

export const useSyncFormFields = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (documentTypeId: number) => {
            const res = await fetch(`${API_BASE}/form-fields/document-type/${documentTypeId}/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Sync failed" }));
                throw new Error(error.detail || "Failed to sync form fields");
            }
            return res.json() as Promise<SyncResult>;
        },
        onSuccess: (_, documentTypeId) => {
            queryClient.invalidateQueries({ queryKey: ["form-fields", documentTypeId] });
        },
    });
};

export const usePreviewSyncFormFields = (documentTypeId: number) => {
    return useQuery({
        queryKey: ["form-fields-sync-preview", documentTypeId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/form-fields/document-type/${documentTypeId}/preview-sync`);
            if (!res.ok) throw new Error("Failed to preview sync");
            return res.json() as Promise<SyncPreview>;
        },
        enabled: !!documentTypeId,
    });
};
