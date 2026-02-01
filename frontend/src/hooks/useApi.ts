/**
 * TanStack Query API Hooks
 * Centralized data fetching with caching, refetching, and optimistic updates.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch, authApi } from "@/lib/authFetch";
import { toast } from "sonner";

const API_BASE = "/api/v1";

// Use authFetch for all API calls to automatically include auth token
const fetch = authFetch;

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
            const res = await authApi.delete(`${API_BASE}/document-types/${documentTypeId}`);
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Löschen fehlgeschlagen" }));
                throw new Error(error.detail || "Dokumenttyp konnte nicht gelöscht werden");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["document-types"] });
            toast.success("Dokumenttyp gelöscht", {
                description: "Der Dokumenttyp wurde erfolgreich deaktiviert.",
            });
        },
        onError: (error: Error) => {
            toast.error("Löschen fehlgeschlagen", {
                description: error.message || "Der Dokumenttyp konnte nicht gelöscht werden.",
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

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT HISTORY
// ═══════════════════════════════════════════════════════════════════════════

export interface GeneratedDocument {
    id: number;
    document_type_id: number;
    country_code: string;
    file_format: string;
    created_at: string;
    form_data_summary?: Record<string, unknown>;
    can_download: boolean;
}

export const useDocumentHistory = (userId?: string, countryCode?: string) => {
    return useQuery({
        queryKey: ["document-history", userId, countryCode],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (userId) params.append("user_id", userId);
            if (countryCode) params.append("country_code", countryCode);
            const res = await fetch(`${API_BASE}/documents/history?${params}`);
            if (!res.ok) throw new Error("Failed to fetch document history");
            return res.json();
        },
    });
};

export const useDeleteDocument = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (documentId: number) => {
            const res = await fetch(`${API_BASE}/documents/history/${documentId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete document");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["document-history"] });
        },
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// ATTACHMENTS
// ═══════════════════════════════════════════════════════════════════════════

export interface Attachment {
    id: number;
    name: string;
    description?: string;
    country_code: string;
    file_type: string;
    file_size_bytes?: number;
    page_count?: number;
    category?: string;
}

export interface AttachmentForDocumentType {
    attachment_id: number;
    name: string;
    file_type: string;
    page_count?: number;
    display_order: number;
    is_mandatory: boolean;
    is_preselected: boolean;
}

export const useAttachments = (countryCode?: string, category?: string) => {
    return useQuery({
        queryKey: ["attachments", countryCode, category],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (countryCode) params.append("country_code", countryCode);
            if (category) params.append("category", category);
            const queryString = params.toString();
            const res = await fetch(`${API_BASE}/admin/attachments${queryString ? `?${queryString}` : ""}`);
            if (!res.ok) throw new Error("Failed to fetch attachments");
            return res.json() as Promise<Attachment[]>;
        },
    });
};

export const useAttachment = (attachmentId: number) => {
    return useQuery({
        queryKey: ["attachment", attachmentId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/admin/attachments/${attachmentId}`);
            if (!res.ok) throw new Error("Failed to fetch attachment");
            return res.json() as Promise<Attachment>;
        },
        enabled: !!attachmentId,
    });
};

export const useUploadAttachment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            file,
            name,
            description,
            countryCode,
            category,
        }: {
            file: File;
            name: string;
            description?: string;
            countryCode: string;
            category?: string;
        }) => {
            const formData = new FormData();
            formData.append("file", file);

            const params = new URLSearchParams({
                country_code: countryCode,
                name: name,
            });
            if (description) params.append("description", description);
            if (category) params.append("category", category);

            const res = await fetch(`${API_BASE}/admin/attachments?${params}`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Upload failed" }));
                throw new Error(error.detail || "Failed to upload attachment");
            }
            return res.json() as Promise<{ id: number; status: string }>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["attachments"] });
        },
    });
};

export const useDeleteAttachment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (attachmentId: number) => {
            const res = await fetch(`${API_BASE}/admin/attachments/${attachmentId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Delete failed" }));
                throw new Error(error.detail || "Failed to delete attachment");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["attachments"] });
        },
    });
};

export const useAttachmentsForDocumentType = (documentTypeId: number) => {
    return useQuery({
        queryKey: ["document-type-attachments", documentTypeId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/admin/attachments/document-type/${documentTypeId}`);
            if (!res.ok) throw new Error("Failed to fetch document type attachments");
            return res.json() as Promise<AttachmentForDocumentType[]>;
        },
        enabled: !!documentTypeId,
    });
};

export const useAssignAttachmentToDocumentType = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            documentTypeId,
            attachmentId,
            displayOrder = 1,
            isMandatory = false,
            isPreselected = true,
        }: {
            documentTypeId: number;
            attachmentId: number;
            displayOrder?: number;
            isMandatory?: boolean;
            isPreselected?: boolean;
        }) => {
            const res = await fetch(`${API_BASE}/admin/attachments/document-type/${documentTypeId}/assign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    attachment_id: attachmentId,
                    display_order: displayOrder,
                    is_mandatory: isMandatory,
                    is_preselected: isPreselected,
                }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Assignment failed" }));
                throw new Error(error.detail || "Failed to assign attachment");
            }
            return res.json();
        },
        onSuccess: (_, { documentTypeId }) => {
            queryClient.invalidateQueries({ queryKey: ["document-type-attachments", documentTypeId] });
        },
    });
};

export const useUnassignAttachmentFromDocumentType = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            documentTypeId,
            attachmentId,
        }: {
            documentTypeId: number;
            attachmentId: number;
        }) => {
            const res = await fetch(`${API_BASE}/admin/attachments/document-type/${documentTypeId}/unassign/${attachmentId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Unassignment failed" }));
                throw new Error(error.detail || "Failed to unassign attachment");
            }
            return res.json();
        },
        onSuccess: (_, { documentTypeId }) => {
            queryClient.invalidateQueries({ queryKey: ["document-type-attachments", documentTypeId] });
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
// BULK GENERATION
// ═══════════════════════════════════════════════════════════════════════════

export interface BulkFieldError {
    row: number;
    column: string;
    value: string;
    error: string;
}

export interface BulkValidationResult {
    is_valid: boolean;
    row_count: number;
    column_count: number;
    errors: string[];
    warnings: string[];
    field_errors: BulkFieldError[];
    preview_data: Record<string, unknown>[];
    detected_columns: string[];
    missing_required_columns: string[];
    unknown_columns: string[];
}

export interface BulkJob {
    id: number;
    status: "pending" | "processing" | "completed" | "failed" | "cancelled";
    total: number;
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
    download_ready: boolean;
    result_file_path: string | null;
    created_at: string;
}

export const useBulkJobs = () => {
    return useQuery({
        queryKey: ["bulk-jobs"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/bulk/jobs`);
            if (!res.ok) throw new Error("Failed to fetch bulk jobs");
            return res.json() as Promise<BulkJob[]>;
        },
    });
};

export const useBulkJobStatus = (jobId: string | number, enabled: boolean) => {
    return useQuery({
        queryKey: ["bulk-job", jobId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/bulk/jobs/${jobId}`);
            if (!res.ok) throw new Error("Failed to fetch job status");
            return res.json() as Promise<BulkJob>;
        },
        enabled: enabled && !!jobId,
        refetchInterval: 2000, // Poll every 2 seconds for progress
    });
};

export const useValidateBulkUpload = () => {
    return useMutation({
        mutationFn: async ({ documentTypeId, file }: { documentTypeId: number; file: File }) => {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch(`${API_BASE}/bulk/validate?document_type_id=${documentTypeId}`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Validation failed" }));
                throw new Error(error.detail || "Failed to validate file");
            }
            return res.json() as Promise<BulkValidationResult>;
        },
    });
};

export const useStartBulkGeneration = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            documentTypeId,
            file,
            outputFormat = "pdf",
        }: {
            documentTypeId: number;
            file: File;
            outputFormat?: "pdf" | "docx";
        }) => {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch(
                `${API_BASE}/bulk/generate?document_type_id=${documentTypeId}&output_format=${outputFormat}`,
                {
                    method: "POST",
                    body: formData,
                }
            );
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Generation failed" }));
                throw new Error(error.detail || "Failed to start bulk generation");
            }
            return res.json() as Promise<{ job_id: number; status: string; total_records: number }>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bulk-jobs"] });
        },
    });
};

export const useCancelBulkJob = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (jobId: number) => {
            const res = await fetch(`${API_BASE}/bulk/jobs/${jobId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to cancel job");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bulk-jobs"] });
        },
    });
};

export const getBulkTemplateUrl = (documentTypeId: number, format: "csv" | "xlsx" = "csv") => {
    return `${API_BASE}/bulk/templates/${documentTypeId}?format=${format}`;
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
// STATISTICS / DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export interface DocumentTypeStats {
    document_type_id: number;
    document_type_name: string;
    count: number;
    percentage: number;
}

export interface DashboardStats {
    documents_this_month: number;
    documents_total: number;
    open_drafts: number;
    bulk_jobs_this_month: number;
    bulk_documents_this_month: number;
    documents_change_percent: number | null;
    top_document_types: DocumentTypeStats[];
    unused_clause_count: number;
    team_document_count: number | null;
    team_draft_count: number | null;
}

export interface RecentDocument {
    id: number;
    document_type_id: number;
    document_type_name: string;
    created_at: string | null;
    employee_name: string | null;
}

export interface RecentDraft {
    id: number;
    document_type_id: number;
    document_type_name: string;
    updated_at: string | null;
    name: string | null;
}

export interface MyActivity {
    recent_documents: RecentDocument[];
    recent_drafts: RecentDraft[];
}

export const useDashboardStats = (countryCode?: string) => {
    return useQuery({
        queryKey: ["dashboard-stats", countryCode],
        queryFn: async () => {
            const params = countryCode ? `?country_code=${countryCode}` : "";
            const res = await fetch(`${API_BASE}/statistics/dashboard${params}`);
            if (!res.ok) throw new Error("Failed to fetch dashboard stats");
            return res.json() as Promise<DashboardStats>;
        },
        staleTime: 1000 * 60, // 1 minute
    });
};

export const useMyActivity = (limit: number = 10) => {
    return useQuery({
        queryKey: ["my-activity", limit],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/statistics/my-activity?limit=${limit}`);
            if (!res.ok) throw new Error("Failed to fetch activity");
            return res.json() as Promise<MyActivity>;
        },
        staleTime: 1000 * 30, // 30 seconds
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// FAVORITES
// ═══════════════════════════════════════════════════════════════════════════

export interface Favorite {
    id: number;
    favorite_type: "document_type" | "document";
    document_type_id: number | null;
    document_id: number | null;
    display_name: string | null;
    display_order: number;
    resolved_name: string;
    category: string | null;
}

export interface ToggleFavoriteRequest {
    favorite_type: "document_type" | "document";
    document_type_id?: number;
    document_id?: number;
    display_name?: string;
}

export const useFavorites = (favoriteType?: "document_type" | "document") => {
    return useQuery({
        queryKey: ["favorites", favoriteType],
        queryFn: async () => {
            const params = favoriteType ? `?favorite_type=${favoriteType}` : "";
            const res = await fetch(`${API_BASE}/favorites${params}`);
            if (!res.ok) throw new Error("Failed to fetch favorites");
            return res.json() as Promise<Favorite[]>;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useToggleFavorite = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (request: ToggleFavoriteRequest) => {
            const res = await fetch(`${API_BASE}/favorites/toggle`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(request),
            });
            if (!res.ok) throw new Error("Failed to toggle favorite");
            return res.json() as Promise<{ is_favorite: boolean; action: string; id?: number }>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["favorites"] });
        },
    });
};

export const useRemoveFavorite = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (favoriteId: number) => {
            const res = await fetch(`${API_BASE}/favorites/${favoriteId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to remove favorite");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["favorites"] });
        },
    });
};

export const useCheckFavorite = (favoriteType: string, itemId: number) => {
    return useQuery({
        queryKey: ["favorite-check", favoriteType, itemId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/favorites/check/${favoriteType}/${itemId}`);
            if (!res.ok) throw new Error("Failed to check favorite");
            return res.json() as Promise<{ is_favorite: boolean }>;
        },
        enabled: !!itemId,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL SEARCH
// ═══════════════════════════════════════════════════════════════════════════

export interface SearchResult {
    id: number;
    result_type: "document" | "draft";
    document_type_name: string;
    employee_name: string | null;
    created_at: string | null;
    updated_at: string | null;
    status: "final" | "draft";
    relevance_score: number;
}

export interface SearchResponse {
    query: string;
    total_results: number;
    results: SearchResult[];
    search_time_ms: number;
}

export const useGlobalSearch = (query: string, options?: {
    countryCode?: string;
    resultType?: "document" | "draft";
    limit?: number;
    enabled?: boolean;
}) => {
    const enabled = options?.enabled !== false && query.trim().length >= 2;

    return useQuery({
        queryKey: ["global-search", query, options?.countryCode, options?.resultType],
        queryFn: async () => {
            const params = new URLSearchParams({ q: query });
            if (options?.countryCode) params.append("country_code", options.countryCode);
            if (options?.resultType) params.append("result_type", options.resultType);
            if (options?.limit) params.append("limit", String(options.limit));

            const res = await fetch(`${API_BASE}/search?${params}`);
            if (!res.ok) throw new Error("Search failed");
            return res.json() as Promise<SearchResponse>;
        },
        enabled,
        staleTime: 1000 * 30, // 30 seconds
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// TEAMS
// ═══════════════════════════════════════════════════════════════════════════

export interface Team {
    id: number;
    name: string;
    description: string | null;
    country_code: string;
    is_active: boolean;
    allow_member_invites: boolean;
    created_by: string;
    created_at: string;
    member_count: number;
    my_role: "owner" | "admin" | "member" | "viewer" | null;
}

export interface TeamMember {
    id: number;
    user_id: string;
    role: "owner" | "admin" | "member" | "viewer";
    joined_at: string;
    invited_by: string | null;
}

export interface TeamShare {
    id: number;
    document_id: number | null;
    draft_id: number | null;
    can_view: boolean;
    can_edit: boolean;
    can_download: boolean;
    shared_by: string;
    shared_at: string;
    note: string | null;
}

export interface CreateTeamRequest {
    name: string;
    description?: string;
    country_code?: string;
    allow_member_invites?: boolean;
}

export interface UpdateTeamRequest {
    name?: string;
    description?: string;
    is_active?: boolean;
    allow_member_invites?: boolean;
}

export interface AddMemberRequest {
    user_id: string;
    role?: "admin" | "member" | "viewer";
}

export interface ShareDocumentRequest {
    document_id?: number;
    draft_id?: number;
    can_view?: boolean;
    can_edit?: boolean;
    can_download?: boolean;
    note?: string;
}

export const useMyTeams = (countryCode?: string) => {
    return useQuery({
        queryKey: ["teams", countryCode],
        queryFn: async () => {
            const params = countryCode ? `?country_code=${countryCode}` : "";
            const res = await fetch(`${API_BASE}/teams${params}`);
            if (!res.ok) throw new Error("Failed to fetch teams");
            return res.json() as Promise<Team[]>;
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
};

export const useTeam = (teamId: number) => {
    return useQuery({
        queryKey: ["team", teamId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/teams/${teamId}`);
            if (!res.ok) throw new Error("Failed to fetch team");
            return res.json() as Promise<Team>;
        },
        enabled: !!teamId,
    });
};

export const useCreateTeam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateTeamRequest) => {
            const res = await fetch(`${API_BASE}/teams`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to create team" }));
                throw new Error(error.detail || "Failed to create team");
            }
            return res.json() as Promise<Team>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["teams"] });
        },
    });
};

export const useUpdateTeam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, data }: { teamId: number; data: UpdateTeamRequest }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to update team" }));
                throw new Error(error.detail || "Failed to update team");
            }
            return res.json() as Promise<Team>;
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            queryClient.invalidateQueries({ queryKey: ["team", teamId] });
        },
    });
};

export const useDeleteTeam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (teamId: number) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to delete team" }));
                throw new Error(error.detail || "Failed to delete team");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["teams"] });
        },
    });
};

// Team Members
export const useTeamMembers = (teamId: number) => {
    return useQuery({
        queryKey: ["team-members", teamId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/members`);
            if (!res.ok) throw new Error("Failed to fetch team members");
            return res.json() as Promise<TeamMember[]>;
        },
        enabled: !!teamId,
    });
};

export const useAddTeamMember = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, data }: { teamId: number; data: AddMemberRequest }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to add member" }));
                throw new Error(error.detail || "Failed to add member");
            }
            return res.json() as Promise<TeamMember>;
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
            queryClient.invalidateQueries({ queryKey: ["team", teamId] });
        },
    });
};

export const useUpdateMemberRole = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            teamId,
            userId,
            role,
        }: {
            teamId: number;
            userId: string;
            role: string;
        }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/members/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to update role" }));
                throw new Error(error.detail || "Failed to update role");
            }
            return res.json() as Promise<TeamMember>;
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
        },
    });
};

export const useRemoveTeamMember = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, userId }: { teamId: number; userId: string }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/members/${userId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to remove member" }));
                throw new Error(error.detail || "Failed to remove member");
            }
            return res.json();
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
            queryClient.invalidateQueries({ queryKey: ["team", teamId] });
        },
    });
};

// Team Shares
export const useTeamShares = (teamId: number) => {
    return useQuery({
        queryKey: ["team-shares", teamId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/shares`);
            if (!res.ok) throw new Error("Failed to fetch team shares");
            return res.json() as Promise<TeamShare[]>;
        },
        enabled: !!teamId,
    });
};

export const useShareWithTeam = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, data }: { teamId: number; data: ShareDocumentRequest }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/shares`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to share" }));
                throw new Error(error.detail || "Failed to share");
            }
            return res.json() as Promise<TeamShare>;
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-shares", teamId] });
        },
    });
};

export const useRemoveTeamShare = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ teamId, shareId }: { teamId: number; shareId: number }) => {
            const res = await fetch(`${API_BASE}/teams/${teamId}/shares/${shareId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to remove share" }));
                throw new Error(error.detail || "Failed to remove share");
            }
            return res.json();
        },
        onSuccess: (_, { teamId }) => {
            queryClient.invalidateQueries({ queryKey: ["team-shares", teamId] });
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
// DOCUMENT CORRECTIONS (15.5.2)
// ═══════════════════════════════════════════════════════════════════════════

export interface DocumentVersion {
    id: number;
    document_id: number;
    version_number: number;
    file_path: string;
    change_reason: string | null;
    changed_fields: string[] | null;
    created_by: string;
    created_at: string;
    is_current: boolean;
}

export interface CorrectionRequest {
    id: number;
    document_id: number;
    status: "pending" | "in_progress" | "completed" | "cancelled";
    requested_changes: string | null;
    requested_by: string;
    requested_at: string;
    completed_by: string | null;
    completed_at: string | null;
}

export interface DocumentWithVersions {
    id: number;
    title: string | null;
    document_type_id: number;
    employee_name: string | null;
    current_version: number;
    is_correctable: boolean;
    created_at: string;
    form_data: Record<string, unknown> | null;
    versions: DocumentVersion[];
}

export const useDocumentWithVersions = (documentId: number) => {
    return useQuery({
        queryKey: ["document-versions", documentId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/corrections/document/${documentId}`);
            if (!res.ok) throw new Error("Failed to fetch document");
            return res.json() as Promise<DocumentWithVersions>;
        },
        enabled: !!documentId,
    });
};

export const useDocumentVersions = (documentId: number) => {
    return useQuery({
        queryKey: ["document-version-list", documentId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/corrections/document/${documentId}/versions`);
            if (!res.ok) throw new Error("Failed to fetch versions");
            return res.json() as Promise<DocumentVersion[]>;
        },
        enabled: !!documentId,
    });
};

export const useStartCorrection = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { document_id: number; requested_changes?: string }) => {
            const res = await fetch(`${API_BASE}/corrections/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to start correction" }));
                throw new Error(error.detail || "Failed to start correction");
            }
            return res.json() as Promise<CorrectionRequest>;
        },
        onSuccess: (_, { document_id }) => {
            queryClient.invalidateQueries({ queryKey: ["document-versions", document_id] });
            queryClient.invalidateQueries({ queryKey: ["correction-requests"] });
        },
    });
};

export const useSubmitCorrection = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            correctionId,
            data,
        }: {
            correctionId: number;
            data: {
                form_data: Record<string, unknown>;
                change_reason: string;
                changed_fields: string[];
            };
        }) => {
            const res = await fetch(`${API_BASE}/corrections/${correctionId}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to submit correction" }));
                throw new Error(error.detail || "Failed to submit correction");
            }
            return res.json() as Promise<{
                message: string;
                new_version_number: number;
                version_id: number;
                document_id: number;
            }>;
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ["document-versions", result.document_id] });
            queryClient.invalidateQueries({ queryKey: ["document-version-list", result.document_id] });
            queryClient.invalidateQueries({ queryKey: ["correction-requests"] });
            queryClient.invalidateQueries({ queryKey: ["document-history"] });
        },
    });
};

export const useCancelCorrection = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (correctionId: number) => {
            const res = await fetch(`${API_BASE}/corrections/${correctionId}/cancel`, {
                method: "POST",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to cancel correction" }));
                throw new Error(error.detail || "Failed to cancel correction");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["correction-requests"] });
        },
    });
};

export const useMyCorrectionRequests = (statusFilter?: string) => {
    return useQuery({
        queryKey: ["correction-requests", statusFilter],
        queryFn: async () => {
            const params = statusFilter ? `?status_filter=${statusFilter}` : "";
            const res = await fetch(`${API_BASE}/corrections/requests${params}`);
            if (!res.ok) throw new Error("Failed to fetch correction requests");
            return res.json() as Promise<CorrectionRequest[]>;
        },
    });
};

export const useDownloadVersion = (versionId: number) => {
    return useQuery({
        queryKey: ["version-download", versionId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/corrections/version/${versionId}/download`);
            if (!res.ok) throw new Error("Failed to get download info");
            return res.json() as Promise<{
                version_id: number;
                version_number: number;
                file_path: string;
                created_at: string;
            }>;
        },
        enabled: !!versionId,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT REPOSITORY (16.3 - DMS)
// ═══════════════════════════════════════════════════════════════════════════

export interface RepositoryDocument {
    id: number;
    title: string | null;
    document_type_id: number;
    document_type_name: string | null;
    employee_name: string | null;
    employee_id: string | null;
    file_path: string;
    current_version: number;
    is_correctable: boolean;
    created_at: string;
    created_by_id: number | null;
    created_by_email: string | null;
    retention_date: string | null;
    has_versions: boolean;
    version_count: number;
}

export interface RepositoryResponse {
    documents: RepositoryDocument[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    filters_applied: Record<string, unknown>;
}

export interface RepositoryFilters {
    search?: string;
    document_type_id?: number;
    country_code?: string;
    employee_name?: string;
    date_from?: string;
    date_to?: string;
    has_corrections?: boolean;
    sort_by?: "created_at" | "employee_name" | "document_type" | "title";
    sort_order?: "asc" | "desc";
    page?: number;
    page_size?: number;
}

export interface RepositoryStats {
    total_documents: number;
    documents_this_month: number;
    documents_with_corrections: number;
    documents_by_type: Array<{ name: string; count: number }>;
    documents_by_month: Array<{ month: string; label: string; count: number }>;
}

export const useRepository = (filters: RepositoryFilters = {}) => {
    return useQuery({
        queryKey: ["repository", filters],
        queryFn: async () => {
            const params = new URLSearchParams();

            if (filters.search) params.append("search", filters.search);
            if (filters.document_type_id) params.append("document_type_id", String(filters.document_type_id));
            if (filters.country_code) params.append("country_code", filters.country_code);
            if (filters.employee_name) params.append("employee_name", filters.employee_name);
            if (filters.date_from) params.append("date_from", filters.date_from);
            if (filters.date_to) params.append("date_to", filters.date_to);
            if (filters.has_corrections !== undefined) params.append("has_corrections", String(filters.has_corrections));
            if (filters.sort_by) params.append("sort_by", filters.sort_by);
            if (filters.sort_order) params.append("sort_order", filters.sort_order);
            if (filters.page) params.append("page", String(filters.page));
            if (filters.page_size) params.append("page_size", String(filters.page_size));

            const res = await fetch(`${API_BASE}/repository?${params}`);
            if (!res.ok) throw new Error("Failed to fetch documents");
            return res.json() as Promise<RepositoryResponse>;
        },
        staleTime: 1000 * 30, // 30 seconds
    });
};

export const useRepositoryStats = (countryCode?: string) => {
    return useQuery({
        queryKey: ["repository-stats", countryCode],
        queryFn: async () => {
            const params = countryCode ? `?country_code=${countryCode}` : "";
            const res = await fetch(`${API_BASE}/repository/stats${params}`);
            if (!res.ok) throw new Error("Failed to fetch stats");
            return res.json() as Promise<RepositoryStats>;
        },
        staleTime: 1000 * 60, // 1 minute
    });
};

export const useRepositoryDocument = (documentId: number) => {
    return useQuery({
        queryKey: ["repository-document", documentId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/repository/${documentId}`);
            if (!res.ok) throw new Error("Failed to fetch document");
            return res.json();
        },
        enabled: !!documentId,
    });
};

export const useBulkAction = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { document_ids: number[]; action: "delete" | "archive" | "export" | "restore" | "unarchive" }) => {
            const res = await fetch(`${API_BASE}/repository/bulk-action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Bulk action failed" }));
                throw new Error(error.detail || "Failed to perform bulk action");
            }
            return res.json() as Promise<{
                message: string;
                processed: number;
                file_paths?: string[];
            }>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["repository"] });
            queryClient.invalidateQueries({ queryKey: ["repository-stats"] });
        },
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOG (15.5.5)
// ═══════════════════════════════════════════════════════════════════════════

export interface AuditLogEntry {
    id: number;
    timestamp: string;
    user_id: string;
    user_email: string | null;
    user_name: string | null;
    action: string;
    action_category: string;
    entity_type: string | null;
    entity_id: number | null;
    entity_name: string | null;
    description: string | null;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
    country_code: string | null;
    status: string;
}

export interface AuditLogListResponse {
    items: AuditLogEntry[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface AuditLogStats {
    total_entries: number;
    entries_today: number;
    entries_this_week: number;
    entries_this_month: number;
    by_category: Record<string, number>;
    by_action: Record<string, number>;
    by_user: Array<{ user_id: string; user_name: string; count: number }>;
    recent_errors: Array<{
        id: number;
        timestamp: string;
        action: string;
        user_id: string;
        error_message: string | null;
        entity_name: string | null;
    }>;
}

export interface AuditLogFilters {
    page?: number;
    page_size?: number;
    action_category?: string;
    action?: string;
    user_id?: string;
    entity_type?: string;
    entity_id?: number;
    country_code?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
}

export const useAuditLogs = (filters: AuditLogFilters = {}) => {
    return useQuery({
        queryKey: ["audit-logs", filters],
        queryFn: async () => {
            const params = new URLSearchParams();

            if (filters.page) params.append("page", String(filters.page));
            if (filters.page_size) params.append("page_size", String(filters.page_size));
            if (filters.action_category) params.append("action_category", filters.action_category);
            if (filters.action) params.append("action", filters.action);
            if (filters.user_id) params.append("user_id", filters.user_id);
            if (filters.entity_type) params.append("entity_type", filters.entity_type);
            if (filters.entity_id) params.append("entity_id", String(filters.entity_id));
            if (filters.country_code) params.append("country_code", filters.country_code);
            if (filters.status) params.append("status", filters.status);
            if (filters.date_from) params.append("date_from", filters.date_from);
            if (filters.date_to) params.append("date_to", filters.date_to);
            if (filters.search) params.append("search", filters.search);

            const res = await fetch(`${API_BASE}/audit?${params}`);
            if (!res.ok) throw new Error("Failed to fetch audit logs");
            return res.json() as Promise<AuditLogListResponse>;
        },
        staleTime: 1000 * 30, // 30 seconds
    });
};

export const useAuditLogStats = (countryCode?: string, days: number = 30) => {
    return useQuery({
        queryKey: ["audit-stats", countryCode, days],
        queryFn: async () => {
            const params = new URLSearchParams({ days: String(days) });
            if (countryCode) params.append("country_code", countryCode);

            const res = await fetch(`${API_BASE}/audit/stats?${params}`);
            if (!res.ok) throw new Error("Failed to fetch audit stats");
            return res.json() as Promise<AuditLogStats>;
        },
        staleTime: 1000 * 60, // 1 minute
    });
};

export const useAuditLogActions = () => {
    return useQuery({
        queryKey: ["audit-actions"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/audit/actions`);
            if (!res.ok) throw new Error("Failed to fetch action types");
            return res.json() as Promise<Record<string, string[]>>;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export const useEntityAuditHistory = (entityType: string, entityId: number, page: number = 1) => {
    return useQuery({
        queryKey: ["entity-audit", entityType, entityId, page],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/audit/entity/${entityType}/${entityId}?page=${page}`);
            if (!res.ok) throw new Error("Failed to fetch entity history");
            return res.json();
        },
        enabled: !!entityType && !!entityId,
    });
};

export const useUserAuditActivity = (userId: string, days: number = 30, page: number = 1) => {
    return useQuery({
        queryKey: ["user-audit", userId, days, page],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/audit/user/${userId}?days=${days}&page=${page}`);
            if (!res.ok) throw new Error("Failed to fetch user activity");
            return res.json();
        },
        enabled: !!userId,
    });
};

export const getAuditExportUrl = (filters: {
    format?: "csv" | "json";
    action_category?: string;
    date_from?: string;
    date_to?: string;
    country_code?: string;
    limit?: number;
}) => {
    const params = new URLSearchParams();
    if (filters.format) params.append("format", filters.format);
    if (filters.action_category) params.append("action_category", filters.action_category);
    if (filters.date_from) params.append("date_from", filters.date_from);
    if (filters.date_to) params.append("date_to", filters.date_to);
    if (filters.country_code) params.append("country_code", filters.country_code);
    if (filters.limit) params.append("limit", String(filters.limit));

    return `${API_BASE}/audit/export?${params}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS (15.5.6)
// ═══════════════════════════════════════════════════════════════════════════

export interface NotificationItem {
    id: number;
    notification_type: string;
    title: string;
    message: string;
    priority: string;
    entity_type: string | null;
    entity_id: number | null;
    action_url: string | null;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
}

export interface NotificationListResponse {
    notifications: NotificationItem[];
    total: number;
    unread_count: number;
    page: number;
    page_size: number;
}

export interface NotificationPreference {
    id: number;
    notification_type: string;
    in_app_enabled: boolean;
    email_enabled: boolean;
    email_digest: string | null;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
}

export interface NotificationType {
    type: string;
    label: string;
    description: string;
    default_enabled: boolean;
}

export const useNotifications = (page: number = 1, unreadOnly: boolean = false) => {
    return useQuery({
        queryKey: ["notifications", page, unreadOnly],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: String(page),
                unread_only: String(unreadOnly),
            });
            const res = await fetch(`${API_BASE}/notifications?${params}`);
            if (!res.ok) throw new Error("Failed to fetch notifications");
            return res.json() as Promise<NotificationListResponse>;
        },
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 60, // Refetch every minute
    });
};

export const useUnreadCount = () => {
    return useQuery({
        queryKey: ["notification-count"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/notifications/count`);
            if (!res.ok) throw new Error("Failed to fetch unread count");
            return res.json() as Promise<{ unread_count: number }>;
        },
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 60, // Refetch every minute
    });
};

export const useMarkAsRead = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (notificationId: number) => {
            const res = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to mark as read");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notification-count"] });
        },
    });
};

export const useMarkAllAsRead = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const res = await fetch(`${API_BASE}/notifications/read-all`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to mark all as read");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notification-count"] });
        },
    });
};

export const useDismissNotification = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (notificationId: number) => {
            const res = await fetch(`${API_BASE}/notifications/${notificationId}/dismiss`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to dismiss notification");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notification-count"] });
        },
    });
};

export const useNotificationTypes = () => {
    return useQuery({
        queryKey: ["notification-types"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/notifications/types`);
            if (!res.ok) throw new Error("Failed to fetch notification types");
            return res.json() as Promise<{ types: NotificationType[] }>;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export const useNotificationPreferences = () => {
    return useQuery({
        queryKey: ["notification-preferences"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/notifications/preferences`);
            if (!res.ok) throw new Error("Failed to fetch preferences");
            return res.json() as Promise<NotificationPreference[]>;
        },
    });
};

export const useUpdateNotificationPreference = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            notificationType,
            data,
        }: {
            notificationType: string;
            data: Partial<NotificationPreference>;
        }) => {
            const res = await fetch(`${API_BASE}/notifications/preferences/${notificationType}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update preference");
            return res.json() as Promise<NotificationPreference>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
        },
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT (16.6)
// ═══════════════════════════════════════════════════════════════════════════

export interface ExportFormat {
    id: string;
    name: string;
    description: string;
    max_documents: number;
    supports_all_types: boolean;
    note?: string;
}

export interface ExportPreview {
    file_count: number;
    pdf_count: number;
    total_size_bytes: number;
    total_size_mb: number;
    files: Array<{
        document_id: number;
        filename: string;
        size_bytes: number;
        is_pdf: boolean;
    }>;
    can_merge_pdf: boolean;
    can_zip: boolean;
}

export const useExportFormats = () => {
    return useQuery({
        queryKey: ["export-formats"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/export/formats`);
            if (!res.ok) throw new Error("Failed to fetch export formats");
            return res.json() as Promise<{ formats: ExportFormat[] }>;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export const useExportPreview = () => {
    return useMutation({
        mutationFn: async (documentIds: number[]) => {
            const res = await fetch(`${API_BASE}/export/preview`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    document_ids: documentIds,
                    format: "zip",
                }),
            });
            if (!res.ok) throw new Error("Failed to get export preview");
            return res.json() as Promise<ExportPreview>;
        },
    });
};

export const useExportZip = () => {
    return useMutation({
        mutationFn: async ({
            documentIds,
            filenamePrefix = "export",
        }: {
            documentIds: number[];
            filenamePrefix?: string;
        }) => {
            const res = await fetch(`${API_BASE}/export/zip`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    document_ids: documentIds,
                    format: "zip",
                    filename_prefix: filenamePrefix,
                }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Export failed" }));
                throw new Error(error.detail || "Failed to export documents");
            }

            // Download the file
            const blob = await res.blob();
            const filename = res.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") || "export.zip";

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return {
                success: true,
                filesIncluded: parseInt(res.headers.get("X-Files-Included") || "0"),
            };
        },
    });
};

export const useMergePdf = () => {
    return useMutation({
        mutationFn: async ({
            documentIds,
            outputFilename = "merged",
            includeSeparatorPages = false,
        }: {
            documentIds: number[];
            outputFilename?: string;
            includeSeparatorPages?: boolean;
        }) => {
            const res = await fetch(`${API_BASE}/export/merge-pdf`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    document_ids: documentIds,
                    output_filename: outputFilename,
                    include_separator_pages: includeSeparatorPages,
                }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Merge failed" }));
                throw new Error(error.detail || "Failed to merge PDFs");
            }

            // Download the file
            const blob = await res.blob();
            const filename = `${outputFilename}.pdf`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return {
                success: true,
                documentsMerged: parseInt(res.headers.get("X-Documents-Merged") || "0"),
            };
        },
    });
};

export const getDownloadUrl = (documentId: number) => {
    return `${API_BASE}/export/single/${documentId}`;
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