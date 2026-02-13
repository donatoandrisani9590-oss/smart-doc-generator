/**
 * Document API Hooks
 * DOCUMENT HISTORY + DOCUMENT CORRECTIONS + DOCUMENT REPOSITORY + EXPORT + ATTACHMENTS
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

const API_BASE = "/api/v1";

// Use apiFetch for all API calls to automatically include auth token
const fetch = apiFetch;

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

export interface RepositoryDocumentDetail extends RepositoryDocument {
    document_type_category: string | null;
    content_html: string | null;
    form_data: Record<string, unknown> | null;
    versions: Array<{
        id: number;
        version_number: number;
        file_path: string;
        change_reason: string | null;
        changed_fields: string[];
        created_by: string;
        created_at: string | null;
        is_current: boolean;
    }>;
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
    return useQuery<RepositoryDocumentDetail>({
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
// DOCUMENT LOCKING
// ═══════════════════════════════════════════════════════════════════════════

export interface DocumentLockStatus {
    is_locked: boolean;
    locked_by_id: number | null;
    locked_by_email: string | null;
    locked_by_name: string | null;
    locked_at: string | null;
    expires_at: string | null;
    lock_reason: string | null;
    is_own_lock: boolean;
    is_expired: boolean;
}

export interface LockAcquiredResult {
    message: string;
    document_id: number;
    expires_at: string;
    lock_id: number;
}

export const useDocumentLockStatus = (documentId: number) => {
    return useQuery({
        queryKey: ["document-lock", documentId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/locks/${documentId}`);
            if (!res.ok) throw new Error("Failed to check lock status");
            return res.json() as Promise<DocumentLockStatus>;
        },
        enabled: !!documentId,
        refetchInterval: 30000, // Poll every 30 seconds
        staleTime: 10000,
    });
};

export const useAcquireLock = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { document_id: number; lock_reason?: string }) => {
            const res = await fetch(`${API_BASE}/locks/acquire`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to acquire lock" }));
                const detail = typeof error.detail === "string" ? error.detail : error.detail?.message || "Dokument ist gesperrt";
                throw new Error(detail);
            }
            return res.json() as Promise<LockAcquiredResult>;
        },
        onSuccess: (_, { document_id }) => {
            queryClient.invalidateQueries({ queryKey: ["document-lock", document_id] });
        },
    });
};

export const useReleaseLock = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (documentId: number) => {
            const res = await fetch(`${API_BASE}/locks/release`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ document_id: documentId }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to release lock" }));
                throw new Error(error.detail || "Failed to release lock");
            }
            return res.json();
        },
        onSuccess: (_, documentId) => {
            queryClient.invalidateQueries({ queryKey: ["document-lock", documentId] });
        },
    });
};

export const useLockHeartbeat = () => {
    return useMutation({
        mutationFn: async (documentId: number) => {
            const res = await fetch(`${API_BASE}/locks/heartbeat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ document_id: documentId }),
            });
            if (!res.ok) throw new Error("Heartbeat failed");
            return res.json();
        },
    });
};

export const useForceReleaseLock = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (documentId: number) => {
            const res = await fetch(`${API_BASE}/locks/force-release`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ document_id: documentId }),
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({ detail: "Failed to force release" }));
                throw new Error(error.detail || "Failed to force release lock");
            }
            return res.json();
        },
        onSuccess: (_, documentId) => {
            queryClient.invalidateQueries({ queryKey: ["document-lock", documentId] });
        },
    });
};
